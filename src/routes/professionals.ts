import 'dotenv/config';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@server/index';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

type AuthenticatedRequest = Parameters<Parameters<typeof router.get>[1]>[0] & {
  user?: { id: string; role: 'CLIENT' | 'PRO' };
};

function requireAuth(req: AuthenticatedRequest, res: any, next: any) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Não autorizado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string; role: 'CLIENT' | 'PRO' };
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

async function uploadAvatarToS3(buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'iuork-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `avatars/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
  const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

router.get('/', async (req, res) => {
  try {
    const { 
      keyword,           // Palavra-chave da busca
      clientLat,         // Latitude do cliente
      clientLng,         // Longitude do cliente
    } = req.query;

    console.log('GET /professionals - Query params:', { keyword, clientLat, clientLng });

    // Normalizar keyword para string
    const keywordStr = typeof keyword === 'string' ? keyword : Array.isArray(keyword) ? String(keyword[0]) : undefined;

    // Construir query base
    let whereClause: any = {
      latitude: { not: null },
      longitude: { not: null },
    };

    // Se tem palavra-chave, filtrar por profissão ou nome
    if (keywordStr && keywordStr.trim().length > 0) {
      const keywordLower = keywordStr.toLowerCase().trim();
      whereClause.OR = [
        { profession: { name: { contains: keywordLower, mode: 'insensitive' } } },
        { user: { name: { contains: keywordLower, mode: 'insensitive' } } },
      ];
    }

    // Flag para controlar se deve usar fallback
    let useFallback = true;
    
    // Se tem coordenadas do cliente, filtrar diretamente no banco com PostGIS
    if (clientLat && clientLng) {
      const clientLatNum = parseFloat(clientLat as string);
      const clientLngNum = parseFloat(clientLng as string);
      
      if (!isNaN(clientLatNum) && !isNaN(clientLngNum)) {
        try {
          useFallback = false; // Tentar usar query SQL
          // Construir condições SQL dinamicamente
          let keywordCondition = '';
          const params: any[] = [clientLngNum, clientLatNum];
          
          if (keywordStr && keywordStr.trim().length > 0) {
            const keywordPattern = `%${keywordStr.toLowerCase().trim()}%`;
            keywordCondition = `AND (
              EXISTS(SELECT 1 FROM "Profession" pr WHERE pr.id = pp."professionId" AND LOWER(pr.name) LIKE $${params.length + 1})
              OR EXISTS(SELECT 1 FROM "User" u WHERE u.id = pp."userId" AND LOWER(u.name) LIKE $${params.length + 1})
            )`;
            params.push(keywordPattern);
          }

          // Executar query e obter IDs dos profissionais filtrados
          // Lógica: Profissional aparece se:
          // 1. Tem serviços online (sempre aparece)
          // 2. OU está dentro do raio de atendimento (para serviços presenciais)
          // Usando fórmula Haversine para calcular distância (não requer PostGIS)
          const sql = `
            SELECT 
              pp.id,
              pp."radiusKm" as radius_km,
              (
                6371 * acos(
                  cos(radians($2)) * 
                  cos(radians(CAST(pp.latitude AS float))) * 
                  cos(radians(CAST(pp.longitude AS float)) - radians($1)) + 
                  sin(radians($2)) * 
                  sin(radians(CAST(pp.latitude AS float)))
                )
              ) as distance_km,
              EXISTS(
                SELECT 1 FROM "Service" s 
                WHERE s."professionalId" = pp.id AND s."isOnline" = true
              ) as has_online_services
            FROM "ProfessionalProfile" pp
            WHERE pp.latitude IS NOT NULL 
              AND pp.longitude IS NOT NULL
              ${keywordCondition}
              AND (
                EXISTS(SELECT 1 FROM "Service" s WHERE s."professionalId" = pp.id AND s."isOnline" = true)
                OR (
                  (
                    6371 * acos(
                      cos(radians($2)) * 
                      cos(radians(CAST(pp.latitude AS float))) * 
                      cos(radians(CAST(pp.longitude AS float)) - radians($1)) + 
                      sin(radians($2)) * 
                      sin(radians(CAST(pp.latitude AS float)))
                    )
                  ) <= CAST(pp."radiusKm" AS float)
                )
              )
          `;

          console.log('Query SQL:', sql);
          console.log('Parâmetros:', params);
          console.log('Cliente coordenadas:', { lat: clientLatNum, lng: clientLngNum });

          const professionalsWithRadius = await prisma.$queryRawUnsafe<Array<{
            id: string;
            radius_km: number;
            distance_km: number;
            has_online_services: boolean;
          }>>(sql, ...params);

          console.log('Profissionais encontrados:', professionalsWithRadius.map(p => ({
            id: p.id,
            radius_km: p.radius_km,
            distance_km: p.distance_km.toFixed(2),
            has_online: p.has_online_services,
            dentro_raio: p.distance_km <= p.radius_km
          })));

          const filteredIds = professionalsWithRadius.map(p => p.id);

          // Buscar profissionais completos apenas dos IDs filtrados
          const data = await prisma.professionalProfile.findMany({
            where: {
              id: { in: filteredIds },
            },
            include: {
              user: true,
              services: {
                include: { images: true, category: true },
              },
              categories: true,
              profession: true,
            },
          });

          // Mapear resposta
          const response = data.map((p) => {
            const hasOnlineServices = p.services.some(s => s.isOnline);
            const hasPresentialServices = p.services.some(s => s.isPresential);
            const radiusInfo = professionalsWithRadius.find(r => r.id === p.id);
            
            return {
              id: p.id,
              userId: p.userId,
              image: p.user.avatarUrl ?? '',
              coverImage: p.coverUrl ?? '',
              name: p.user.name,
              profession: p.profession?.name ?? 'Profissional',
              description: p.bio ?? '',
              radiusKm: p.radiusKm || 5,
              address: p.latitude != null && p.longitude != null
                ? {
                    latitude: Number(p.latitude),
                    longitude: Number(p.longitude),
                    street: p.street ?? '',
                    number: Number(p.number ?? 0),
                    district: p.district ?? '',
                    city: p.city ?? '',
                    state: p.state ?? '',
                    postalcode: p.postalcode ?? '',
                    distanceInMeters: radiusInfo ? Math.round(radiusInfo.distance_km * 1000) : null,
                  }
                : null,
              completedServicesCount: 0,
              ratingsAggregate: { avg: 0, count: 0 },
              hasOnlineServices,
              hasPresentialServices,
            };
          });
          
          return res.json(response);
        } catch (sqlError: any) {
          console.error('Erro na query PostGIS:', sqlError);
          // Se falhar, fazer fallback para método sem filtro de raio
          console.warn('Fazendo fallback para método sem filtro de raio devido a erro na query SQL');
          useFallback = true; // Usar fallback
        }
      } else {
        // Se coordenadas são inválidas, fazer fallback
        console.warn('Coordenadas do cliente inválidas, fazendo fallback:', { clientLat, clientLng });
        useFallback = true;
      }
    }
    
    // Fallback: Se não tem coordenadas válidas ou query SQL falhou
    if (useFallback) {
      // Se não tem coordenadas do cliente, retornar todos os profissionais (fallback)
      // Em produção, isso não deveria acontecer, mas mantemos como fallback seguro
      console.warn('GET /professionals chamado sem coordenadas do cliente - retornando todos os profissionais (fallback)');
      const data = await prisma.professionalProfile.findMany({
        where: whereClause,
        include: {
          user: true,
          services: {
            include: { images: true, category: true },
          },
          categories: true,
          profession: true,
        },
      });

      const response = data.map((p) => {
        const hasOnlineServices = p.services.some(s => s.isOnline);
        const hasPresentialServices = p.services.some(s => s.isPresential);
        
        return {
          id: p.id,
          userId: p.userId,
          image: p.user.avatarUrl ?? '',
          coverImage: p.coverUrl ?? '',
          name: p.user.name,
          profession: p.profession?.name ?? 'Profissional',
          description: p.bio ?? '',
          radiusKm: p.radiusKm || 5,
          address: p.latitude != null && p.longitude != null
            ? {
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
                street: p.street ?? '',
                number: Number(p.number ?? 0),
                district: p.district ?? '',
                city: p.city ?? '',
                state: p.state ?? '',
                postalcode: p.postalcode ?? '',
                distanceInMeters: null,
              }
            : null,
          completedServicesCount: 0,
          ratingsAggregate: { avg: 0, count: 0 },
          hasOnlineServices,
          hasPresentialServices,
        };
      });
      
      return res.json(response);
    }

    // Este código não deve ser alcançado se tudo estiver correto
    // Mas mantido como fallback de segurança
    const data = await prisma.professionalProfile.findMany({
      where: whereClause,
      include: {
        user: true,
        services: {
          include: { images: true, category: true },
        },
        categories: true,
        profession: true,
      },
    });

    // Mapear resposta
    const response = data.map((p) => {
    const hasOnlineServices = p.services.some(s => s.isOnline);
    const hasPresentialServices = p.services.some(s => s.isPresential);
    
    return {
      id: p.id,
      userId: p.userId,
      image: p.user.avatarUrl ?? '',
      coverImage: p.coverUrl ?? '',
      name: p.user.name,
      profession: p.profession?.name ?? 'Profissional',
      description: p.bio ?? '',
      radiusKm: p.radiusKm || 5,
      address: p.latitude != null && p.longitude != null
        ? {
            latitude: Number(p.latitude),
            longitude: Number(p.longitude),
            street: p.street ?? '',
            number: Number(p.number ?? 0),
            district: p.district ?? '',
            city: p.city ?? '',
            state: p.state ?? '',
            postalcode: p.postalcode ?? '',
            distanceInMeters: null,
          }
        : null,
      completedServicesCount: 0,
      ratingsAggregate: { avg: 0, count: 0 },
      hasOnlineServices,
      hasPresentialServices,
    };
  });
  
  return res.json(response);
  } catch (e: any) {
    console.error('Erro ao buscar profissionais:', e);
    return res.status(500).json({ message: 'Erro interno do servidor', error: e?.message });
  }
});

// Busca dados do perfil do profissional autenticado
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    const proProfile = await prisma.professionalProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: true, profession: true },
    });
    if (!proProfile) {
      // Cria perfil se não existir
      const newProfile = await prisma.professionalProfile.create({
        data: { userId: req.user.id },
        include: { user: true, profession: true },
      });
      return res.json({
        id: newProfile.id,
        bio: newProfile.bio || null,
        avatarUrl: newProfile.user.avatarUrl || null,
        coverUrl: newProfile.coverUrl || null,
        professionId: newProfile.professionId || null,
        radiusKm: newProfile.radiusKm || 5,
      });
    }
    return res.json({
      id: proProfile.id,
      bio: proProfile.bio || null,
      avatarUrl: proProfile.user.avatarUrl || null,
      coverUrl: proProfile.coverUrl || null,
      professionId: proProfile.professionId || null,
      radiusKm: proProfile.radiusKm || 5,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualiza bio do profissional autenticado
router.put('/me/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    const { bio, professionId } = req.body as { bio?: string; professionId?: string };
    const proProfile = await prisma.professionalProfile.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
    const updated = await prisma.professionalProfile.update({ 
      where: { id: proProfile.id }, 
      data: { 
        bio: bio ?? undefined,
        professionId: professionId ?? undefined,
      }, 
      include: { user: true, categories: true, profession: true } 
    });
    return res.json({ 
      id: updated.id, 
      bio: updated.bio,
      profession: updated.profession?.name || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualiza raio de atendimento do profissional autenticado
router.put('/me/radius', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    const { radiusKm } = req.body as { radiusKm?: number };
    if (radiusKm === undefined || radiusKm < 1 || radiusKm > 100) {
      return res.status(400).json({ message: 'Raio deve estar entre 1 e 100 km' });
    }
    const proProfile = await prisma.professionalProfile.upsert({ 
      where: { userId: req.user.id }, 
      update: {}, 
      create: { userId: req.user.id } 
    });
    const updated = await prisma.professionalProfile.update({ 
      where: { id: proProfile.id }, 
      data: { radiusKm }, 
      include: { user: true, profession: true } 
    });
    return res.json({ 
      id: updated.id, 
      radiusKm: updated.radiusKm,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Upload de avatar do usuário autenticado (PRO)
router.post('/me/avatar', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });
    const input = sharp(req.file.buffer);
    const meta = await input.metadata();
    // Reduz e comprime: largura máx 600px, jpeg 80%
    const processed = await input.rotate().resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const url = await uploadAvatarToS3(processed, 'image/jpeg');
    await prisma.user.update({ where: { id: req.user.id }, data: { avatarUrl: url } });
    return res.status(201).json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Upload de foto de capa do profissional
router.post('/me/cover', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });
    const input = sharp(req.file.buffer);
    // Foto de capa maior: largura máx 1200px
    const processed = await input.rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const url = await uploadAvatarToS3(processed, 'image/jpeg');
    const proProfile = await prisma.professionalProfile.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
    await prisma.professionalProfile.update({ where: { id: proProfile.id }, data: { coverUrl: url } });
    return res.status(201).json({ url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualiza endereço do profissional autenticado (PRO) via userId
router.put('/me/address', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais podem atualizar endereço' });

    const {
      latitude,
      longitude,
      street,
      number,
      district,
      city,
      state,
      postalcode,
    } = req.body as {
      latitude?: number;
      longitude?: number;
      street?: string;
      number?: string | number;
      district?: string;
      city?: string;
      state?: string;
      postalcode?: string;
    };

    // Garante que exista perfil do profissional
    const proProfile = await prisma.professionalProfile.upsert({
      where: { userId: req.user.id },
      update: {},
      create: { userId: req.user.id },
    });

    const updated = await prisma.professionalProfile.update({
      where: { id: proProfile.id },
      data: {
        latitude: latitude != null ? latitude : undefined,
        longitude: longitude != null ? longitude : undefined,
        street: street ?? undefined,
        number: number != null ? String(number) : undefined,
        district: district ?? undefined,
        city: city ?? undefined,
        state: state ?? undefined,
        postalcode: postalcode ?? undefined,
      },
      include: { user: true, categories: true, profession: true },
    });

    return res.json({
      id: updated.id,
      image: updated.user.avatarUrl ?? '',
      name: updated.user.name,
      profession: updated.profession?.name ?? 'Profissional',
      description: updated.bio ?? '',
      address: updated.latitude != null && updated.longitude != null
        ? {
            latitude: Number(updated.latitude),
            longitude: Number(updated.longitude),
            street: updated.street ?? '',
            number: Number(updated.number ?? 0),
            district: updated.district ?? '',
            city: updated.city ?? '',
            state: updated.state ?? '',
            postalcode: updated.postalcode ?? '',
            distanceInMeters: null,
          }
        : null,
      completedServicesCount: 0,
      ratingsAggregate: { avg: 0, count: 0 },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualiza endereço do profissional pelo ID do perfil profissional (não userId)
router.put('/:id/address', async (req, res) => {
  try {
    const id = req.params.id;
    const {
      latitude,
      longitude,
      street,
      number,
      district,
      city,
      state,
      postalcode,
    } = req.body as {
      latitude?: number;
      longitude?: number;
      street?: string;
      number?: string | number;
      district?: string;
      city?: string;
      state?: string;
      postalcode?: string;
    };

    const updated = await prisma.professionalProfile.update({
      where: { id },
      data: {
        latitude: latitude != null ? latitude : undefined,
        longitude: longitude != null ? longitude : undefined,
        street: street ?? undefined,
        number: number != null ? String(number) : undefined,
        district: district ?? undefined,
        city: city ?? undefined,
        state: state ?? undefined,
        postalcode: postalcode ?? undefined,
      },
      include: { user: true, categories: true, profession: true },
    });

    return res.json({
      id: updated.id,
      image: updated.user.avatarUrl ?? '',
      name: updated.user.name,
      profession: updated.profession?.name ?? 'Profissional',
      description: updated.bio ?? '',
      address: updated.latitude != null && updated.longitude != null
        ? {
            latitude: Number(updated.latitude),
            longitude: Number(updated.longitude),
            street: updated.street ?? '',
            number: Number(updated.number ?? 0),
            district: updated.district ?? '',
            city: updated.city ?? '',
            state: updated.state ?? '',
            postalcode: updated.postalcode ?? '',
            distanceInMeters: null,
          }
        : null,
      completedServicesCount: 0,
      ratingsAggregate: { avg: 0, count: 0 },
    });
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return res.status(404).json({ message: 'Professional not found' });
    }
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

router.get('/:id', async (req, res) => {
  const p = await prisma.professionalProfile.findUnique({
    where: { id: req.params.id },
    include: { user: true, profession: true, services: true },
  });
  if (!p) return res.status(404).json({ message: 'Professional not found' });
  const hasOnlineServices = p.services.some(s => s.isOnline);
  const hasPresentialServices = p.services.some(s => s.isPresential);
  const response = {
    id: p.id,
    userId: p.userId, // ✅ ID do User (para chat)
    image: p.user.avatarUrl ?? '',
    coverImage: p.coverUrl ?? '',
    name: p.user.name,
    profession: p.profession?.name ?? 'Profissional',
    description: p.bio ?? '',
    radiusKm: p.radiusKm || 5,
    address: p.latitude != null && p.longitude != null
      ? {
          latitude: Number(p.latitude),
          longitude: Number(p.longitude),
          street: p.street ?? '',
          number: Number(p.number ?? 0),
          district: p.district ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          postalcode: p.postalcode ?? '',
          distanceInMeters: null,
        }
      : null,
    completedServicesCount: 0,
    ratingsAggregate: { avg: 0, count: 0 },
    hasOnlineServices,
    hasPresentialServices,
  };
  return res.json(response);
});

router.get('/:id/services', async (req, res) => {
  const data = await prisma.service.findMany({
    where: { professionalId: req.params.id },
    include: { images: true, category: true },
  });
  return res.json(
    data.map((s) => ({
      id: s.id,
      name: s.title,
      professionalId: s.professionalId,
      category: s.category?.name ?? '',
      description: s.description,
      pricingType: s.pricingType,
      price: s.price ? Number(s.price) : null,
      isOnline: s.isOnline,
      isPresential: s.isPresential,
      images: s.images.map((i) => i.url),
    })),
  );
});

router.get('/:id/reviews', async (req, res) => {
  const data = await prisma.review.findMany({
    where: { toUserId: req.params.id },
    include: { fromUser: true, service: true },
  });
  return res.json(
    data.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      professionalId: req.params.id,
      rating: r.rating,
      description: r.comment,
      client: {
        id: r.fromUserId,
        name: r.fromUser.name,
        image: r.fromUser.avatarUrl ?? '',
      },
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;

import 'dotenv/config';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@server/index';
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

router.get('/', async (_req, res) => {
  const data = await prisma.professionalProfile.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      user: true,
      services: {
        include: { images: true, category: true },
      },
      categories: true,
    },
  });
  const response = data.map((p) => ({
    id: p.id,
    image: p.user.avatarUrl ?? '',
    coverImage: p.coverUrl ?? '',
    name: p.user.name,
    profession: p.categories?.[0]?.name ?? 'Profissional',
    description: p.bio ?? '',
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
  }));
  return res.json(response);
});

// Atualiza bio do profissional autenticado
router.put('/me/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais' });
    const { bio } = req.body as { bio?: string };
    const proProfile = await prisma.professionalProfile.upsert({ where: { userId: req.user.id }, update: {}, create: { userId: req.user.id } });
    const updated = await prisma.professionalProfile.update({ where: { id: proProfile.id }, data: { bio: bio ?? undefined }, include: { user: true, categories: true } });
    return res.json({ id: updated.id, bio: updated.bio });
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
      include: { user: true, categories: true },
    });

    return res.json({
      id: updated.id,
      image: updated.user.avatarUrl ?? '',
      name: updated.user.name,
      profession: updated.categories?.[0]?.name ?? 'Profissional',
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
      include: { user: true, categories: true },
    });

    return res.json({
      id: updated.id,
      image: updated.user.avatarUrl ?? '',
      name: updated.user.name,
      profession: updated.categories?.[0]?.name ?? 'Profissional',
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
    include: { user: true },
  });
  if (!p) return res.status(404).json({ message: 'Professional not found' });
  const response = {
    id: p.id,
    image: p.user.avatarUrl ?? '',
    coverImage: p.coverUrl ?? '',
    name: p.user.name,
    profession: 'Profissional',
    description: p.bio ?? '',
    address: {
      latitude: Number(p.latitude ?? 0),
      longitude: Number(p.longitude ?? 0),
      street: p.street ?? '',
      number: Number(p.number ?? 0),
      district: p.district ?? '',
      city: p.city ?? '',
      state: p.state ?? '',
      postalcode: p.postalcode ?? '',
      distanceInMeters: null,
    },
    completedServicesCount: 0,
    ratingsAggregate: { avg: 0, count: 0 },
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

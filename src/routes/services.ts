import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@server/index';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const router = Router();

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

// Upload infra (reutiliza o padrão do avatar)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

async function uploadServiceImageToS3(serviceId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'iuork-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `services/${serviceId}/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
  const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

router.get('/', async (_req, res) => {
  const data = await prisma.service.findMany({ include: { images: true, category: true } });
  return res.json(
    data.map((s) => ({
      id: s.id,
      professionalId: s.professionalId,
      name: s.title,
      category: s.category?.name ?? '',
      description: s.description,
      price: s.price ? Number(s.price) : null,
      images: s.images.map((i) => i.url),
    })),
  );
});

router.get('/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais podem listar seus serviços' });
  const proProfile = await prisma.professionalProfile.findUnique({ where: { userId: req.user.id } });
  if (!proProfile) {
    // Sem perfil ainda: retornar lista vazia
    return res.json([]);
  }
  const data = await prisma.service.findMany({ where: { professionalId: proProfile.id }, include: { images: true, category: true } });
  return res.json(
    data.map((s) => ({
      id: s.id,
      professionalId: s.professionalId,
      name: s.title,
      category: s.category?.name ?? '',
      description: s.description,
      price: s.price ? Number(s.price) : null,
      images: s.images.map((i) => i.url),
    })),
  );
});

router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais podem criar serviços' });
    const { title, description, pricingType, price, categoryId, images } = req.body as {
      title?: string;
      description?: string;
      pricingType?: 'FIXED' | 'HOURLY' | 'BUDGET';
      price?: number;
      categoryId?: string;
      images?: string[];
    };

    if (!title || !description) return res.status(400).json({ message: 'Título e descrição são obrigatórios' });
    // Garante que exista um ProfessionalProfile para o usuário PRO
    const proProfile = await prisma.professionalProfile.upsert({
      where: { userId: req.user.id },
      update: {},
      create: { userId: req.user.id },
    });

    const created = await prisma.service.create({
      data: {
        professionalId: proProfile.id,
        title,
        description,
        pricingType: (pricingType as any) ?? 'BUDGET',
        price: price ?? null,
        categoryId: categoryId ?? null,
        images: images && images.length ? { create: images.map((url) => ({ url })) } : undefined,
      },
      include: { images: true, category: true },
    });

    return res.status(201).json({
      id: created.id,
      professionalId: created.professionalId,
      name: created.title,
      category: created.category?.name ?? '',
      description: created.description,
      price: created.price ? Number(created.price) : null,
      images: created.images.map((i) => i.url),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

router.get('/:id', async (req, res) => {
  const s = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { images: true, category: true },
  });
  if (!s) return res.status(404).json({ message: 'Serviço não encontrado' });
  return res.json({
    id: s.id,
    professionalId: s.professionalId,
    name: s.title,
    category: s.category?.name ?? '',
    description: s.description,
    price: s.price ? Number(s.price) : null,
    images: s.images.map((i) => i.url),
  });
});

// Upload de uma ou mais imagens para um serviço do PRO autenticado
router.post('/:id/images', requireAuth, upload.array('files', 10), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') return res.status(403).json({ message: 'Somente profissionais podem enviar imagens' });
    const serviceId = req.params.id;
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || !files.length) return res.status(400).json({ message: 'Arquivo(s) não enviado(s)' });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return res.status(404).json({ message: 'Serviço não encontrado' });

    const proProfile = await prisma.professionalProfile.findUnique({ where: { userId: req.user.id } });
    if (!proProfile || proProfile.id !== service.professionalId) {
      return res.status(403).json({ message: 'Você não tem permissão para alterar este serviço' });
    }

    // Processa e envia todas as imagens
    const urls: string[] = [];
    for (const file of files) {
      const input = sharp(file.buffer);
      const processed = await input.rotate().resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
      const url = await uploadServiceImageToS3(serviceId, processed, 'image/jpeg');
      urls.push(url);
    }

    // Persiste no banco
    await prisma.service.update({
      where: { id: serviceId },
      data: {
        images: { create: urls.map((url) => ({ url })) },
      },
    });

    return res.status(201).json({ images: urls });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

export default router;

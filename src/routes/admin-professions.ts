import { Router } from 'express';
import { prisma } from '@server/index';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

async function uploadProfessionImageToS3(professionId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'iuork-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `professions/${professionId}/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
  const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

// GET /admin/professions - Listar todas as profissões
router.get('/', async (_req, res) => {
  try {
    const professions = await prisma.profession.findMany({
      include: {
        category: true,
        professionals: {
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(professions.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      categoryId: p.categoryId,
      categoryName: p.category?.name || null,
      professionalsCount: p.professionals.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })));
  } catch (error) {
    console.error('Erro ao buscar profissões:', error);
    return res.status(500).json({ message: 'Erro ao buscar profissões' });
  }
});

// POST /admin/professions - Criar profissão
router.post('/', async (req, res) => {
  try {
    const { name, categoryId } = req.body as { name?: string; categoryId?: string | null };

    if (!name) {
      return res.status(400).json({ message: 'Nome é obrigatório' });
    }

    // Verificar se já existe profissão com esse nome
    const existing = await prisma.profession.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma profissão com esse nome' });
    }

    // Verificar se a categoria existe se fornecida
    if (categoryId) {
      const category = await prisma.professionCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(404).json({ message: 'Categoria não encontrada' });
      }
    }

    const profession = await prisma.profession.create({
      data: {
        name,
        categoryId: categoryId || null,
      },
      include: {
        category: true,
      },
    });

    return res.status(201).json({
      id: profession.id,
      name: profession.name,
      imageUrl: profession.imageUrl,
      categoryId: profession.categoryId,
      categoryName: profession.category?.name || null,
    });
  } catch (error) {
    console.error('Erro ao criar profissão:', error);
    return res.status(500).json({ message: 'Erro ao criar profissão' });
  }
});

// PUT /admin/professions/:id - Atualizar profissão
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId } = req.body as { name?: string; categoryId?: string | null };

    const profession = await prisma.profession.findUnique({ where: { id } });
    if (!profession) {
      return res.status(404).json({ message: 'Profissão não encontrada' });
    }

    // Verificar se já existe outra profissão com esse nome
    if (name && name !== profession.name) {
      const existing = await prisma.profession.findUnique({ where: { name } });
      if (existing) {
        return res.status(400).json({ message: 'Já existe uma profissão com esse nome' });
      }
    }

    // Verificar se a categoria existe se fornecida
    if (categoryId !== undefined && categoryId !== null) {
      const category = await prisma.professionCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(404).json({ message: 'Categoria não encontrada' });
      }
    }

    const updated = await prisma.profession.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: {
        category: true,
      },
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      imageUrl: updated.imageUrl,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name || null,
    });
  } catch (error) {
    console.error('Erro ao atualizar profissão:', error);
    return res.status(500).json({ message: 'Erro ao atualizar profissão' });
  }
});

// POST /admin/professions/:id/image - Upload de imagem da profissão
router.post('/:id/image', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const profession = await prisma.profession.findUnique({ where: { id } });
    if (!profession) {
      return res.status(404).json({ message: 'Profissão não encontrada' });
    }

    // Processa e envia a imagem
    const input = sharp(file.buffer);
    const processed = await input.rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const url = await uploadProfessionImageToS3(id, processed, 'image/jpeg');

    // Atualiza a profissão com a URL da imagem
    const updated = await prisma.profession.update({
      where: { id },
      data: { imageUrl: url },
    });

    return res.status(201).json({ imageUrl: updated.imageUrl });
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    return res.status(500).json({ message: 'Erro ao fazer upload da imagem' });
  }
});

// PUT /admin/professions/:id/move-category - Mover profissão para outra categoria
router.put('/:id/move-category', async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId } = req.body as { categoryId?: string | null };

    const profession = await prisma.profession.findUnique({ where: { id } });
    if (!profession) {
      return res.status(404).json({ message: 'Profissão não encontrada' });
    }

    // Verificar se a categoria existe se fornecida
    if (categoryId !== null && categoryId !== undefined) {
      const category = await prisma.professionCategory.findUnique({ where: { id: categoryId } });
      if (!category) {
        return res.status(404).json({ message: 'Categoria não encontrada' });
      }
    }

    const updated = await prisma.profession.update({
      where: { id },
      data: {
        categoryId: categoryId || null,
      },
      include: {
        category: true,
      },
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name || null,
      message: 'Profissão movida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao mover profissão:', error);
    return res.status(500).json({ message: 'Erro ao mover profissão' });
  }
});

// DELETE /admin/professions/:id - Deletar profissão
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profession = await prisma.profession.findUnique({
      where: { id },
      include: {
        professionals: true,
      },
    });

    if (!profession) {
      return res.status(404).json({ message: 'Profissão não encontrada' });
    }

    if (profession.professionals.length > 0) {
      return res.status(400).json({ message: 'Não é possível deletar profissão com profissionais associados' });
    }

    await prisma.profession.delete({ where: { id } });

    return res.json({ message: 'Profissão deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar profissão:', error);
    return res.status(500).json({ message: 'Erro ao deletar profissão' });
  }
});

export default router;


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

async function uploadCategoryImageToS3(categoryId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'iuork-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `profession-categories/${categoryId}/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
  const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /admin/profession-categories - Listar todas as categorias de profissão
router.get('/', async (req, res) => {
  try {
    const includeProfessions = req.query.includeProfessions === 'true';
    
    const categories = await prisma.professionCategory.findMany({
      include: {
        professions: includeProfessions
          ? {
              orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
            }
          : {
              select: { id: true },
            },
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
    
    if (includeProfessions) {
      return res.json(categories);
    }
    
    return res.json(categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      icon: c.icon,
      color: c.color,
      imageUrl: c.imageUrl,
      orderIndex: c.orderIndex,
      professionsCount: c.professions.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })));
  } catch (error) {
    console.error('Erro ao buscar categorias de profissão:', error);
    return res.status(500).json({ message: 'Erro ao buscar categorias de profissão' });
  }
});

// POST /admin/profession-categories - Criar categoria de profissão
router.post('/', async (req, res) => {
  try {
    const { name, icon, color } = req.body as { name?: string; icon?: string; color?: string };

    if (!name) {
      return res.status(400).json({ message: 'Nome é obrigatório' });
    }

    // Verificar se já existe categoria com esse nome
    const existing = await prisma.professionCategory.findUnique({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma categoria com esse nome' });
    }

    const slug = generateSlug(name);

    // Verificar se já existe categoria com esse slug
    const existingSlug = await prisma.professionCategory.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ message: 'Já existe uma categoria com esse slug' });
    }

    // Obter o maior orderIndex e adicionar 1
    const maxOrder = await prisma.professionCategory.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    const orderIndex = (maxOrder?.orderIndex ?? -1) + 1;

    const category = await prisma.professionCategory.create({
      data: {
        name,
        slug,
        icon: icon || null,
        color: color || null,
        orderIndex,
      },
    });

    return res.status(201).json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      icon: category.icon,
      color: category.color,
      imageUrl: category.imageUrl,
    });
  } catch (error) {
    console.error('Erro ao criar categoria de profissão:', error);
    return res.status(500).json({ message: 'Erro ao criar categoria de profissão' });
  }
});

// PUT /admin/profession-categories/reorder - Reordenar categorias (DEVE VIR ANTES DE /:id)
router.put('/reorder', async (req, res) => {
  try {
    const { items } = req.body as { items: Array<{ id: string; orderIndex: number }> };

    console.log('Recebendo reordenação de categorias:', items);

    if (!Array.isArray(items)) {
      return res.status(400).json({ message: 'Items deve ser um array' });
    }

    if (items.length === 0) {
      return res.status(400).json({ message: 'Items não pode estar vazio' });
    }

    // Verificar se todos os IDs existem
    const ids = items.map(item => item.id);
    const existingCategories = await prisma.professionCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    console.log('IDs encontrados:', existingCategories.map(c => c.id));
    console.log('IDs esperados:', ids);

    if (existingCategories.length !== items.length) {
      const missingIds = ids.filter(id => !existingCategories.find(c => c.id === id));
      return res.status(400).json({ 
        message: `Categorias não encontradas: ${missingIds.join(', ')}` 
      });
    }

    // Atualizar ordem de todas as categorias em uma transação
    const updates = await Promise.all(
      items.map((item) =>
        prisma.professionCategory.update({
          where: { id: item.id },
          data: { orderIndex: item.orderIndex },
          select: { id: true, orderIndex: true },
        })
      )
    );

    console.log('Categorias atualizadas:', updates.map(c => ({ id: c.id, orderIndex: c.orderIndex })));

    // Retornar os dados atualizados ordenados
    const sortedUpdates = updates.sort((a, b) => a.orderIndex - b.orderIndex);

    return res.json({ 
      message: 'Ordem atualizada com sucesso',
      categories: sortedUpdates 
    });
  } catch (error: any) {
    console.error('Erro ao reordenar categorias:', error);
    return res.status(500).json({ 
      message: 'Erro ao reordenar categorias',
      error: error.message 
    });
  }
});

// PUT /admin/profession-categories/:id - Atualizar categoria de profissão
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body as { name?: string; icon?: string; color?: string };

    const category = await prisma.professionCategory.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' });
    }

    // Verificar se já existe outra categoria com esse nome
    if (name && name !== category.name) {
      const existing = await prisma.professionCategory.findUnique({ where: { name } });
      if (existing) {
        return res.status(400).json({ message: 'Já existe uma categoria com esse nome' });
      }
    }

    const slug = name ? generateSlug(name) : category.slug;

    // Verificar se já existe outra categoria com esse slug
    if (slug !== category.slug) {
      const existingSlug = await prisma.professionCategory.findUnique({ where: { slug } });
      if (existingSlug) {
        return res.status(400).json({ message: 'Já existe uma categoria com esse slug' });
      }
    }

    const updated = await prisma.professionCategory.update({
      where: { id },
      data: {
        ...(name && { name, slug }),
        ...(icon !== undefined && { icon: icon || null }),
        ...(color !== undefined && { color: color || null }),
        ...(req.body.orderIndex !== undefined && { orderIndex: req.body.orderIndex }),
      },
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      icon: updated.icon,
      color: updated.color,
      imageUrl: updated.imageUrl,
    });
  } catch (error) {
    console.error('Erro ao atualizar categoria de profissão:', error);
    return res.status(500).json({ message: 'Erro ao atualizar categoria de profissão' });
  }
});

// POST /admin/profession-categories/:id/image - Upload de imagem da categoria
router.post('/:id/image', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const file = (req as any).file as Express.Multer.File | undefined;

    if (!file) {
      return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const category = await prisma.professionCategory.findUnique({ where: { id } });
    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' });
    }

    // Processa e envia a imagem
    const input = sharp(file.buffer);
    const processed = await input.rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    const url = await uploadCategoryImageToS3(id, processed, 'image/jpeg');

    // Atualiza a categoria com a URL da imagem
    const updated = await prisma.professionCategory.update({
      where: { id },
      data: { imageUrl: url },
    });

    return res.status(201).json({ imageUrl: updated.imageUrl });
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    return res.status(500).json({ message: 'Erro ao fazer upload da imagem' });
  }
});

// DELETE /admin/profession-categories/:id - Deletar categoria de profissão
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await prisma.professionCategory.findUnique({
      where: { id },
      include: {
        professions: true,
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' });
    }

    if (category.professions.length > 0) {
      return res.status(400).json({ message: 'Não é possível deletar categoria com profissões associadas' });
    }

    await prisma.professionCategory.delete({ where: { id } });

    return res.json({ message: 'Categoria deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar categoria:', error);
    return res.status(500).json({ message: 'Erro ao deletar categoria' });
  }
});

export default router;


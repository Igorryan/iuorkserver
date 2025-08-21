import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

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

router.get('/:id', async (req, res) => {
  const s = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { images: true, category: true },
  });
  if (!s) return res.status(404).json({ message: 'Service not found' });
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

export default router;

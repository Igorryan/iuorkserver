import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

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
    },
  });
  const response = data.map((p) => ({
    id: p.id,
    image: p.user.avatarUrl ?? '',
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

router.get('/:id', async (req, res) => {
  const p = await prisma.professionalProfile.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!p) return res.status(404).json({ message: 'Professional not found' });
  const response = {
    id: p.id,
    image: p.user.avatarUrl ?? '',
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

import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (req, res) => {
  const { serviceId } = req.query as { serviceId?: string };
  const data = await prisma.review.findMany({
    where: { serviceId: serviceId || undefined },
    include: { fromUser: true },
  });
  return res.json(
    data.map((r) => ({
      id: r.id,
      serviceId: r.serviceId,
      professionalId: r.toUserId,
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

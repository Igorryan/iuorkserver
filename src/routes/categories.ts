import { Router } from 'express';
import { prisma } from '../index';

const router = Router();

router.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  return res.json(categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId })));
});

export default router;



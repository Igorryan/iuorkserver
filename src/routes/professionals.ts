import { Router } from 'express';
import { professionals, services, reviews } from '../data/mock';

const router = Router();

router.get('/', (_req, res) => {
  return res.json(professionals);
});

router.get('/:id', (req, res) => {
  const professional = professionals.find((p) => p.id === req.params.id);
  if (!professional) return res.status(404).json({ message: 'Professional not found' });
  return res.json(professional);
});

router.get('/:id/services', (req, res) => {
  const data = services.filter((s) => s.professionalId === req.params.id);
  return res.json(data);
});

router.get('/:id/reviews', (req, res) => {
  const data = reviews.filter((r) => r.professionalId === req.params.id);
  return res.json(data);
});

export default router;

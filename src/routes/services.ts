import { Router } from 'express';
import { services } from '../data/mock';

const router = Router();

router.get('/', (_req, res) => {
  return res.json(services);
});

router.get('/:id', (req, res) => {
  const service = services.find((s) => s.id === req.params.id);
  if (!service) return res.status(404).json({ message: 'Service not found' });
  return res.json(service);
});

export default router;

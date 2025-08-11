import { Router } from 'express';
import { reviews } from '../data/mock';

const router = Router();

router.get('/', (req, res) => {
  const { serviceId } = req.query as { serviceId?: string };
  if (serviceId) {
    return res.json(reviews.filter((r) => r.serviceId === serviceId));
  }
  return res.json(reviews);
});

export default router;

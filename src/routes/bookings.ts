import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

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

// Lista pedidos do usuário autenticado
router.get('/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  const where = req.user?.role === 'PRO' ? { professionalId: req.user!.id } : { clientId: req.user!.id };

  // A tabela Booking referencia userIds diretamente
  const bookings = await prisma.booking.findMany({
    where,
    include: { service: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    bookings.map((b) => ({
      id: b.id,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
      service: {
        id: b.serviceId,
        title: b.service.title,
      },
    })),
  );
});

export default router;




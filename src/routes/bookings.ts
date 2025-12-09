import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '@server/index';
import { Prisma } from '@prisma/client';
import { getIO } from '@server/socket';

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

// Criar novo agendamento
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'CLIENT') {
      return res.status(403).json({ message: 'Somente clientes podem criar agendamentos' });
    }

    const { professionalId, serviceId, scheduledAt, latitude, longitude, address } = req.body;

    if (!professionalId || !serviceId || !scheduledAt) {
      return res.status(400).json({ message: 'professionalId, serviceId e scheduledAt são obrigatórios' });
    }

    // Verificar se o serviço existe
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return res.status(404).json({ message: 'Serviço não encontrado' });
    }

    // Buscar informações do cliente
    const client = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!client) {
      return res.status(404).json({ message: 'Cliente não encontrado' });
    }

    // Criar o agendamento (oferta de serviço)
    const booking = await prisma.booking.create({
      data: {
        clientId: req.user.id,
        professionalId,
        serviceId,
        scheduledAt: new Date(scheduledAt),
        latitude: latitude ? new Prisma.Decimal(latitude) : null,
        longitude: longitude ? new Prisma.Decimal(longitude) : null,
        address: address || null,
        status: 'REQUESTED',
      },
      include: {
        service: {
          include: {
            professional: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para o profissional sobre a nova oferta
    try {
      const io = getIO();
      io.to(`professional:${professionalId}`).emit('new-booking-offer', {
        id: booking.id,
        client: booking.client,
        service: {
          id: booking.service.id,
          title: booking.service.title,
          description: booking.service.description,
          price: booking.service.price.toString(),
          pricingType: booking.service.pricingType,
        },
        scheduledAt: booking.scheduledAt?.toISOString(),
        address: booking.address,
        latitude: booking.latitude?.toString(),
        longitude: booking.longitude?.toString(),
        createdAt: booking.createdAt.toISOString(),
      });
    } catch (error) {
      console.error('Erro ao emitir evento WebSocket:', error);
    }

    return res.status(201).json({
      id: booking.id,
      status: booking.status,
      createdAt: booking.createdAt.toISOString(),
      scheduledAt: booking.scheduledAt ? booking.scheduledAt.toISOString() : null,
      address: booking.address,
      latitude: booking.latitude?.toString(),
      longitude: booking.longitude?.toString(),
      service: {
        id: booking.serviceId,
        title: booking.service.title,
        description: booking.service.description,
        price: booking.service.price.toString(),
        pricingType: booking.service.pricingType,
      },
      client: booking.client,
    });
  } catch (e: any) {
    console.error('Erro ao criar agendamento:', e);
    return res.status(500).json({ message: 'Erro interno do servidor', error: e?.message });
  }
});

// Lista pedidos do usuário autenticado
router.get('/mine', requireAuth, async (req: AuthenticatedRequest, res) => {
  const where = req.user?.role === 'PRO' ? { professionalId: req.user!.id } : { clientId: req.user!.id };

  // A tabela Booking referencia userIds diretamente
  const bookings = await prisma.booking.findMany({
    where,
    include: { 
      service: {
        include: {
          professional: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(
    bookings.map((b) => ({
      id: b.id,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
      address: b.address,
      latitude: b.latitude?.toString(),
      longitude: b.longitude?.toString(),
      service: {
        id: b.serviceId,
        title: b.service.title,
        description: b.service.description,
        price: b.service.price.toString(),
        pricingType: b.service.pricingType,
      },
      client: b.client,
      professional: req.user?.role === 'CLIENT' ? {
        id: b.service.professional.user.id,
        name: b.service.professional.user.name,
        avatarUrl: b.service.professional.user.avatarUrl,
      } : undefined,
    })),
  );
});

// GET /bookings/pending - Listar ofertas pendentes para o profissional
router.get('/pending', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') {
      return res.status(403).json({ message: 'Somente profissionais podem ver ofertas pendentes' });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        professionalId: req.user.id,
        status: 'REQUESTED',
      },
      include: {
        service: {
          include: {
            professional: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(
      bookings.map((b) => ({
        id: b.id,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
        scheduledAt: b.scheduledAt ? b.scheduledAt.toISOString() : null,
        address: b.address,
        latitude: b.latitude?.toString(),
        longitude: b.longitude?.toString(),
        service: {
          id: b.serviceId,
          title: b.service.title,
          description: b.service.description,
          price: b.service.price.toString(),
          pricingType: b.service.pricingType,
        },
        client: b.client,
      })),
    );
  } catch (e: any) {
    console.error('Erro ao buscar ofertas pendentes:', e);
    return res.status(500).json({ message: 'Erro interno do servidor', error: e?.message });
  }
});

// PUT /bookings/:id/accept - Aceitar oferta de serviço
router.put('/:id/accept', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') {
      return res.status(403).json({ message: 'Somente profissionais podem aceitar ofertas' });
    }

    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
        service: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Oferta não encontrada' });
    }

    if (booking.professionalId !== req.user.id) {
      return res.status(403).json({ message: 'Você não tem permissão para aceitar esta oferta' });
    }

    if (booking.status !== 'REQUESTED') {
      return res.status(400).json({ message: 'Esta oferta já foi processada' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
      },
      include: {
        service: {
          include: {
            professional: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para o cliente
    try {
      const io = getIO();
      io.to(`client:${booking.clientId}`).emit('booking-accepted', {
        id: updatedBooking.id,
        status: updatedBooking.status,
        scheduledAt: updatedBooking.scheduledAt?.toISOString(),
      });
    } catch (error) {
      console.error('Erro ao emitir evento WebSocket:', error);
    }

    return res.json({
      id: updatedBooking.id,
      status: updatedBooking.status,
      createdAt: updatedBooking.createdAt.toISOString(),
      scheduledAt: updatedBooking.scheduledAt ? updatedBooking.scheduledAt.toISOString() : null,
      address: updatedBooking.address,
      latitude: updatedBooking.latitude?.toString(),
      longitude: updatedBooking.longitude?.toString(),
      service: {
        id: updatedBooking.serviceId,
        title: updatedBooking.service.title,
        description: updatedBooking.service.description,
        price: updatedBooking.service.price.toString(),
        pricingType: updatedBooking.service.pricingType,
      },
      client: updatedBooking.client,
    });
  } catch (e: any) {
    console.error('Erro ao aceitar oferta:', e);
    return res.status(500).json({ message: 'Erro interno do servidor', error: e?.message });
  }
});

// PUT /bookings/:id/reject - Recusar oferta de serviço
router.put('/:id/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== 'PRO') {
      return res.status(403).json({ message: 'Somente profissionais podem recusar ofertas' });
    }

    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Oferta não encontrada' });
    }

    if (booking.professionalId !== req.user.id) {
      return res.status(403).json({ message: 'Você não tem permissão para recusar esta oferta' });
    }

    if (booking.status !== 'REQUESTED') {
      return res.status(400).json({ message: 'Esta oferta já foi processada' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        service: {
          include: {
            professional: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Emitir evento WebSocket para o cliente
    try {
      const io = getIO();
      io.to(`client:${booking.clientId}`).emit('booking-rejected', {
        id: updatedBooking.id,
        status: updatedBooking.status,
      });
    } catch (error) {
      console.error('Erro ao emitir evento WebSocket:', error);
    }

    return res.json({
      id: updatedBooking.id,
      status: updatedBooking.status,
      createdAt: updatedBooking.createdAt.toISOString(),
      scheduledAt: updatedBooking.scheduledAt ? updatedBooking.scheduledAt.toISOString() : null,
      address: updatedBooking.address,
      latitude: updatedBooking.latitude?.toString(),
      longitude: updatedBooking.longitude?.toString(),
      service: {
        id: updatedBooking.serviceId,
        title: updatedBooking.service.title,
        description: updatedBooking.service.description,
        price: updatedBooking.service.price.toString(),
        pricingType: updatedBooking.service.pricingType,
      },
      client: updatedBooking.client,
    });
  } catch (e: any) {
    console.error('Erro ao recusar oferta:', e);
    return res.status(500).json({ message: 'Erro interno do servidor', error: e?.message });
  }
});

export default router;




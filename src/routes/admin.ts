import { Router } from 'express';
import { prisma } from '@server/index';

const router = Router();

// GET /admin/users - Listar todos os usuários
router.get('/users', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        professionalProfile: {
          select: {
            id: true,
            bio: true,
            city: true,
            state: true,
            services: {
              select: {
                id: true,
              },
            },
            categories: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      isProfessional: !!user.professionalProfile,
      profession: user.professionalProfile?.categories?.[0]?.name || null,
      servicesCount: user.professionalProfile?.services?.length || 0,
      location: user.professionalProfile?.city && user.professionalProfile?.state
        ? `${user.professionalProfile.city}, ${user.professionalProfile.state}`
        : null,
    }));

    return res.json(formattedUsers);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return res.status(500).json({ message: 'Erro ao buscar usuários' });
  }
});

// GET /admin/professionals - Listar todos os profissionais com detalhes
router.get('/professionals', async (_req, res) => {
  try {
    const professionals = await prisma.professionalProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        services: {
          select: {
            id: true,
            title: true,
          },
        },
        profession: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedProfessionals = professionals.map((pro) => ({
      id: pro.id,
      userId: pro.userId,
      name: pro.user.name,
      email: pro.user.email,
      profession: pro.profession?.name || 'Profissional',
      bio: pro.bio,
      avatarUrl: pro.user.avatarUrl,
      coverUrl: pro.coverUrl,
      city: pro.city,
      state: pro.state,
      street: pro.street,
      number: pro.number,
      district: pro.district,
      postalcode: pro.postalcode,
      createdAt: pro.createdAt,
      servicesCount: pro.services.length,
      services: pro.services.map((s) => ({ id: s.id, title: s.title })),
    }));

    return res.json(formattedProfessionals);
  } catch (error) {
    console.error('Erro ao buscar profissionais:', error);
    return res.status(500).json({ message: 'Erro ao buscar profissionais' });
  }
});

// GET /admin/stats - Estatísticas gerais
router.get('/stats', async (_req, res) => {
  try {
    const [totalUsers, totalClients, totalProfessionals, totalServices, totalChats] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'PRO' } }),
      prisma.service.count(),
      prisma.chat.count(),
    ]);

    return res.json({
      totalUsers,
      totalClients,
      totalProfessionals,
      totalServices,
      totalChats,
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return res.status(500).json({ message: 'Erro ao buscar estatísticas' });
  }
});

// DELETE /admin/users/:id - Remover usuário
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Deletar relacionamentos que não têm cascade configurado
    // 1. Deletar chats onde o usuário é cliente ou profissional
    await prisma.chat.deleteMany({
      where: {
        OR: [
          { clientId: id },
          { professionalId: id },
        ],
      },
    });

    // 2. Deletar mensagens do usuário
    await prisma.message.deleteMany({
      where: {
        senderId: id,
      },
    });

    // 3. Deletar bookings onde o usuário é cliente ou profissional
    await prisma.booking.deleteMany({
      where: {
        OR: [
          { clientId: id },
          { professionalId: id },
        ],
      },
    });

    // 4. Deletar reviews onde o usuário é autor ou destinatário
    await prisma.review.deleteMany({
      where: {
        OR: [
          { fromUserId: id },
          { toUserId: id },
        ],
      },
    });

    // 5. Deletar o perfil profissional se existir (isso deleta serviços em cascata)
    if (user.role === 'PRO') {
      await prisma.professionalProfile.deleteMany({
        where: {
          userId: id,
        },
      });
    }

    // 6. Finalmente, deletar o usuário
    await prisma.user.delete({
      where: { id },
    });

    return res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return res.status(500).json({ message: 'Erro ao remover usuário' });
  }
});

export default router;


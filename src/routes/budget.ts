import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getIO, SocketEvents } from '../socket';

const router = Router();
const prisma = new PrismaClient();

// Criar orçamento (ou atualizar se já existe uma solicitação pendente)
router.post('/budgets', async (req: Request, res: Response) => {
  try {
    const { chatId, serviceId, price, description } = req.body;

    console.log(`📋 [POST /budgets] Recebendo orçamento:`, { chatId, serviceId, price, description });

    if (!chatId || !serviceId || !price) {
      return res.status(400).json({ error: 'chatId, serviceId e price são obrigatórios' });
    }

    // Verificar se o chat existe
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        client: {
          select: { id: true, name: true, avatarUrl: true },
        },
        professional: {
          select: { id: true, name: true, avatarUrl: true },
        },
        service: {
          select: { id: true, title: true },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat não encontrado' });
    }

    // Verificar se já existe um orçamento para este chat
    const existingBudget = await prisma.budget.findUnique({
      where: {
        chatId,
      },
    });

    let budget;

    if (existingBudget) {
      // Atualizar o orçamento existente com o preço definido e mudar status para ACCEPTED
      budget = await prisma.budget.update({
        where: { id: existingBudget.id },
        data: {
          price,
          description,
          status: 'ACCEPTED', // Status ACCEPTED automaticamente quando profissional define o preço
        },
      });

      console.log(`💰 Orçamento atualizado para ACCEPTED: ${budget.id} - R$ ${price}`);
    } else {
      // Criar novo orçamento com data de expiração (7 dias) e status ACCEPTED
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      budget = await prisma.budget.create({
        data: {
          chatId,
          serviceId,
          price,
          description,
          status: 'ACCEPTED', // Status ACCEPTED automaticamente quando profissional define o preço
          expiresAt,
        },
      });

      console.log(`💰 Orçamento criado com status ACCEPTED: ${budget.id} - R$ ${price}`);
    }

    // Emitir evento via WebSocket para notificar o cliente
    try {
      const io = getIO();
      
      // Notificar o cliente sobre o novo orçamento ou atualização
      io.to(`client:${chat.clientId}`).emit('new-budget', {
        budgetId: budget.id,
        chatId,
        serviceId,
        serviceName: chat.service?.title || 'Serviço',
        price: budget.price.toString(),
        description: budget.description,
        professionalName: chat.professional.name,
        expiresAt: budget.expiresAt,
      });

      console.log(`📤 Evento new-budget emitido para cliente: ${chat.clientId}`);
    } catch (error) {
      console.error('Erro ao emitir evento new-budget:', error);
    }

    return res.status(existingBudget ? 200 : 201).json(budget);
  } catch (error) {
    console.error('Erro ao criar/atualizar orçamento:', error);
    return res.status(500).json({ error: 'Erro ao criar/atualizar orçamento' });
  }
});

// Criar solicitação de orçamento (PENDING) - Usado quando cliente solicita orçamento
router.post('/budgets/request', async (req: Request, res: Response) => {
  try {
    const { clientId, professionalId, serviceId } = req.body;

    if (!clientId || !professionalId || !serviceId) {
      return res.status(400).json({ error: 'clientId, professionalId e serviceId são obrigatórios' });
    }

    // Verificar se já existe uma solicitação pendente para este serviço entre cliente e profissional
    const existingRequest = await prisma.budget.findFirst({
      where: {
        serviceId,
        status: 'PENDING',
        chat: {
          clientId,
          professionalId,
        },
      },
      include: {
        chat: {
          include: {
            client: {
              select: { id: true, name: true, avatarUrl: true },
            },
            professional: {
              select: { id: true, name: true, avatarUrl: true },
            },
            service: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (existingRequest) {
      // Se já existe, retorna o existente ao invés de criar duplicado
      console.log(`♻️  Orçamento PENDING já existe: ${existingRequest.id} - retornando existente`);
      return res.json(existingRequest);
    }

    // Verificar se existe um chat anterior entre cliente/profissional para este serviço
    const existingChat = await prisma.chat.findFirst({
      where: {
        clientId,
        professionalId,
        serviceId,
      },
      include: {
        budget: true,
      },
    });

    let chat = existingChat;
    let budgetRequest;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (existingChat && existingChat.budget) {
      // ✅ Chat já existe com budget - ATUALIZAR o budget existente para PENDING
      console.log(`♻️  Reutilizando chat existente: ${existingChat.id} - atualizando budget`);
      
      budgetRequest = await prisma.budget.update({
        where: { id: existingChat.budget.id },
        data: {
          status: 'PENDING',
          price: '0',
          description: 'Solicitação de orçamento',
          expiresAt,
        },
        include: {
          chat: {
            include: {
              client: {
                select: { id: true, name: true, avatarUrl: true },
              },
              professional: {
                select: { id: true, name: true, avatarUrl: true },
              },
              service: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      // Atualizar lastMessageAt do chat
      await prisma.chat.update({
        where: { id: existingChat.id },
        data: { lastMessageAt: new Date() },
      });

      console.log(`📝 Budget atualizado para PENDING: ${budgetRequest.id}`);

      // Emitir evento de atualização para o profissional
      try {
        const io = getIO();
        io.to(`professional:${professionalId}`).emit('chat-list-update', {
          chatId: existingChat.id,
          budget: {
            id: budgetRequest.id,
            status: 'PENDING',
            price: '0',
            description: budgetRequest.description,
            expiresAt: budgetRequest.expiresAt,
          },
        });
        
        console.log(`📤 Evento chat-list-update emitido para profissional: ${professionalId}`);
      } catch (error) {
        console.error('Erro ao emitir evento chat-list-update:', error);
      }

    } else if (existingChat) {
      // ✅ Chat existe mas sem budget - CRIAR novo budget
      console.log(`♻️  Reutilizando chat existente: ${existingChat.id} - criando novo budget`);
      
      budgetRequest = await prisma.budget.create({
        data: {
          chatId: existingChat.id,
          serviceId,
          price: '0',
          description: 'Solicitação de orçamento',
          status: 'PENDING',
          expiresAt,
        },
        include: {
          chat: {
            include: {
              client: {
                select: { id: true, name: true, avatarUrl: true },
              },
              professional: {
                select: { id: true, name: true, avatarUrl: true },
              },
              service: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      // Atualizar lastMessageAt do chat
      await prisma.chat.update({
        where: { id: existingChat.id },
        data: { lastMessageAt: new Date() },
      });

      console.log(`📝 Budget criado no chat existente: ${budgetRequest.id}`);

      // Emitir evento de atualização para o profissional
      try {
        const io = getIO();
        io.to(`professional:${professionalId}`).emit('chat-list-update', {
          chatId: existingChat.id,
          budget: {
            id: budgetRequest.id,
            status: 'PENDING',
            price: '0',
            description: budgetRequest.description,
            expiresAt: budgetRequest.expiresAt,
          },
        });
        
        console.log(`📤 Evento chat-list-update emitido para profissional: ${professionalId}`);
      } catch (error) {
        console.error('Erro ao emitir evento chat-list-update:', error);
      }

    } else {
      // ✅ Primeira vez - CRIAR novo chat E budget
      console.log(`🆕 Criando novo chat e budget`);
      
      chat = await prisma.chat.create({
        data: {
          clientId,
          professionalId,
          serviceId,
        },
      });

      budgetRequest = await prisma.budget.create({
        data: {
          chatId: chat.id,
          serviceId,
          price: '0',
          description: 'Solicitação de orçamento',
          status: 'PENDING',
          expiresAt,
        },
        include: {
          chat: {
            include: {
              client: {
                select: { id: true, name: true, avatarUrl: true },
              },
              professional: {
                select: { id: true, name: true, avatarUrl: true },
              },
              service: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      console.log(`📝 Novo orçamento criado: ${budgetRequest.id} com chat dedicado: ${chat.id}`);

      // Emitir evento para o profissional sobre o novo chat/orçamento
      try {
        const io = getIO();
        io.to(`professional:${professionalId}`).emit(SocketEvents.NEW_CHAT, {
          id: chat.id,
          clientId,
          professionalId,
          serviceId,
          lastMessageAt: chat.lastMessageAt,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          client: budgetRequest.chat.client,
          service: budgetRequest.chat.service,
          budget: {
            id: budgetRequest.id,
            status: budgetRequest.status,
            price: budgetRequest.price.toString(),
            description: budgetRequest.description,
            expiresAt: budgetRequest.expiresAt,
          },
          messages: [],
          _count: { messages: 0 },
        });
        
        console.log(`📤 Evento NEW_CHAT emitido para profissional: ${professionalId}`);
      } catch (error) {
        console.error('Erro ao emitir evento NEW_CHAT:', error);
      }
    }

    return res.status(201).json(budgetRequest);
  } catch (error) {
    console.error('Erro ao criar solicitação de orçamento:', error);
    return res.status(500).json({ error: 'Erro ao criar solicitação de orçamento' });
  }
});

// Buscar orçamentos de um chat
router.get('/chats/:chatId/budgets', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { status } = req.query;

    const where: any = { chatId };
    if (status) {
      where.status = status;
    }

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(budgets);
  } catch (error) {
    console.error('Erro ao buscar orçamentos:', error);
    return res.status(500).json({ error: 'Erro ao buscar orçamentos' });
  }
});

// Buscar orçamento por ID
router.get('/budgets/:budgetId', async (req: Request, res: Response) => {
  try {
    const { budgetId } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        chat: {
          include: {
            client: {
              select: { id: true, name: true, avatarUrl: true },
            },
            professional: {
              select: { id: true, name: true, avatarUrl: true },
            },
            service: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    return res.json(budget);
  } catch (error) {
    console.error('Erro ao buscar orçamento:', error);
    return res.status(500).json({ error: 'Erro ao buscar orçamento' });
  }
});

// Buscar orçamento aceito de um serviço específico para um cliente
router.get('/budgets/service/:serviceId/client/:clientId', async (req: Request, res: Response) => {
  try {
    const { serviceId, clientId } = req.params;

    // Buscar orçamento aceito mais recente para este serviço e cliente
    const budget = await prisma.budget.findFirst({
      where: {
        serviceId,
        status: 'ACCEPTED',
        chat: {
          clientId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Nenhum orçamento aceito encontrado' });
    }

    return res.json(budget);
  } catch (error) {
    console.error('Erro ao buscar orçamento aceito:', error);
    return res.status(500).json({ error: 'Erro ao buscar orçamento aceito' });
  }
});

// Buscar orçamento pendente de um serviço específico para um cliente
router.get('/budgets/service/:serviceId/client/:clientId/pending', async (req: Request, res: Response) => {
  try {
    const { serviceId, clientId } = req.params;

    // Buscar orçamento pendente mais recente (com preço = 0, ou seja, ainda não definido)
    const budget = await prisma.budget.findFirst({
      where: {
        serviceId,
        status: 'PENDING',
        price: '0', // Apenas orçamentos ainda não definidos pelo profissional
        chat: {
          clientId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Nenhum orçamento pendente encontrado' });
    }

    return res.json(budget);
  } catch (error) {
    console.error('Erro ao buscar orçamento pendente:', error);
    return res.status(500).json({ error: 'Erro ao buscar orçamento pendente' });
  }
});

// Buscar orçamento com preço definido (QUOTED)
router.get('/budgets/service/:serviceId/client/:clientId/with-price', async (req: Request, res: Response) => {
  try {
    const { serviceId, clientId } = req.params;

    // Buscar orçamento com status QUOTED (preço definido pelo profissional)
    const budget = await prisma.budget.findFirst({
      where: {
        serviceId,
        status: 'QUOTED',
        chat: {
          clientId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Nenhum orçamento com preço encontrado' });
    }

    return res.json(budget);
  } catch (error) {
    console.error('Erro ao buscar orçamento com preço:', error);
    return res.status(500).json({ error: 'Erro ao buscar orçamento com preço' });
  }
});

// Aceitar orçamento
router.patch('/budgets/:budgetId/accept', async (req: Request, res: Response) => {
  try {
    const { budgetId } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        chat: {
          include: {
            client: true,
            professional: true,
            service: true,
          },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    if (budget.status !== 'PENDING' && budget.status !== 'QUOTED') {
      return res.status(400).json({ error: 'Este orçamento já foi respondido' });
    }

    // Verificar se expirou
    if (budget.expiresAt && new Date() > budget.expiresAt) {
      await prisma.budget.update({
        where: { id: budgetId },
        data: { status: 'EXPIRED' },
      });
      return res.status(400).json({ error: 'Este orçamento expirou' });
    }

    // Atualizar status
    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'ACCEPTED' },
    });

    console.log(`✅ Orçamento aceito: ${budgetId}`);

    // Emitir evento para o profissional
    try {
      const io = getIO();
      io.to(`professional:${budget.chat.professionalId}`).emit('budget-accepted', {
        budgetId,
        chatId: budget.chatId,
        clientName: budget.chat.client.name,
      });
    } catch (error) {
      console.error('Erro ao emitir evento budget-accepted:', error);
    }

    return res.json(updatedBudget);
  } catch (error) {
    console.error('Erro ao aceitar orçamento:', error);
    return res.status(500).json({ error: 'Erro ao aceitar orçamento' });
  }
});

// Rejeitar orçamento
router.patch('/budgets/:budgetId/reject', async (req: Request, res: Response) => {
  try {
    const { budgetId } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        chat: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    if (budget.status !== 'PENDING' && budget.status !== 'QUOTED') {
      return res.status(400).json({ error: 'Este orçamento já foi respondido' });
    }

    // Atualizar status
    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'REJECTED' },
    });

    console.log(`❌ Orçamento rejeitado: ${budgetId}`);

    // Emitir evento para o profissional
    try {
      const io = getIO();
      io.to(`professional:${budget.chat.professionalId}`).emit('budget-rejected', {
        budgetId,
        chatId: budget.chatId,
      });
    } catch (error) {
      console.error('Erro ao emitir evento budget-rejected:', error);
    }

    return res.json(updatedBudget);
  } catch (error) {
    console.error('Erro ao rejeitar orçamento:', error);
    return res.status(500).json({ error: 'Erro ao rejeitar orçamento' });
  }
});

// Cancelar orçamento (usado ao refazer)
router.patch('/budgets/:budgetId/cancel', async (req: Request, res: Response) => {
  try {
    const { budgetId } = req.params;

    console.log(`🚫 [PATCH /budgets/:budgetId/cancel] Cancelando orçamento: ${budgetId}`);

    const budget = await prisma.budget.findUnique({
      where: { id: budgetId },
      include: {
        chat: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!budget) {
      return res.status(404).json({ error: 'Orçamento não encontrado' });
    }

    console.log(`   - Status antes do cancelamento: ${budget.status}`);

    // Atualizar status para REJECTED (cancelado pelo cliente)
    const updatedBudget = await prisma.budget.update({
      where: { id: budgetId },
      data: { status: 'REJECTED' },
    });

    console.log(`🔄 Orçamento cancelado (refazer): ${budgetId} - Novo status: REJECTED`);

    // Emitir evento para o profissional sobre o cancelamento
    try {
      const io = getIO();
      
      // Emitir evento budget-cancelled
      io.to(`professional:${budget.chat.professionalId}`).emit('budget-cancelled', {
        budgetId,
        chatId: budget.chatId,
      });

      // Emitir atualização de chat list para refletir status REJECTED
      io.to(`professional:${budget.chat.professionalId}`).emit('chat-list-update', {
        chatId: budget.chatId,
        budget: {
          id: updatedBudget.id,
          status: 'REJECTED',
          price: updatedBudget.price.toString(),
          description: updatedBudget.description,
          expiresAt: updatedBudget.expiresAt,
        },
      });

      console.log(`📤 Eventos budget-cancelled e chat-list-update emitidos para profissional`);
    } catch (error) {
      console.error('Erro ao emitir eventos de cancelamento:', error);
    }

    return res.json(updatedBudget);
  } catch (error) {
    console.error('Erro ao cancelar orçamento:', error);
    return res.status(500).json({ error: 'Erro ao cancelar orçamento' });
  }
});

export default router;


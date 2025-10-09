import { Router, Request, Response } from 'express';
import { PrismaClient, MessageType } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Criar ou obter chat existente
router.post('/chats', async (req: Request, res: Response) => {
  try {
    const { clientId, professionalId, serviceId } = req.body;

    if (!clientId || !professionalId) {
      return res.status(400).json({ error: 'clientId and professionalId are required' });
    }

    // Verificar se chat já existe
    let chat = await prisma.chat.findUnique({
      where: {
        clientId_professionalId_serviceId: {
          clientId,
          professionalId,
          serviceId: serviceId || null,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        service: {
          select: {
            id: true,
            title: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    // Se não existe, criar novo
    if (!chat) {
      chat = await prisma.chat.create({
        data: {
          clientId,
          professionalId,
          serviceId: serviceId || null,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          professional: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          service: {
            select: {
              id: true,
              title: true,
            },
          },
          messages: true,
        },
      });
    }

    return res.json(chat);
  } catch (error) {
    console.error('Error creating/getting chat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Buscar chats de um usuário
router.get('/chats/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'CLIENT' ou 'PRO'

    const where = role === 'PRO' 
      ? { professionalId: userId }
      : { clientId: userId };

    const chats = await prisma.chat.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        service: {
          select: {
            id: true,
            title: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: {
                  not: userId,
                },
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
    });

    return res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Buscar mensagens de um chat
router.get('/chats/:chatId/messages', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const messages = await prisma.message.findMany({
      where: {
        chatId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      skip: parseInt(offset as string),
      take: parseInt(limit as string),
    });

    return res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Enviar mensagem
router.post('/chats/:chatId/messages', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { senderId, content, messageType = 'TEXT', mediaUrl, audioDuration } = req.body;

    if (!senderId) {
      return res.status(400).json({ error: 'senderId is required' });
    }

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'content or mediaUrl is required' });
    }

    // Criar mensagem
    const message = await prisma.message.create({
      data: {
        chatId,
        senderId,
        content,
        messageType: messageType as MessageType,
        mediaUrl,
        audioDuration,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Atualizar lastMessageAt do chat
    await prisma.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() },
    });

    return res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Marcar mensagens como lidas
router.patch('/chats/:chatId/messages/read', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Marcar todas as mensagens não lidas enviadas por outra pessoa
    await prisma.message.updateMany({
      where: {
        chatId,
        senderId: {
          not: userId,
        },
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Deletar mensagem
router.delete('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;

    await prisma.message.delete({
      where: { id: messageId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


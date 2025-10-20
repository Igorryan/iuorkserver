import { Router, Request, Response } from 'express';
import { PrismaClient, MessageType } from '@prisma/client';
import { getIO, SocketEvents } from '@server/socket';

const router = Router();
const prisma = new PrismaClient();

// Verificar se chat existe (sem criar)
router.get('/chats/check', async (req: Request, res: Response) => {
  try {
    const { clientId, professionalId, serviceId } = req.query;

    if (!clientId || !professionalId) {
      return res.status(400).json({ error: 'clientId and professionalId are required' });
    }

    // Normalizar serviceId: string vazia ou undefined → null
    const normalizedServiceId: string | null = (serviceId && serviceId !== '') ? (serviceId as string) : null;

    const chat = await prisma.chat.findFirst({
      where: {
        clientId: clientId as string,
        professionalId: professionalId as string,
        serviceId: normalizedServiceId,
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

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    return res.json(chat);
  } catch (error) {
    console.error('Error checking chat:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Criar ou obter chat existente
router.post('/chats', async (req: Request, res: Response) => {
  try {
    const { clientId, professionalId, serviceId } = req.body;

    if (!clientId || !professionalId) {
      return res.status(400).json({ error: 'clientId and professionalId are required' });
    }

    // Normalizar serviceId: string vazia ou undefined → null
    const normalizedServiceId: string | null = (serviceId && serviceId !== '') ? serviceId : null;

    // Verificar se chat já existe
    let chat = await prisma.chat.findFirst({
      where: {
        clientId,
        professionalId,
        serviceId: normalizedServiceId,
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
          serviceId: normalizedServiceId,
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
        budget: {
          select: {
            id: true,
            status: true,
            price: true,
            description: true,
            expiresAt: true,
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

    // Emitir evento WebSocket para todos conectados neste chat
    try {
      const io = getIO();
      
      // Buscar informações do chat
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        include: {
          client: { select: { id: true, name: true, avatarUrl: true } },
          professional: { select: { id: true, name: true, avatarUrl: true } },
          service: { select: { id: true, title: true } },
        },
      });

      if (chat) {
        console.log(`📤 [CHAT:${chatId}] Nova mensagem de ${message.sender.name}`);
        
        // 1. Emitir mensagem apenas para quem está NO CHAT específico
        io.to(`chat:${chatId}`).emit(SocketEvents.NEW_MESSAGE, message);
        console.log(`   ✅ Emitido para room: chat:${chatId}`);
        
        // 2. Atualizar lista de chats (sem conteúdo da mensagem, só notificação)
        const chatListUpdate = {
          chatId: chat.id,
          lastMessageAt: new Date(),
          lastMessage: {
            content: message.content,
            senderId: message.senderId,
            createdAt: message.createdAt,
          },
        };
        
        io.to(`professional:${chat.professionalId}`).emit('chat-list-update', chatListUpdate);
        io.to(`client:${chat.clientId}`).emit('chat-list-update', chatListUpdate);
        console.log(`   📋 Lista atualizada para profissional e cliente`);

        // 3. Notificar profissional sobre novo chat se for primeira mensagem
        const messageCount = await prisma.message.count({ where: { chatId } });
        if (messageCount === 1) {
          console.log(`   🆕 Primeiro chat - Notificando profissional`);
          io.to(`professional:${chat.professionalId}`).emit(SocketEvents.NEW_CHAT, chat);
        }
      }
    } catch (error) {
      console.error('Erro ao emitir evento Socket.io:', error);
    }

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

    // Emitir evento WebSocket para notificar que mensagens foram lidas
    try {
      const io = getIO();
      
      // Buscar informações do chat para notificar o usuário correto
      const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          clientId: true,
          professionalId: true,
        },
      });

      if (chat) {
        console.log(`📖 Mensagens lidas no chat ${chatId} por userId: ${userId}`);
        
        // Emitir evento para ambos os usuários (profissional e cliente)
        // O evento inclui chatId e userId de quem leu
        io.to(`professional:${chat.professionalId}`).emit(SocketEvents.MESSAGE_READ, {
          chatId,
          userId,
        });
        io.to(`client:${chat.clientId}`).emit(SocketEvents.MESSAGE_READ, {
          chatId,
          userId,
        });
      }
    } catch (error) {
      console.error('Erro ao emitir evento MESSAGE_READ:', error);
    }

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


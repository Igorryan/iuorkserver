import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initializeSocket(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);

    // Usuário entra em uma sala específica do chat
    socket.on('join-chat', (chatId: string) => {
      socket.join(`chat:${chatId}`);
      console.log(`📥 Socket ${socket.id} entrou no chat: ${chatId}`);
    });

    // Usuário sai de uma sala do chat
    socket.on('leave-chat', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      console.log(`📤 Socket ${socket.id} saiu do chat: ${chatId}`);
    });

    // Profissional entra na sala de notificações gerais
    socket.on('join-professional', (userId: string) => {
      socket.join(`professional:${userId}`);
      console.log(`💼 Profissional ${userId} conectado`);
    });

    // Cliente entra na sala de notificações gerais
    socket.on('join-client', (userId: string) => {
      socket.join(`client:${userId}`);
      console.log(`👤 Cliente ${userId} conectado`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io não foi inicializado!');
  }
  return io;
}

// Eventos que podem ser emitidos
export const SocketEvents = {
  NEW_MESSAGE: 'new-message',
  MESSAGE_READ: 'message-read',
  NEW_CHAT: 'new-chat',
  TYPING: 'typing',
  STOP_TYPING: 'stop-typing',
};


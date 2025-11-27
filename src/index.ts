import express from 'express';
import cors from 'cors';
import http from 'http';
import { initializeSocket } from '@server/socket';

import professionalsRouter from '@server/routes/professionals';
import servicesRouter from '@server/routes/services';
import reviewsRouter from '@server/routes/reviews';
import authRouter from '@server/routes/auth';
import categoriesRouter from '@server/routes/categories';
import bookingsRouter from '@server/routes/bookings';
import chatRouter from '@server/routes/chat';
import budgetRouter from '@server/routes/budget';
import adminRouter from '@server/routes/admin';
import adminProfessionCategoriesRouter from '@server/routes/admin-profession-categories';
import adminProfessionsRouter from '@server/routes/admin-professions';
import professionsRouter from '@server/routes/professions';
import professionCategoriesRouter from '@server/routes/profession-categories';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

export const prisma = new PrismaClient();

// Inicializar Socket.io
const io = initializeSocket(httpServer);
export { io };

app.get('/', (_req, res) => {
	res.json({ ok: true, service: 'iUork API' });
});

app.use('/auth', authRouter);
app.use('/professionals', professionalsRouter);
app.use('/professions', professionsRouter);
app.use('/profession-categories', professionCategoriesRouter);
app.use('/services', servicesRouter);
app.use('/reviews', reviewsRouter);
app.use('/categories', categoriesRouter);
app.use('/bookings', bookingsRouter);
app.use('/api', chatRouter);
app.use('/api', budgetRouter);
app.use('/admin', adminRouter);
app.use('/admin/profession-categories', adminProfessionCategoriesRouter);
app.use('/admin/professions', adminProfessionsRouter);

const PORT = process.env.PORT || 3333;
httpServer.listen(PORT, () => {
	console.log(`🚀 API running on http://localhost:${PORT}`);
	console.log(`⚡ WebSocket ready on ws://localhost:${PORT}`);
});

import { Router } from 'express';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

router.post('/signup', async (req, res) => {
	try {
		const { fullName, email, password, role } = req.body as {
			fullName: string;
			email?: string;
			password?: string;
			role?: 'CLIENT' | 'PRO';
		};

		if (!fullName || !email || !password) {
			return res.status(400).json({ message: 'Missing required fields' });
		}

		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return res.status(409).json({ message: 'Email already registered' });
		}

		const passwordHash = await bcrypt.hash(password, 10);
		const user = await prisma.user.create({
			data: {
				name: fullName,
				email,
				role: role ?? 'PRO',
				passwordHash,
			},
		});

		// Auto-create ProfessionalProfile for PRO
		if (user.role === 'PRO') {
			await prisma.professionalProfile.create({ data: { userId: user.id } });
		}

		const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
		return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body as { email?: string; password?: string };
		if (!email || !password) return res.status(400).json({ message: 'Missing credentials' });

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || !user.passwordHash) return res.status(401).json({ message: 'Invalid email or password' });

		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return res.status(401).json({ message: 'Invalid email or password' });

		const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
		return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Internal server error' });
	}
});

export default router;

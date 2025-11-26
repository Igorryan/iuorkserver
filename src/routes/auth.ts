import { Router } from 'express';
import { prisma } from '@server/index';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

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

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

async function uploadAvatarToS3(buffer: Buffer, mimeType: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET || 'iuork-uploads';
  const region = process.env.AWS_REGION || 'us-east-1';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const key = `avatars/${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mimeType, CacheControl: 'public, max-age=31536000, immutable' }));
  const baseUrl = process.env.AWS_CDN_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

router.post('/signup', async (req, res) => {
	try {
		const { fullName, email, password, role } = req.body as {
			fullName: string;
			email?: string;
			password?: string;
			role?: 'CLIENT' | 'PRO';
		};

		if (!fullName || !email || !password) {
			return res.status(400).json({ message: 'Campos obrigatórios ausentes' });
		}

		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return res.status(409).json({ message: 'Email já cadastrado' });
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
		return res.status(500).json({ message: 'Erro interno do servidor' });
	}
});

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body as { email?: string; password?: string };
		if (!email || !password) return res.status(400).json({ message: 'Credenciais ausentes' });

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user || !user.passwordHash) return res.status(401).json({ message: 'Email ou senha inválidos' });

		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return res.status(401).json({ message: 'Email ou senha inválidos' });

		const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
		return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Erro interno do servidor' });
	}
});

// Buscar dados do usuário autenticado
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user!.id },
			select: { id: true, name: true, email: true, role: true, avatarUrl: true },
		});
		if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });
		return res.json(user);
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Erro interno do servidor' });
	}
});

// Upload de avatar do usuário autenticado (CLIENT ou PRO)
router.post('/me/avatar', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
	try {
		if (!req.file) return res.status(400).json({ message: 'Arquivo não enviado' });
		const input = sharp(req.file.buffer);
		// Reduz e comprime: largura máx 600px, jpeg 80%
		const processed = await input.rotate().resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
		const url = await uploadAvatarToS3(processed, 'image/jpeg');
		await prisma.user.update({ where: { id: req.user!.id }, data: { avatarUrl: url } });
		return res.status(201).json({ url });
	} catch (e) {
		console.error(e);
		return res.status(500).json({ message: 'Erro interno do servidor' });
	}
});

export default router;

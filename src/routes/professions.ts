import { Router } from 'express';
import { prisma } from '@server/index';

const router = Router();

// GET /professions - Listar todas as profissões
router.get('/', async (_req, res) => {
  try {
    const professions = await prisma.profession.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return res.json(professions);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro ao buscar profissões' });
  }
});

// GET /professions/by-category - Listar profissões agrupadas por categoria
router.get('/by-category', async (_req, res) => {
  try {
    const professions = await prisma.profession.findMany({
      include: { category: true },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Agrupar por categoria
    const grouped = professions.reduce((acc, profession) => {
      const categorySlug = profession.category?.slug || 'other';
      if (!acc[categorySlug]) {
        acc[categorySlug] = {
          category: profession.category,
          professions: [],
        };
      }
      acc[categorySlug].professions.push(profession);
      return acc;
    }, {} as Record<string, { category: any; professions: typeof professions }>);

    return res.json(grouped);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro ao buscar profissões' });
  }
});

export default router;


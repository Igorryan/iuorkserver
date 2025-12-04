import { Router } from 'express';
import { prisma } from '@server/index';

const router = Router();

// GET /profession-categories - Listar todas as categorias com suas profissões
router.get('/', async (_req, res) => {
  try {
    const categories = await prisma.professionCategory.findMany({
      include: {
        professions: {
          orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
    });
    return res.json(categories);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro ao buscar categorias' });
  }
});

// GET /profession-categories/:slug/professions - Listar profissões de uma categoria específica
router.get('/:slug/professions', async (req, res) => {
  try {
    const category = await prisma.professionCategory.findUnique({
      where: { slug: req.params.slug },
      include: {
        professions: {
          orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        },
      },
    });

    if (!category) {
      return res.status(404).json({ message: 'Categoria não encontrada' });
    }

    return res.json(category);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Erro ao buscar profissões da categoria' });
  }
});

export default router;


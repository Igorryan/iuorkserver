import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Construção', slug: 'construction', icon: 'hammer', color: '#FF6B6B' },
  { name: 'Manutenção', slug: 'maintenance', icon: 'settings', color: '#4ECDC4' },
  { name: 'Limpeza', slug: 'cleaning', icon: 'sparkles', color: '#45B7D1' },
  { name: 'Gastronomia', slug: 'gastronomy', icon: 'restaurant', color: '#FFA07A' },
  { name: 'Criativo', slug: 'creative', icon: 'color-palette', color: '#98D8C8' },
  { name: 'Tecnologia', slug: 'technology', icon: 'laptop', color: '#6C5CE7' },
  { name: 'Educação', slug: 'education', icon: 'school', color: '#A29BFE' },
  { name: 'Negócios', slug: 'business', icon: 'briefcase', color: '#FD79A8' },
  { name: 'Saúde', slug: 'health', icon: 'medical', color: '#00B894' },
  { name: 'Eventos', slug: 'events', icon: 'musical-notes', color: '#FDCB6E' },
  { name: 'Transporte', slug: 'transport', icon: 'car', color: '#E17055' },
  { name: 'Animais', slug: 'pets', icon: 'paw', color: '#74B9FF' },
  { name: 'Comércio', slug: 'commerce', icon: 'storefront', color: '#55A3FF' },
];

const professions = [
  // Construction
  { name: 'Pedreiro', categorySlug: 'construction' },
  { name: 'Encanador', categorySlug: 'construction' },
  { name: 'Eletricista', categorySlug: 'construction' },
  { name: 'Pintor', categorySlug: 'construction' },
  { name: 'Carpinteiro', categorySlug: 'construction' },
  { name: 'Gesseiro', categorySlug: 'construction' },
  { name: 'Azulejista', categorySlug: 'construction' },
  { name: 'Marido de aluguel', categorySlug: 'construction' },
  { name: 'Instalador de ar-condicionado', categorySlug: 'construction' },
  { name: 'Jardineiro / Paisagista', categorySlug: 'construction' },
  { name: 'Mestre de obras', categorySlug: 'construction' },
  { name: 'Vidraceiro', categorySlug: 'construction' },

  // Maintenance
  { name: 'Mecânico automotivo', categorySlug: 'maintenance' },
  { name: 'Mecânico de motos', categorySlug: 'maintenance' },
  { name: 'Chaveiro', categorySlug: 'maintenance' },
  { name: 'Técnico em informática', categorySlug: 'maintenance' },
  { name: 'Técnico em celulares', categorySlug: 'maintenance' },
  { name: 'Técnico em eletrodomésticos', categorySlug: 'maintenance' },
  { name: 'Soldador', categorySlug: 'maintenance' },
  { name: 'Marceneiro', categorySlug: 'maintenance' },

  // Cleaning
  { name: 'Diarista', categorySlug: 'cleaning' },
  { name: 'Faxineiro(a)', categorySlug: 'cleaning' },
  { name: 'Passadeira', categorySlug: 'cleaning' },
  { name: 'Cozinheira particular', categorySlug: 'cleaning' },
  { name: 'Cuidador(a) de idosos', categorySlug: 'cleaning' },
  { name: 'Babá', categorySlug: 'cleaning' },
  { name: 'Governanta', categorySlug: 'cleaning' },
  { name: 'Pet sitter', categorySlug: 'cleaning' },

  // Gastronomy
  { name: 'Chef', categorySlug: 'gastronomy' },
  { name: 'Confeiteiro', categorySlug: 'gastronomy' },
  { name: 'Padeiro artesanal', categorySlug: 'gastronomy' },
  { name: 'Chocolatier', categorySlug: 'gastronomy' },
  { name: 'Bartender', categorySlug: 'gastronomy' },
  { name: 'Barista', categorySlug: 'gastronomy' },
  { name: 'Personal Chef para eventos', categorySlug: 'gastronomy' },

  // Creative
  { name: 'Designer gráfico', categorySlug: 'creative' },
  { name: 'Ilustrador', categorySlug: 'creative' },
  { name: 'Fotógrafo', categorySlug: 'creative' },
  { name: 'Videomaker', categorySlug: 'creative' },
  { name: 'Editor de vídeo', categorySlug: 'creative' },
  { name: 'Social media', categorySlug: 'creative' },
  { name: 'Designer de interiores', categorySlug: 'creative' },
  { name: 'Artista plástico', categorySlug: 'creative' },
  { name: 'Artesão', categorySlug: 'creative' },

  // Technology
  { name: 'Programador', categorySlug: 'technology' },
  { name: 'Desenvolvedor web', categorySlug: 'technology' },
  { name: 'Desenvolvedor de apps', categorySlug: 'technology' },
  { name: 'Especialista em UX/UI', categorySlug: 'technology' },
  { name: 'Analista de dados freelancer', categorySlug: 'technology' },
  { name: 'Gestor de tráfego pago', categorySlug: 'technology' },
  { name: 'Consultor de TI', categorySlug: 'technology' },
  { name: 'Criador de conteúdo digital (influencer, youtuber, streamer)', categorySlug: 'technology' },

  // Education
  { name: 'Professor particular', categorySlug: 'education' },
  { name: 'Reforço escolar', categorySlug: 'education' },
  { name: 'Instrutor de idiomas', categorySlug: 'education' },
  { name: 'Personal Trainer', categorySlug: 'education' },
  { name: 'Instrutor de yoga', categorySlug: 'education' },
  { name: 'Instrutor de pilates', categorySlug: 'education' },
  { name: 'Coach / Mentor', categorySlug: 'education' },
  { name: 'Consultor educacional', categorySlug: 'education' },

  // Business
  { name: 'Contador autônomo', categorySlug: 'business' },
  { name: 'Consultor financeiro', categorySlug: 'business' },
  { name: 'Consultor de negócios', categorySlug: 'business' },
  { name: 'Advogado (autônomo)', categorySlug: 'business' },
  { name: 'Assistente virtual', categorySlug: 'business' },
  { name: 'Auditor independente', categorySlug: 'business' },

  // Health
  { name: 'Psicólogo autônomo', categorySlug: 'health' },
  { name: 'Nutricionista', categorySlug: 'health' },
  { name: 'Fisioterapeuta', categorySlug: 'health' },
  { name: 'Massoterapeuta', categorySlug: 'health' },
  { name: 'Esteticista', categorySlug: 'health' },
  { name: 'Maquiadora', categorySlug: 'health' },
  { name: 'Cabeleireiro', categorySlug: 'health' },
  { name: 'Manicure/Pedicure', categorySlug: 'health' },
  { name: 'Depiladora', categorySlug: 'health' },
  { name: 'Terapeuta holístico', categorySlug: 'health' },

  // Events
  { name: 'DJ', categorySlug: 'events' },
  { name: 'Cerimonialista', categorySlug: 'events' },
  { name: 'Decorador de eventos', categorySlug: 'events' },
  { name: 'Garçom freelancer', categorySlug: 'events' },
  { name: 'Promotor de eventos', categorySlug: 'events' },
  { name: 'Animador/MC', categorySlug: 'events' },
  { name: 'Locutor', categorySlug: 'events' },
  { name: 'Músico', categorySlug: 'events' },

  // Transport
  { name: 'Motorista de aplicativo', categorySlug: 'transport' },
  { name: 'Motoboy', categorySlug: 'transport' },
  { name: 'Transportador de pequenas cargas', categorySlug: 'transport' },
  { name: 'Caminhoneiro autônomo', categorySlug: 'transport' },
  { name: 'Entregador por conta própria', categorySlug: 'transport' },

  // Pets
  { name: 'Tosador', categorySlug: 'pets' },
  { name: 'Adestrador', categorySlug: 'pets' },
  { name: 'Petsitter', categorySlug: 'pets' },
  { name: 'Dog walker', categorySlug: 'pets' },

  // Commerce
  { name: 'Vendedor ambulante', categorySlug: 'commerce' },
  { name: 'Representante comercial', categorySlug: 'commerce' },
  { name: 'Revendedor (cosméticos, roupas, etc.)', categorySlug: 'commerce' },
  { name: 'Consultor de vendas', categorySlug: 'commerce' },
];

async function main() {
  console.log('🌱 Seeding profession categories...');

  // Criar categorias primeiro
  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const created = await prisma.professionCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
      create: category,
    });
    categoryMap.set(category.slug, created.id);
  }

  console.log(`✅ Seeded ${categories.length} categories`);

  console.log('🌱 Seeding professions...');

  // Criar profissões linkadas às categorias
  for (const profession of professions) {
    const categoryId = profession.categorySlug ? categoryMap.get(profession.categorySlug) : null;
    await prisma.profession.upsert({
      where: { name: profession.name },
      update: {
        categoryId: categoryId || undefined,
      },
      create: {
        name: profession.name,
        categoryId: categoryId || undefined,
      },
    });
  }

  console.log(`✅ Seeded ${professions.length} professions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import { PrismaClient, UserRole, PricingType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Users
  const [anaUser, carlosUser, marianaUser, mariaClient] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'ana@example.com' },
      update: {},
      create: {
        role: UserRole.PRO,
        name: 'Ana Costa',
        email: 'ana@example.com',
        avatarUrl:
          'https://images.unsplash.com/photo-1593529467220-9d721ceb9a78?auto=format&fit=crop&q=80&w=3430',
      },
    }),
    prisma.user.upsert({
      where: { email: 'carlos@example.com' },
      update: {},
      create: {
        role: UserRole.PRO,
        name: 'Carlos Mendes',
        email: 'carlos@example.com',
        avatarUrl:
          'https://plus.unsplash.com/premium_photo-1664536392779-049ba8fde933?q=80&w=987&auto=format&fit=crop',
      },
    }),
    prisma.user.upsert({
      where: { email: 'mariana@example.com' },
      update: {},
      create: {
        role: UserRole.PRO,
        name: 'Mariana Lopes',
        email: 'mariana@example.com',
        avatarUrl:
          'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1170&auto=format&fit=crop',
      },
    }),
    prisma.user.upsert({
      where: { email: 'maria@example.com' },
      update: {},
      create: {
        role: UserRole.CLIENT,
        name: 'Maria Gabriela',
        email: 'maria@example.com',
      },
    }),
  ]);

  // Categories
  const [manicure, hair] = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Manicure' },
      update: {},
      create: { name: 'Manicure' },
    }),
    prisma.category.upsert({
      where: { name: 'Cabeleireira' },
      update: {},
      create: { name: 'Cabeleireira' },
    }),
  ]);

  // Professional profiles
  const [anaPro, carlosPro, marianaPro] = await Promise.all([
    prisma.professionalProfile.upsert({
      where: { userId: anaUser.id },
      update: {},
      create: {
        userId: anaUser.id,
        bio: 'Profissional com 14 anos de experiência em cuidados e design de unhas.',
        radiusKm: 5,
        latitude: -19.445133,
        longitude: -44.2299327,
        city: 'Sete Lagoas',
        state: 'MG',
        street: 'Rua América',
        number: '12',
        district: 'Jardim Cambuí',
        postalcode: '35700-066',
        categories: { connect: [{ id: manicure.id }] },
      },
    }),
    prisma.professionalProfile.upsert({
      where: { userId: carlosUser.id },
      update: {},
      create: {
        userId: carlosUser.id,
        bio: 'Eletricista com mais de 10 anos de experiência.',
        radiusKm: 5,
        latitude: -19.456789,
        longitude: -44.217654,
        city: 'Sete Lagoas',
        state: 'MG',
        street: 'Av. das Palmeiras',
        number: '89',
        district: 'Centro',
        postalcode: '35700-123',
        categories: { connect: [{ id: hair.id }] },
      },
    }),
    prisma.professionalProfile.upsert({
      where: { userId: marianaUser.id },
      update: {},
      create: {
        userId: marianaUser.id,
        bio: 'Personal trainer certificada.',
        radiusKm: 5,
        latitude: -19.460012,
        longitude: -44.230978,
        city: 'Sete Lagoas',
        state: 'MG',
        street: 'Rua das Flores',
        number: '55',
        district: 'Alto do Cruzeiro',
        postalcode: '35700-890',
      },
    }),
  ]);

  // Services + images
  const [unhasMaos, unhasPes, unhasDecoradas, corteHidratacao] = await Promise.all([
    prisma.service.create({
      data: {
        professionalId: anaPro.id,
        title: 'Unhas das mãos',
        description:
          'Esmaltar unhas dos dedos das mãos. Limpar, cortar e moldar as unhas. Recomendar cores, cristais e desenhos.',
        pricingType: PricingType.BUDGET,
        categoryId: manicure.id,
        images: {
          create: [
            { url: 'https://claudia.abril.com.br/wp-content/uploads/2023/09/unhas-matcha.jpg' },
          ],
        },
      },
    }),
    prisma.service.create({
      data: {
        professionalId: anaPro.id,
        title: 'Unhas dos pés',
        description: 'Cuidados e esmaltação das unhas dos pés',
        pricingType: PricingType.FIXED,
        price: 45,
        categoryId: manicure.id,
      },
    }),
    prisma.service.create({
      data: {
        professionalId: anaPro.id,
        title: 'Unhas decoradas com película em gel',
        description: 'Decoração personalizada com pedras e desenhos.',
        pricingType: PricingType.FIXED,
        price: 70,
        categoryId: manicure.id,
      },
    }),
    prisma.service.create({
      data: {
        professionalId: anaPro.id,
        title: 'Corte e hidratação capilar',
        description: 'Corte personalizado acompanhado de hidratação profunda.',
        pricingType: PricingType.FIXED,
        price: 120,
        categoryId: hair.id,
        images: { create: [{ url: 'https://images.unsplash.com/photo-1580894894517-7e7fef21edc0' }] },
      },
    }),
  ]);

  // Reviews
  await prisma.review.createMany({
    data: [
      {
        serviceId: unhasMaos.id,
        fromUserId: mariaClient.id,
        toUserId: anaUser.id,
        rating: 5,
        comment: 'A Ana é sempre maravilhosa, minhas unhas ficaram impecáveis',
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



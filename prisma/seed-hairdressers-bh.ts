import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// 20 endereços diferentes em Belo Horizonte, MG
const bhAddresses = [
  { street: 'Av. Afonso Pena', number: '2000', district: 'Centro', lat: -19.9167, lng: -43.9345, postalcode: '30130-000' },
  { street: 'Rua da Bahia', number: '1200', district: 'Centro', lat: -19.9200, lng: -43.9400, postalcode: '30160-011' },
  { street: 'Av. do Contorno', number: '8000', district: 'Funcionários', lat: -19.9300, lng: -43.9400, postalcode: '30110-000' },
  { street: 'Rua dos Carijós', number: '600', district: 'Centro', lat: -19.9180, lng: -43.9380, postalcode: '30120-060' },
  { street: 'Av. Getúlio Vargas', number: '1500', district: 'Savassi', lat: -19.9400, lng: -43.9400, postalcode: '30112-000' },
  { street: 'Rua Rio de Janeiro', number: '900', district: 'Centro', lat: -19.9220, lng: -43.9360, postalcode: '30160-012' },
  { street: 'Av. Cristóvão Colombo', number: '2500', district: 'Savassi', lat: -19.9350, lng: -43.9450, postalcode: '30140-000' },
  { street: 'Rua Espírito Santo', number: '500', district: 'Centro', lat: -19.9190, lng: -43.9370, postalcode: '30160-013' },
  { street: 'Av. Olegário Maciel', number: '1800', district: 'Lourdes', lat: -19.9320, lng: -43.9420, postalcode: '30180-000' },
  { street: 'Rua Tupis', number: '700', district: 'Centro', lat: -19.9210, lng: -43.9390, postalcode: '30190-060' },
  { street: 'Av. Amazonas', number: '3000', district: 'Centro', lat: -19.9170, lng: -43.9350, postalcode: '30180-000' },
  { street: 'Rua dos Guajajaras', number: '400', district: 'Centro', lat: -19.9200, lng: -43.9380, postalcode: '30180-100' },
  { street: 'Av. Bias Fortes', number: '2200', district: 'Lourdes', lat: -19.9330, lng: -43.9430, postalcode: '30170-010' },
  { street: 'Rua Curitiba', number: '800', district: 'Centro', lat: -19.9230, lng: -43.9400, postalcode: '30170-130' },
  { street: 'Av. Álvares Cabral', number: '1000', district: 'Lourdes', lat: -19.9310, lng: -43.9410, postalcode: '30170-001' },
  { street: 'Rua dos Caetés', number: '300', district: 'Centro', lat: -19.9240, lng: -43.9370, postalcode: '30120-000' },
  { street: 'Av. João Pinheiro', number: '500', district: 'Centro', lat: -19.9250, lng: -43.9390, postalcode: '30130-180' },
  { street: 'Rua da Paisagem', number: '1200', district: 'Savassi', lat: -19.9360, lng: -43.9440, postalcode: '30140-000' },
  { street: 'Av. Brasil', number: '2000', district: 'Funcionários', lat: -19.9280, lng: -43.9450, postalcode: '30140-002' },
  { street: 'Rua Cláudio Manoel', number: '600', district: 'Funcionários', lat: -19.9290, lng: -43.9460, postalcode: '30140-100' },
];

// URLs de fotos de perfil do Unsplash (diversas)
const avatarUrls = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format',
];

// Nomes brasileiros diversos
const names = [
  'Roberta Alves', 'Carla Mendes', 'Sandra Oliveira', 'Vanessa Costa', 'Renata Souza',
  'Mariana Ferreira', 'Luciana Almeida', 'Priscila Lima', 'Daniela Rodrigues', 'Tatiana Martins',
  'Fernanda Pereira', 'Adriana Rocha', 'Juliana Barbosa', 'Patricia Nunes', 'Cristina Gomes',
  'Leticia Dias', 'Monica Carvalho', 'Simone Ribeiro', 'Gisele Araújo', 'Bruna Moreira',
];

async function main() {
  console.log('🌱 Criando 20 cabeleireiros em Belo Horizonte...');

  // Buscar a profissão Cabeleireiro
  const profession = await prisma.profession.findUnique({
    where: { name: 'Cabeleireiro' },
  });

  if (!profession) {
    console.error('❌ Erro: Profissão "Cabeleireiro" não encontrada no banco.');
    console.log('💡 Execute primeiro: npm run prisma:seed:professions');
    return;
  }

  const professionals = [];
  let startIndex = 100; // Começar do índice 100 para evitar conflitos com os anteriores

  for (let i = 0; i < 20; i++) {
    const address = bhAddresses[i];
    const name = names[i];
    const avatarUrl = avatarUrls[i];
    const email = `cabeleireiro${startIndex + i}@example.com`;
    const phone = `319876543${String(i).padStart(2, '0')}`;

    try {
      // Criar usuário
      const user = await prisma.user.create({
        data: {
          role: UserRole.PRO,
          name,
          email,
          phone,
          avatarUrl,
        },
      });

      // Criar perfil profissional
      const profile = await prisma.professionalProfile.create({
        data: {
          userId: user.id,
          professionId: profession.id,
          bio: `Cabeleireira profissional com experiência em cortes, colorações e tratamentos capilares. Atendimento personalizado e de qualidade.`,
          radiusKm: 10,
          latitude: address.lat,
          longitude: address.lng,
          city: 'Belo Horizonte',
          state: 'MG',
          street: address.street,
          number: address.number,
          district: address.district,
          postalcode: address.postalcode,
        },
      });

      professionals.push({ user, profile, address: `${address.street}, ${address.number} - ${address.district}` });
      console.log(`✅ Criado: ${name} - Cabeleireiro em ${address.street}, ${address.number} - ${address.district}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Email ou telefone já existe, tentar com valores diferentes
        console.log(`⚠️  ${email} já existe, pulando...`);
      } else {
        console.error(`❌ Erro ao criar ${name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Processo concluído! ${professionals.length} cabeleireiros criados em Belo Horizonte.`);
  console.log('\n📋 Resumo:');
  professionals.forEach((p, i) => {
    console.log(`${i + 1}. ${p.user.name} - ${p.address}`);
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




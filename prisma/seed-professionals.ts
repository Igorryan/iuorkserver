import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// 20 cidades diferentes do Brasil com coordenadas
const cities = [
  { name: 'São Paulo', state: 'SP', lat: -23.5505, lng: -46.6333, street: 'Av. Paulista', number: '1000', district: 'Bela Vista', postalcode: '01310-100' },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lng: -43.1729, street: 'Av. Atlântica', number: '500', district: 'Copacabana', postalcode: '22010-000' },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.9167, lng: -43.9345, street: 'Av. Afonso Pena', number: '2000', district: 'Centro', postalcode: '30130-000' },
  { name: 'Brasília', state: 'DF', lat: -15.7942, lng: -47.8822, street: 'SQN 105', number: 'Bloco A', district: 'Asa Norte', postalcode: '70733-010' },
  { name: 'Salvador', state: 'BA', lat: -12.9714, lng: -38.5014, street: 'Av. Sete de Setembro', number: '300', district: 'Centro', postalcode: '40060-000' },
  { name: 'Curitiba', state: 'PR', lat: -25.4284, lng: -49.2733, street: 'Av. Sete de Setembro', number: '5000', district: 'Centro', postalcode: '80250-000' },
  { name: 'Porto Alegre', state: 'RS', lat: -30.0346, lng: -51.2177, street: 'Av. Borges de Medeiros', number: '1500', district: 'Centro Histórico', postalcode: '90020-020' },
  { name: 'Recife', state: 'PE', lat: -8.0476, lng: -34.8770, street: 'Av. Boa Viagem', number: '2000', district: 'Boa Viagem', postalcode: '51020-000' },
  { name: 'Fortaleza', state: 'CE', lat: -3.7172, lng: -38.5433, street: 'Av. Beira Mar', number: '1000', district: 'Meireles', postalcode: '60165-121' },
  { name: 'Manaus', state: 'AM', lat: -3.1190, lng: -60.0217, street: 'Av. Eduardo Ribeiro', number: '500', district: 'Centro', postalcode: '69010-001' },
  { name: 'Belém', state: 'PA', lat: -1.4558, lng: -48.5044, street: 'Av. Presidente Vargas', number: '800', district: 'Campina', postalcode: '66010-000' },
  { name: 'Goiânia', state: 'GO', lat: -16.6864, lng: -49.2643, street: 'Av. T-4', number: '1000', district: 'Setor Bueno', postalcode: '74210-010' },
  { name: 'Vitória', state: 'ES', lat: -20.3155, lng: -40.3128, street: 'Av. Jerônimo Monteiro', number: '500', district: 'Centro', postalcode: '29010-000' },
  { name: 'Florianópolis', state: 'SC', lat: -27.5954, lng: -48.5480, street: 'Av. Beira Mar Norte', number: '200', district: 'Centro', postalcode: '88015-700' },
  { name: 'Natal', state: 'RN', lat: -5.7793, lng: -35.2009, street: 'Av. Engenheiro Roberto Freire', number: '2000', district: 'Ponta Negra', postalcode: '59090-000' },
  { name: 'João Pessoa', state: 'PB', lat: -7.1150, lng: -34.8631, street: 'Av. Epitácio Pessoa', number: '1500', district: 'Tambiá', postalcode: '58020-000' },
  { name: 'Aracaju', state: 'SE', lat: -10.9092, lng: -37.0677, street: 'Av. Beira Mar', number: '500', district: 'Centro', postalcode: '49010-000' },
  { name: 'Maceió', state: 'AL', lat: -9.5713, lng: -36.7820, street: 'Av. da Paz', number: '1000', district: 'Jaraguá', postalcode: '57022-000' },
  { name: 'Teresina', state: 'PI', lat: -5.0892, lng: -42.8019, street: 'Av. Frei Serafim', number: '2000', district: 'Centro', postalcode: '64000-000' },
  { name: 'Campo Grande', state: 'MS', lat: -20.4697, lng: -54.6201, street: 'Av. Afonso Pena', number: '3000', district: 'Centro', postalcode: '79002-000' },
];

// URLs de fotos de perfil do Unsplash (diversas)
const avatarUrls = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&auto=format',
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&auto=format',
];

// Nomes brasileiros diversos
const names = [
  'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 'Carlos Souza',
  'Juliana Ferreira', 'Ricardo Almeida', 'Fernanda Lima', 'Bruno Rodrigues', 'Patricia Martins',
  'Lucas Pereira', 'Camila Rocha', 'Gabriel Barbosa', 'Isabela Nunes', 'Rafael Gomes',
  'Larissa Dias', 'Thiago Carvalho', 'Amanda Ribeiro', 'Felipe Araújo', 'Beatriz Moreira',
];

async function main() {
  console.log('🌱 Criando 20 profissionais...');

  // Buscar todas as profissões disponíveis
  const professions = await prisma.profession.findMany({
    take: 20,
  });

  if (professions.length < 20) {
    console.error(`❌ Erro: É necessário ter pelo menos 20 profissões no banco. Encontradas: ${professions.length}`);
    console.log('💡 Execute primeiro: npm run seed:professions');
    return;
  }

  const professionals = [];

  for (let i = 0; i < 20; i++) {
    const city = cities[i];
    const profession = professions[i];
    const name = names[i];
    const avatarUrl = avatarUrls[i];
    const email = `prof${i + 1}@example.com`;
    const phone = `1198765432${String(i).padStart(2, '0')}`;

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
          bio: `Profissional experiente em ${profession.name.toLowerCase()} com anos de dedicação ao trabalho.`,
          radiusKm: 10,
          latitude: city.lat,
          longitude: city.lng,
          city: city.name,
          state: city.state,
          street: city.street,
          number: city.number,
          district: city.district,
          postalcode: city.postalcode,
        },
      });

      professionals.push({ user, profile, profession: profession.name, city: city.name });
      console.log(`✅ Criado: ${name} - ${profession.name} em ${city.name}, ${city.state}`);
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Email ou telefone já existe, tentar com valores diferentes
        console.log(`⚠️  ${email} já existe, pulando...`);
      } else {
        console.error(`❌ Erro ao criar ${name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Processo concluído! ${professionals.length} profissionais criados.`);
  console.log('\n📋 Resumo:');
  professionals.forEach((p, i) => {
    console.log(`${i + 1}. ${p.user.name} - ${p.profession} (${p.city})`);
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




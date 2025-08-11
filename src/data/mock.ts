export interface Address {
  latitude: number;
  longitude: number;
  street: string;
  number: number;
  district: string;
  city: string;
  state: string;
  postalcode: string;
  distanceInMeters: number | null;
}

export interface Review {
  id: string;
  serviceId: string;
  professionalId: string;
  rating: number;
  description: string;
  client: {
    id: string;
    name: string;
    image: string;
  };
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  professionalId: string;
  category: string;
  description: string;
  price: number | null;
  images: string[];
}

export interface Professional {
  id: string;
  image: string;
  name: string;
  profession: string;
  description: string;
  address: Address;
  completedServicesCount: number;
  ratingsAggregate: {
    avg: number;
    count: number;
  };
}

export const reviews: Review[] = [
  {
    id: '088aa9cd-63d0-4e37-b574-bs',
    rating: 5,
    serviceId: 'a5e92b18-65e9-4a5b-bc3f-0993655a0337',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    description: 'A Ana é sempre maravilhosa, minhas unhas ficaram impecáveis',
    client: {
      id: '1',
      name: 'Maria Gabriela',
      image:
        'https://images.unsplash.com/photo-1702482527875-e16d07f0d91b?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    createdAt: '2023-09-15T11:21:00.000Z',
  },
  {
    id: '56dfa9cd-63d0-4f37-b5f',
    serviceId: 'd8f9e63a-12a9-45b7-bcde-3b9e6a789ab3',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    rating: 5,
    description: 'Corte impecável e hidratação maravilhosa. Recomendo!',
    client: {
      id: '4',
      name: 'Mariana Silva',
      image:
        'https://plus.unsplash.com/premium_photo-1689551670902-19b441a6afde?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    createdAt: '2023-10-12T13:00:00.000Z',
  },
  {
    id: '78cba9cd-35f1-4f37-b574v',
    serviceId: 'd8f9e63a-12a9-45b7-bcde-3b9e6a789ab3',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    rating: 4,
    description: 'Ótimo atendimento, mas houve atraso na agenda.',
    client: {
      id: '5',
      name: 'João Pereira',
      image:
        'https://plus.unsplash.com/premium_photo-1689977807477-a579eda91fa2?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    createdAt: '2023-09-28T09:45:00.000Z',
  },
  {
    id: '34cbb9cd-21d0-4f37-b5732',
    serviceId: 'c7f8e52d-9d9d-48e7-bacf-2b0e5a789abc',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    rating: 5,
    description: 'Unhas maravilhosas! O design ficou exatamente como pedi.',
    client: {
      id: '3',
      name: 'João Pereira',
      image:
        'https://plus.unsplash.com/premium_photo-1689977807477-a579eda91fa2?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    },
    createdAt: '2023-10-05T16:00:00.000Z',
  },
];

export const services: Service[] = [
  {
    id: 'a5e92b18-65e9-4a5b-bc3f-0993655a0337',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    name: 'Unhas das mãos',
    category: 'Manicure',
    description:
      'Esmaltar unhas dos dedos das mãos. Limpar, cortar e moldar as unhas. Recomendar cores, cristais e desenhos.',
    price: null,
    images: [
      'https://claudia.abril.com.br/wp-content/uploads/2023/09/unhas-matcha.jpg?quality=85&strip=info&w=720&crop=1',
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'https://images.unsplash.com/photo-1599458348985-236f9b110da1?q=80&w=989&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
      'https://images.unsplash.com/photo-1641814250010-9887d86eedfd?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    id: 'b6d7e41c-8f7d-4e73-8ad9-0a1e5cc',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    name: 'Unhas dos pés',
    category: 'Manicure',
    description:
      'Cuidados e esmaltação das unhas dos pés com técnicas de hidratação e finalização.',
    price: 45,
    images: ['https://www.vivabeleza.com.br/wp-content/uploads/2022/09/pes_bem_cuidados.jpg'],
  },
  {
    id: 'c7f8e52d-9d9d-48e7-bacf-2b0e5a789abc',
    name: 'Unhas decoradas com a famosa pelicula em gel',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    category: 'Manicure',
    description:
      'Decoração personalizada com pedras, desenhos e aplicação de técnicas exclusivas para design de unhas.',
    price: 70,
    images: [
      'https://images.unsplash.com/photo-1619615787228-ce0fa8440e18?q=80&w=1160&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    ],
  },
  {
    id: 'd8f9e63a-12a9-45b7-bcde-3b9e6a789ab3',
    name: 'Corte e hidratação capilar',
    professionalId: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    category: 'Cabeleireira',
    description:
      'Corte personalizado para todos os tipos de cabelo, acompanhado de hidratação profunda para garantir brilho e maciez.',
    price: 120,
    images: [
      'https://images.unsplash.com/photo-1580894894517-7e7fef21edc0?auto=format&fit=crop&q=80&w=720',
    ],
  },
];

export const professionals: Professional[] = [
  {
    id: 'a63c04f1-9427-407e-a879-e4755d4146d9',
    image:
      'https://images.unsplash.com/photo-1593529467220-9d721ceb9a78?auto=format&fit=crop&q=80&w=3430',
    name: 'Ana Costa',
    profession: 'Manicure',
    description:
      'Profissional com 14 anos de experiência em cuidados e design de unhas. Especializada em técnicas modernas de manicure e nail art. Atendimento personalizado e de alta qualidade.',
    address: {
      latitude: -19.445133,
      longitude: -44.2299327,
      street: 'Rua América',
      number: 12,
      district: 'Jardim Cambuí',
      city: 'Sete Lagoas',
      state: 'MG',
      postalcode: '35700-066',
      distanceInMeters: 200,
    },
    completedServicesCount: 240,
    ratingsAggregate: {
      avg: 4.5,
      count: 130,
    },
  },
  {
    id: 'b12f04a1-6547-4c5f-bf01-d4755d4177bc',
    image:
      'https://plus.unsplash.com/premium_photo-1664536392779-049ba8fde933?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    name: 'Carlos Mendes',
    profession: 'Eletricista',
    description:
      'Eletricista com mais de 10 anos de experiência, especialista em instalações residenciais e comerciais. Serviços rápidos, eficientes e seguros.',
    address: {
      latitude: -19.456789,
      longitude: -44.217654,
      street: 'Av. das Palmeiras',
      number: 89,
      district: 'Centro',
      city: 'Sete Lagoas',
      state: 'MG',
      postalcode: '35700-123',
      distanceInMeters: 750,
    },
    completedServicesCount: 180,
    ratingsAggregate: {
      avg: 4.7,
      count: 95,
    },
  },
  {
    id: 'c34d03b2-8932-4e8d-bf45-e6755d4178ef',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    name: 'Mariana Lopes',
    profession: 'Personal Trainer',
    description:
      'Personal trainer certificada, focada em treinos personalizados para perda de peso, ganho de massa muscular e qualidade de vida. Atendimento presencial e online.',
    address: {
      latitude: -19.460012,
      longitude: -44.230978,
      street: 'Rua das Flores',
      number: 55,
      district: 'Alto do Cruzeiro',
      city: 'Sete Lagoas',
      state: 'MG',
      postalcode: '35700-890',
      distanceInMeters: 1500,
    },
    completedServicesCount: 320,
    ratingsAggregate: {
      avg: 4.9,
      count: 200,
    },
  },
];

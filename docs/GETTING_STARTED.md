## iUork — Getting Started (Backend + App)

### Requisitos
- Node 18+ e npm
- Docker Desktop (recomendado) ou PostgreSQL 16 + PostGIS instalados localmente
- Expo (CLI via npx) e simulador iOS/Android

### Portas
- Banco de dados: 5433 (mapeado para 5432 no container)
- API: 3333

### 1) Subir o banco (PostgreSQL + PostGIS)
No diretório `server`:

```bash
cd server
docker compose up -d
```

Se já existia volume antigo e a extensão PostGIS não subir automaticamente, rode:
```bash
docker exec -it iuork_db psql -U iuork -d iuork -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 2) Configurar variáveis de ambiente
Crie/ajuste `.env` em `server`:
```ini
DATABASE_URL=postgresql://iuork:iuork@localhost:5433/iuork?schema=public
SHADOW_DATABASE_URL=postgresql://iuork:iuork@localhost:5433/iuork_shadow?schema=public
```

> Dica: a shadow DB é usada pelo Prisma para migrações. Se não existir:
```bash
docker exec -it iuork_db createdb -U iuork iuork_shadow
docker exec -it iuork_db psql -U iuork -d iuork_shadow -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### 3) Prisma (gerar client, migrar, seed)
Ainda em `server`:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
```

### 4) Iniciar a API
```bash
npm run dev
# API: http://localhost:3333
```

Endpoints (MVP):
- GET `/professionals`
- GET `/professionals/:id`
- GET `/professionals/:id/services`
- GET `/professionals/:id/reviews`
- GET `/services`
- GET `/services/:id`
- GET `/reviews?serviceId=...`

### 5) Iniciar o app (Expo)
No diretório `app`:
```bash
cd ../app
npm run start -- --clear
# ou
npm run ios
# ou
npm run android
```

Base URL do app:
- iOS simulador: usa `http://127.0.0.1:3333` por padrão
- Android emulador: usa `http://10.0.2.2:3333` por padrão
- Para apontar explicitamente:
```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:3333 npm run start -- --clear   # iOS
EXPO_PUBLIC_API_URL=http://10.0.2.2:3333 npm run start -- --clear    # Android
```

### Troubleshooting
- Porta 5432 ocupada: já mapeamos para 5433 no host. Ajuste `.env` e suba o compose novamente.
- Network Error no app: limpe cache (`--clear`), verifique baseURL e se a API está de pé.
- Migração falhou com tipos PostGIS: garantam `CREATE EXTENSION postgis;` no DB principal e no shadow, ou remova tipos `geography` do schema e prefira `latitude/longitude` numéricas.



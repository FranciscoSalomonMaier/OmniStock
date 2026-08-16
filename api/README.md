# OmniStock

Infraestrutura local e API NestJS do OmniStock. Esta etapa configura PostgreSQL, Redis, TypeORM, migrations, Swagger e health check; autenticação ainda não faz parte do projeto.

## Pré-requisitos

- Node.js 20 ou superior e npm
- Docker Desktop (ou Docker Engine com Docker Compose v2)

## Configuração do ambiente

Na raiz, copie `.env.example` para `.env` e defina uma senha local:

```bash
cp .env.example .env
```

Em `api`, copie `.env.example` para `.env`, use a mesma senha em `DB_PASSWORD` e instale as dependências:

```bash
cd api
cp .env.example .env
npm install
```

Os arquivos `.env` não devem ser versionados. Uma senha não vazia é obrigatória.

## Infraestrutura

Execute na raiz:

```bash
docker compose up -d
docker compose ps
docker compose logs -f postgres
docker compose down
```

`docker compose down` remove apenas containers e rede; os volumes permanecem.

> **Atenção:** o comando abaixo apaga permanentemente os dados locais do PostgreSQL e Redis.

```bash
docker compose down -v
```

## API e migrations

Com os containers saudáveis, execute em `api`:

```bash
npm run start:dev
```

O TypeORM usa `synchronize: false`. Em desenvolvimento (TypeScript):

```bash
npm run migration:generate -- src/database/migrations/NomeDaMigration
npm run migration:create -- src/database/migrations/NomeDaMigration
npm run migration:run
npm run migration:revert
```

Depois de `npm run build`:

```bash
npm run migration:run:prod
npm run migration:revert:prod
```

## URLs locais

- API: http://localhost:3000/api
- Health check: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs
- Frontend: http://localhost:5173
- PostgreSQL: localhost:5432
- Redis: localhost:6379

O health check consulta o PostgreSQL com `SELECT 1`. Redis está provisionado, mas ainda não possui cliente na API e não integra esse endpoint.

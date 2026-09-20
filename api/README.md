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

## Sincronização de estoque (etapa 13)

O saldo disponível do OmniStock (`saldo atual - reservado`) é a fonte da
verdade. Toda alteração efetiva desse saldo grava, na mesma transação, um evento
na outbox. Um publicador no Redis/BullMQ distribui o evento para cada anúncio
ativo vinculado ao produto e cada vínculo é processado de forma independente.

O processamento usa a versão do saldo e a chave única
`vínculo + versão do estoque` para evitar duplicidade. Antes da chamada externa,
o worker lê novamente o saldo central; eventos antigos são marcados como
`SUPERSEDED`. Falhas transitórias usam retentativa com backoff exponencial e
falhas definitivas permanecem no histórico como `FAILED`.

Variáveis de ambiente:

```ini
STOCK_SYNC_ENABLED=true
STOCK_SYNC_CONCURRENCY=5
STOCK_SYNC_MAX_ATTEMPTS=5
STOCK_SYNC_BACKOFF_MS=5000
STOCK_SYNC_DEBOUNCE_MS=2000
STOCK_SYNC_REQUEST_TIMEOUT_MS=15000
```

Endpoints administrativos (todos exigem autenticação e `X-Company-Id`):

- `GET /api/marketplace-stock-syncs`
- `POST /api/inventory/products/:productId/sync-stock`
- `POST /api/marketplace-stock-syncs/:id/retry`
- `GET /api/marketplace-stock-divergences`
- `POST /api/marketplace-stock-divergences/:id/resolve`
- `POST /api/marketplace-accounts/:accountId/reconcile-stock`

O conector do Mercado Livre envia `available_quantity` para o item ou para a
variação vinculada. Contas que usam estoque multiorigem/User Products exigem os
endpoints específicos de depósito do Mercado Livre e ainda não são atendidas por
este fluxo. Amazon, Shopee e Magalu continuam com contratos preparados, mas sem
chamadas reais de estoque até seus conectores serem implementados.

Documentação oficial consultada:

- https://developers.mercadolivre.com.br/pt_br/produto-sincronizacao-de-publicacoes
- https://developers.mercadolivre.com.br/pt_br/variacoes
- https://developers.mercadolivre.com.br/pt_br/publicacao-de-produtos/estoque-distribuido

# OmniStock

ERP com API NestJS, PostgreSQL/TypeORM e frontend React. A autenticação usa access token JWT em memória e refresh token em cookie `httpOnly` com rotação.

## Requisitos

- Node.js 20+ e npm
- Docker Desktop com Docker Compose v2

## Preparação no PowerShell

```powershell
Copy-Item .env.example .env
Copy-Item api/.env.example api/.env
Copy-Item frontend/.env.example frontend/.env
cd api; npm.cmd install; cd ..
cd frontend; npm.cmd install; cd ..
```

Preencha as senhas do PostgreSQL igualmente em `.env` e `api/.env`. Crie dois segredos JWT diferentes, com pelo menos 32 caracteres. Para gerar valores locais:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Banco e migrations

```powershell
docker compose up -d
docker compose ps
cd api
npm.cmd run migration:run
```

Outros comandos:

```powershell
npm.cmd run migration:generate -- src/database/migrations/Nome
npm.cmd run migration:create -- src/database/migrations/Nome
npm.cmd run migration:revert
```

## Administrador de desenvolvimento

Defina `ADMIN_INITIAL_PASSWORD` somente em `api/.env` e execute:

```powershell
cd api
npm.cmd run seed:admin
```

O seed é idempotente, cria `admin@omnistock.local` e se recusa a executar com `NODE_ENV=production`.

## Executar

Em terminais separados:

```powershell
cd api
npm.cmd run start:dev
```

```powershell
cd frontend
npm.cmd run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health

## Qualidade

```powershell
cd api
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run lint
npm.cmd run build

cd ../frontend
npm.cmd run lint
npm.cmd run build
```

Para parar a infraestrutura sem apagar dados, use `docker compose down`. **Atenção:** `docker compose down -v` também remove os volumes e apaga os dados locais.

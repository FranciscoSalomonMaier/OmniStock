# OmniStock

ERP com API NestJS, PostgreSQL/TypeORM e frontend React. A autenticação usa access token JWT em memória e refresh token em cookie `httpOnly` com rotação.

## Requisitos

- Node.js 20+ e npm
- Docker Desktop com Docker Compose v2

O ambiente local também usa Mailpit como servidor SMTP de desenvolvimento.

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
- Mailpit: http://localhost:8025

## Confirmação de e-mail com Mailpit

Configure em `api/.env`:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=OmniStock
SMTP_FROM_EMAIL=no-reply@omnistock.local
EMAIL_VERIFICATION_EXPIRES_IN_MINUTES=30
```

Suba e verifique os serviços:

```powershell
docker compose up -d
docker compose ps
docker compose logs -f mailpit
```

Cadastre-se em `http://localhost:5173/register`, abra `http://localhost:8025`, selecione o e-mail recebido e clique em **Confirmar meu e-mail**. O link abre `/verify-email`; depois disso, entre normalmente. Para testar o reenvio, acesse `/resend-verification`.

Se a API passar a executar dentro do Compose, altere `SMTP_HOST` de `localhost` para `mailpit`. Para SMTP de produção, substitua host, porta, modo seguro e credenciais pelos valores do provedor; nenhuma alteração no código é necessária.

O limite por IP usa o throttler do NestJS. O limite adicional de três solicitações por e-mail em 15 minutos e a trava de concorrência são mantidos em memória e servem a uma única instância. Ao escalar a API, esse estado deverá migrar para Redis.

Se o SMTP falhar após o cadastro, o usuário é preservado e a API retorna uma mensagem sem detalhes técnicos, permitindo tentar o reenvio depois.

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

## Etapa 4: empresas, permissões e senhas

Execute a migration e, opcionalmente, o seed idempotente:

```powershell
cd api
npm.cmd run migration:run
npm.cmd run seed:admin
```

O seed cria explicitamente uma empresa de desenvolvimento e associa `admin@omnistock.local` como `ADMIN`. Usuários antigos não recebem associação automática pela migration.

Depois do login, o frontend consulta `/api/companies`, permite criar/selecionar uma empresa e persiste somente seu UUID em `localStorage`. Requisições empresariais enviam `X-Company-Id`; o backend sempre revalida usuário, associação e empresa. Tokens nunca são armazenados no navegador.

Permissões aplicadas nesta etapa:

- Visualizar empresa: qualquer membro ativo.
- Editar empresa: `ADMIN` e `MANAGER`.
- Desativar empresa: somente `ADMIN`.
- Listar/adicionar/alterar/desativar membros: `ADMIN` e `MANAGER`.
- `MANAGER` não atribui nem altera `ADMIN`.
- O último `ADMIN` ativo não pode ser rebaixado ou desativado.
- `VIEWER` não executa operações de escrita.

Para testar recuperação de senha, abra `/forgot-password`, informe o e-mail e consulte o Mailpit em `http://localhost:8025`. O link expira conforme `PASSWORD_RESET_EXPIRES_IN_MINUTES` e é de uso único. Alterar a senha em `/profile` revoga o refresh token e exige novo login.

Rotas do frontend: `/companies`, `/companies/new`, `/settings/company`, `/settings/company/members` e `/profile`.

Limitações: membros são associados somente quando já possuem usuário cadastrado; convite por e-mail não foi criado. O throttling em memória é adequado a uma instância e deve usar Redis quando a API for escalada. Não existem ainda entidades de produtos, estoque ou faturamento às quais aplicar `companyId`; toda futura entidade empresarial deve filtrar por `companyId` diretamente nas consultas.

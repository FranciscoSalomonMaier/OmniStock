# OmniStock

ERP com API NestJS, PostgreSQL/TypeORM e frontend React. A autenticação usa access token JWT em memória e refresh token em cookie `httpOnly` com rotação.

## Vinculação entre produtos e anúncios (etapa 10)

`Product` é o cadastro interno e continua sendo a fonte de SKU, preço interno e estoque central. `MarketplaceListing` é a fotografia mais recente de um alvo externo importado do canal: conta, anúncio, variação, SKU externo, preço, quantidade e status. `ProductMarketplaceLink` apenas relaciona essas duas fontes; não copia tokens, preço, estoque ou identidade do marketplace.

- Um produto pode possuir vários anúncios em canais e contas diferentes.
- Cada linha de anúncio ou variação pode possuir somente um vínculo `ACTIVE`.
- Variações são linhas independentes em `marketplace_listings`, identificadas por `external_item_id` e `external_variation_id`; por isso podem apontar para produtos diferentes.
- Kits, bundles e composições de vários produtos internos não fazem parte desta etapa.
- A revinculação cria um novo registro e mantém o vínculo anterior como `INACTIVE`.
- A desvinculação não exclui produto nem anúncio e preserva usuário, data, motivo e auditoria.
- Todas as consultas usam a empresa do header `X-Company-Id`; o body não aceita `companyId`.

### Sugestões

A primeira versão sugere somente correspondência exata e não ambígua por SKU. O normalizador remove espaços externos e converte para maiúsculas, preservando caracteres significativos. SKU vazio, produto inativo, mais de um candidato ou empresa diferente não produz sugestão. Uma sugestão nunca cria vínculo sozinha: o usuário precisa confirmar e o backend recalcula o critério na aceitação.

### Concorrência, idempotência e auditoria

As mutações exigem `Idempotency-Key`, persistida em `product_marketplace_link_audits` com hash da requisição e resposta. A criação usa transação e lock pessimista no anúncio. O índice parcial PostgreSQL `UQ_pml_active_listing` garante, inclusive sob concorrência, apenas um vínculo ativo por `(company_id, marketplace_listing_id)`. Violações retornam HTTP 409 com `MARKETPLACE_LISTING_ALREADY_LINKED`.

Permissões: todos os membros ativos podem consultar. `ADMIN`, `MANAGER` e `STOCKIST` podem criar, aceitar sugestão e validar. Apenas `ADMIN` e `MANAGER` podem vincular em lote ou desvincular.

### Endpoints principais

- `POST/GET /api/product-marketplace-links`
- `GET /api/product-marketplace-links/:id`
- `POST /api/product-marketplace-links/:id/unlink`
- `POST /api/product-marketplace-links/:id/validate`
- `POST /api/product-marketplace-links/bulk`
- `GET /api/marketplace-listings/unlinked`
- `GET /api/marketplace-listings/:id/link-suggestions`
- `POST /api/marketplace-listings/:id/accept-suggestion`
- `GET /api/products/:id/marketplace-links`
- `GET /api/products/unlinked-marketplaces`

Execute a migration com `cd api` e `npm run migration:run`. Para testar: `npm test`, `npm run lint` e `npm run build`; no frontend, `npm run lint` e `npm run build`.

A criação do vínculo não sincroniza nem altera estoque ou preço. Ela prepara o caminho futuro `InventoryBalance.availableQuantity → vínculo ativo → anúncio → conexão → MarketplaceConnector`. Uma futura sincronização deverá sempre usar quantidade disponível (`currentQuantity - reservedQuantity`), mostrar valores interno/externo e exigir confirmação antes de sobrescrever o canal.

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

Limitações: membros são associados somente quando já possuem usuário cadastrado; convite por e-mail não foi criado. O throttling em memória é adequado a uma instância e deve usar Redis quando a API for escalada. Ainda não existem entidades de estoque ou faturamento; toda futura entidade empresarial deve filtrar por `companyId` diretamente nas consultas.

## Produtos e categorias

O módulo central de produtos usa as tabelas `products`, `product_categories` e `product_images`. Execute:

```powershell
cd api
npm.cmd run migration:run
```

Todas as chamadas exigem Bearer token e `X-Company-Id`. Exemplo de categoria:

```http
POST /api/product-categories
X-Company-Id: UUID
Content-Type: application/json

{"name":"Utilidades domésticas"}
```

Exemplo de produto:

```http
POST /api/products
X-Company-Id: UUID
Content-Type: application/json

{"sku":"MK001","name":"Pote Hermético 1L","unitOfMeasure":"UN","salePrice":"19.90","minimumStock":"5.000"}
```

O SKU e o código de barras são únicos por empresa; o mesmo valor pode existir em empresas diferentes. Preços são armazenados como `decimal`, peso em quilogramas e dimensões em centímetros. Preço zero é permitido, mas valores negativos não.

Imagens JPEG, PNG e WebP são enviadas em `multipart/form-data`, campo `file`, para `POST /api/products/:id/images`. Os binários ficam fora do PostgreSQL em `UPLOAD_DIR/products/{companyId}/{productId}`, sempre com nome UUID. A implementação local pode ser substituída por S3/R2 através do serviço de armazenamento.

```env
PRODUCT_IMAGE_MAX_SIZE_MB=5
PRODUCT_IMAGE_MAX_COUNT=10
UPLOAD_DIR=uploads
```

Rotas do frontend: `/products`, `/products/new`, `/products/:id`, `/products/:id/edit` e `/product-categories`.

Permissões: todos os membros ativos visualizam produtos; `ADMIN`, `MANAGER` e `STOCKIST` criam/editam e gerenciam imagens; somente `ADMIN` e `MANAGER` alteram status e categorias. `SUPPORT` e `VIEWER` nunca recebem `costPrice` da API.

O armazenamento local de imagens é próprio para desenvolvimento; produção deve usar armazenamento de objetos compartilhado.

## Estoque central

O estoque usa `InventoryBalance` como estado atual, `InventoryMovement` como livro-razão imutável e `InventoryReservation` para o ciclo de vida das reservas. O disponível é calculado como `currentQuantity - reservedQuantity`; estoque baixo significa `availableQuantity <= minimumStock`. Quantidades usam `numeric(18,3)` e cálculos em milésimos inteiros.

Toda escrita ocorre em transação e bloqueia o saldo com `SELECT FOR UPDATE`. Entrada aumenta o físico; saída consome apenas o disponível; reserva aumenta somente o reservado; cancelamento libera o reservado; baixa reduz físico e reservado; estorno repõe o físico sem recriar reserva. Movimentações não possuem edição ou exclusão.

Operações mutáveis exigem `Idempotency-Key` UUID único por empresa, persistido com o hash do payload. `expiresAt` está preparado, mas não há expiração automática sem infraestrutura de jobs. Existe um único saldo central por produto, sem depósitos. Referências `ORDER` e `SALE` estão preparadas para integrações futuras, sem implementar pedidos.

Rotas do frontend: `/inventory`, `/inventory/movements`, `/inventory/entries/new`, `/inventory/exits/new`, `/inventory/adjustments/new`, `/inventory/reservations` e `/inventory/products/:id`. Todos veem saldos; `SUPPORT` não vê movimentações; `ADMIN`, `MANAGER` e `STOCKIST` movimentam; somente `ADMIN` e `MANAGER` estornam.

```powershell
cd api
npm.cmd run migration:run
npm.cmd test -- --runInBand
npm.cmd run lint
npm.cmd run build
cd ../frontend
npm.cmd run lint
npm.cmd run build
```

Para testar concorrência, deixe disponível `1.000` e envie simultaneamente duas reservas com referências e chaves diferentes. Uma deve concluir e outra retornar `409`; o reservado deve permanecer `1.000`.
# Canais de venda (etapa 7)

Dentro de `api`, execute `npm run migration:run` e `npm run seed:sales-channels`. Para armazenar tokens, configure `MARKETPLACE_TOKEN_ENCRYPTION_KEY` com 32 bytes em Base64 e `MARKETPLACE_TOKEN_ENCRYPTION_KEY_VERSION=v1`. Gere uma chave com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` e nunca a versione.

As conexões exigem JWT e `X-Company-Id`. Esta etapa prepara contratos e armazenamento seguro, sem OAuth ou chamadas reais aos marketplaces; a validação responde explicitamente quando o conector ainda não existe.

## Mecanismo comum de marketplaces (etapa 8)

O `MarketplaceConnector` é a única interface de integração externa. O `MarketplaceConnectorRegistry` resolve Mercado Livre, Shopee, Amazon e Magalu por `SalesChannelCode`; canais manuais não entram no registry. O `MarketplaceIntegrationService` valida empresa, conexão, estado e capability antes de chamar um conector. Conectores traduzirão dados externos para `ExternalProduct` e `ExternalOrder`; serviços do ERP continuarão responsáveis por produtos, estoque, pedidos, preços e fiscal.

Todos os quatro conectores estão isolados, desabilitados por padrão e com operações `implemented: false`. Não existem clientes HTTP ou mappers enquanto os formatos oficiais não forem implementados. Habilite um scaffold com `*_CONNECTOR_ENABLED=true`; chamadas ainda retornam `CONNECTOR_NOT_IMPLEMENTED`, nunca sucesso simulado. A próxima etapa prevista é implementar o Mercado Livre com documentação e credenciais reais.

Credenciais são buscadas somente pelo `MarketplaceCredentialProvider`, usando o armazenamento AES-256-GCM existente. Controllers e frontend nunca recebem tokens. O provider serializa refresh concorrente por conexão dentro do processo; um lock distribuído deverá substituir esse mecanismo antes de escalar workers horizontalmente.

Imports possuem cursor, `updatedSince` e `pageSize`; comandos mutáveis exigem `idempotencyKey` nos tipos. Retry, rate limit, circuit breaker, BullMQ, checkpoints e histórico de execuções não foram ativados porque não há operação externa utilizável. Quando houver jobs, payloads devem conter apenas IDs, correlation ID e chave de idempotência — nunca tokens.

Execute os contract tests com `npm test -- --runInBand`. Para adicionar um conector: implemente `MarketplaceConnector`, declare capabilities separando suporte do provedor de implementação, mantenha HTTP em um ApiClient específico, mapeamento em mappers específicos, registre via injeção NestJS e passe pela suíte de contrato.

## Mercado Livre real (etapa 9)

Documentação oficial consultada em 23/08/2026:

- [Autenticação e autorização](https://developers.mercadolivre.com.br/pt_br/gerenciamento-perguntas-respostas/autenticacao-e-autorizacao)
- [Consulta de usuários (`GET /users/me`)](https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/consulta-de-usuarios)
- [Itens e buscas](https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/itens-e-buscas)
- [Pedidos](https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-vendas)
- [Envios](https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-envios)
- [Sincronização de publicações](https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/produto-sincronizacao-de-publicacoes)
- [Notificações](https://developers.mercadolivre.com.br/produto-receba-notificacoes)
- [Rate limit / erro 429](https://developers.mercadolivre.com.br/pt_br/usuarios-e-aplicativos/rate-limit-erro-429)
- [Preços de produtos](https://developers.mercadolivre.com.br/devcenter/api-de-precos)

Crie uma aplicação no DevCenter, cadastre exatamente o callback público HTTPS do backend e configure `MERCADO_LIVRE_CONNECTOR_ENABLED=true`, client ID, client secret e redirect URI. Para desenvolvimento local, use um túnel HTTPS confiável e restrito; não exponha portas, banco, Redis ou Swagger publicamente.

O OAuth guarda somente SHA-256 do state, vinculado a empresa, conexão e usuário, com validade de 10 minutos e consumo transacional único. O callback troca o code no backend, consulta `/users/me`, criptografa os tokens com AES-256-GCM e redireciona ao frontend apenas com status e connection ID. Refresh tokens são rotativos e serializados por conexão.

Imports de anúncios e pedidos usam BullMQ e persistem estruturas intermediárias, sem criar produtos, reservas ou baixas locais. Webhooks são deduplicados por hash, confirmados rapidamente e processados em fila. Jobs contêm apenas IDs. GETs transitórios repetem 429/502/503/504 com backoff e jitter; mutações de estoque/preço não recebem retry HTTP automático.

Limitações: preço de variação permanece bloqueado por falta de um formato oficial geral seguro; atualização de preço standard pode ser recusada quando o anúncio usa automação de preços; revogação remota e NF-e não foram implementadas. Testes automatizados usam mocks e nunca uma conta real.
# Etapa 11 — pedidos internos

O módulo `orders` transforma o `ExternalOrder` normalizado pelos conectores em um pedido interno independente do marketplace. O fluxo do Mercado Livre mantém `MarketplaceOrderImport` como registro intermediário e cria/atualiza o pedido interno pela chave `(companyId, salesChannelConnectionId, externalOrderId)`. Reimportações não duplicam pedidos; eventos externos mais antigos são ignorados.

Cada empresa possui uma linha em `company_order_sequences`. O próximo número é obtido em transação com bloqueio pessimista, nunca com `COUNT(*)`, e é exibido com seis dígitos. Cliente, endereço, itens, preços e dados fiscais são snapshots do momento da venda. Alterações posteriores em `Product` não reescrevem o histórico do pedido.

Os estados são deliberadamente separados em `OrderStatus`, `PaymentStatus`, `ShippingStatus` e `FiscalStatus`. O `MercadoLivreOrderStatusMapper` traduz estados externos; valores desconhecidos assumem estados seguros e geram `UNKNOWN_EXTERNAL_STATUS`. A política `OrderStatusTransitionService` impede saltos manuais inválidos. Toda alteração de estado é acompanhada por histórico imutável.

Itens são resolvidos por `MarketplaceListing` e `ProductMarketplaceLink` ativo. Um item sem vínculo permanece com `productId` nulo e gera `PRODUCT_LINK_MISSING`; nenhum produto é criado automaticamente. Divergência de totais, ausência de endereço/pagamento e status desconhecidos também geram pendências. Comissões ausentes permanecem `null` com `NOT_AVAILABLE`, sem estimativas fictícias.

Rotas empresariais (JWT + `X-Company-Id`):

- `GET /api/orders`, `/api/orders/summary` e `/api/orders/:id`;
- `GET /api/orders/:id/history`, `/issues`, `/shipment`, `/payments` e `/fiscal`;
- `POST /api/orders/:id/cancel`, `/reprocess` e `/issues/:issueId/resolve`.

Todos os perfis podem consultar. Cancelamento exige `ADMIN`, `MANAGER` ou `BILLING`; reprocessamento exige `ADMIN`, `MANAGER` ou `SUPPORT`; resolução aceita todos exceto `VIEWER`. Documento/endereço são mascarados para `STOCKIST` e `VIEWER`. Pedidos de outra empresa retornam 404.

Execute `npm run migration:run` na API após atualizar. Para validar: `npm test`, `npm run lint` e `npm run build` na API; `npm run lint` e `npm run build` no frontend.

Limitações desta etapa: não há criação manual de pedidos, emissão de NF-e nem cálculo tributário; o conector atual recebe dados limitados de cliente, endereço, pagamento, comissão e envio do endpoint de pedidos do Mercado Livre. Importar ou cancelar pedidos não cria reservas, baixas ou estornos. A próxima etapa deverá integrar o ciclo do pedido exclusivamente pelo `InventoryService`, com idempotência transacional.

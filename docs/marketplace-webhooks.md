# Etapa 14 — webhooks confiáveis

## Diagnóstico e evolução

O endpoint Mercado Livre já existia, mas só enfileirava orders_v2 diretamente na fila de importação. Tópicos desconhecidos não eram registrados; received (campo oficial) era rejeitado pelo DTO; falhas de Redis podiam deixar eventos sem recuperação. A identidade não incluía a conta nos índices. O retry administrativo criava outro caminho para o processamento.

A tabela marketplace_webhook_events foi evoluída. A recepção atual registra um evento RECEIVED com intenção durável de publicação; não faz HTTP externo, importação nem reserva. O publicador usa SELECT FOR UPDATE SKIP LOCKED, grava a geração/QUEUED e somente depois do commit publica no BullMQ. Isso impede que um consumidor rápido leia um evento ainda não confirmado. Se Redis falhar, o registro permanece recuperável. Se o processo morrer entre commit e publicação, a recuperação de QUEUED republica uma nova geração.

Não há um segundo importador: MarketplaceOrderProcessor.ingest é compartilhado entre a fila de pedidos e os handlers. A reconciliação periódica continua existindo. O retry legado passa pela mesma infraestrutura nova.

## Fontes oficiais consultadas em 13/10/2026

- [Notificações Mercado Livre](https://developers.mercadolivre.com.br/produto-receba-notificacoes)
- [Notificações em inglês](https://developers.mercadolivre.com.br/en_us/products-receive-notifications)
- [Envios](https://developers.mercadolivre.com.br/pt_br/gerenciamento-de-envios)
- [Itens de User Products](https://developers.mercadolivre.com.br/pt_br/preco-variacao)

## Origem e segurança

A documentação consultada não fornece assinatura HMAC de Mercado Livre para estes tópicos. Não usamos o mecanismo de assinatura do Mercado Pago como se fosse do Mercado Livre. Campos application_id/user_id são verificações de consistência, não prova criptográfica de origem.

A compensação é: application_id configurado, resolução única de conta conectada do marketplace, credenciais internas, consulta autenticada do recurso, confirmação de seller/collector/sender/user do recurso, idempotência, limite de tamanho, rate limiting e paths estritos. Não recebemos companyId. Toda empresa deriva da conexão armazenada. IDs informados pelo remetente não são prova de propriedade: ela é confirmada no GET oficial.

Requisições inválidas não chegam ao banco. O body original é preservado somente em memória; nem rawBody nem Authorization/cookies/assinaturas são persistidos. JSON arbitrário e campos não previstos são rejeitados. Recursos externos nunca são usados como URL arbitrária: o adapter admite apenas paths conhecidos e IDs; o API client monta as chamadas.

A payload persistida usa allowlist: resource, topic, user_id, application_id, _id, attempts, sent, received. headers_metadata aceita apenas x-request-id alfanumérico curto. correlationId é gerado internamente. Erros públicos são genéricos; erros do worker persistem classificação e HTTP status, evitando mensagens que possam conter dados pessoais ou credenciais. Detalhes administrativos não retornam payload ou tokens.

A limitação real permanece: terceiros que conheçam aplicação/conta podem gerar sinais falsos. Estes sinais só provocam leitura da API oficial; não fornecem dados de pedido/estoque confiáveis. Use proteção adicional no proxy/ingress. O rate limit padrão é por IP/processo; em múltiplas réplicas, use limite compartilhado no ingress. O cooldown por conta, locks e idempotência estão no PostgreSQL e são distribuídos.

## Eventos suportados

| Tópico | Recurso | Processamento |
|---|---|---|
| orders_v2 / orders | /orders/{id} | Importador normal e regras de reserva/cancelamento existentes |
| created_orders | /orders/{id} | Mesmo importador; reserva apenas conforme elegibilidade real |
| payments | /collections/{id} | Confirma collector/order e reimporta pedido; não baixa definitivamente |
| shipments | /shipments/{id} | Consulta envio e /items, identifica todos os pedidos, atualiza rastreio/status/histórico |
| items | /items/{id} | Atualiza anúncio externo e compara estoque; produto interno é preservado |
| stock-location | /user-products/{id}/stock | Confirma user_id, busca anúncios do User Product com paginação e compara o estoque dos vínculos |

orders_v2 não informa diretamente criação/cancelamento/aprovação. O tipo inicial ORDER_UPDATED é normalizado do tópico; o resultado registra a classificação confirmada pelo pedido. Não é inferida aprovação apenas pelo nome payments.

Tópicos desconhecidos são persistidos IGNORED. Outros domínios (mensagens, perguntas, fiscal/FBM etc.) não têm handlers de negócio nesta etapa. Shopee, Amazon e Magalu respondem explicitamente 501, sem simular processamento.

## Estoque e eventos fora de ordem

O estoque do ERP permanece a fonte de verdade. GETs de anúncios atualizam somente marketplace_listings. O handler não chama requestProduct, não escreve inventory_balances e não publica eventos de estoque. Confirmações não causam loops. Mismatch é registrado em marketplace_stock_divergences, sem duplicar divergência aberta equivalente. A classificação compara estoque esperado e último envio bem-sucedido; um envio antigo confirmado com saldo interno mais novo é tratado como STALE_EVENT.

Kits usam BundlesCompositionService.describe. Reservas, baixas explícitas e estornos continuam com snapshots e idempotência do OrderProcessingService/InventoryService. Não há baixa definitiva automática por pagamento aprovado.

Pedidos são obtidos novamente pela API; a comparação de externalUpdatedAt existente é preservada. Adicionamos preserveImportedProgress para respostas incompletas não apagarem progresso de pagamento/envio/fiscal. A importação não recria a linha de envio já existente nem apaga rastreamento. Envios usam timestamp externo e progresso confirmado; eventos antigos não regridem status. Alterações de composição posteriores não reescrevem snapshots.

Anúncio não encontrado invalida seus vínculos ativos e deixa falha para investigação, em vez de alterar produto interno.

## Estados, filas e recuperação

Fila: marketplace-webhook-processing. Job: apenas webhookEventId, marketplace, correlationId, generation.

Estados: RECEIVED → QUEUED → PROCESSING → PROCESSED; falhas transitórias → RETRYING → nova geração; falhas permanentes/esgotadas → DEAD_LETTER. Duplicatas incrementam duplicate_count e não alteram o evento original. IGNORED representa tópico/conta não processável ou ação administrativa.

- Publicador: a cada 2 segundos; lote de até 50 eventos e SKIP LOCKED entre instâncias.
- Worker: claim condicional por estado e geração, com locks advisory de sessão por evento e conta. Há no máximo um handler webhook por conta entre instâncias.
- Recuperação: QUEUED/PROCESSING antigos; para PROCESSING, só recupera se o lock da conta não estiver em uso. Geração impede jobs antigos de retomarem o evento novo.
- Retries: controlados no banco, exponenciais com jitter e Retry-After. BullMQ usa uma tentativa por geração; uma geração é um transporte, não a política de negócio.
- Rate limit externo: bloqueio compartilhado em marketplace_webhook_account_cooldowns; outros eventos da conta aguardam esse prazo sem consumir tentativa.
- DEAD_LETTER é persistido no banco como mecanismo de falha definitiva; não há segunda fila de negócio concorrente.
- Retenção BullMQ: até 2.000 jobs concluídos / 5.000 jobs com falha de infraestrutura. Falhas de negócio ficam no banco mesmo quando o job de transporte conclui.
- Os GETs respeitam timeout do client e orçamento do handler. O deadline é checado entre etapas; transações curtas de persistência não são interrompidas no meio. Recuperação nunca toma o lock de um handler ainda ativo.
- Não há transação PostgreSQL aberta durante chamadas HTTP ao marketplace. O lock de sessão da conta usa conexão dedicada; transações são reservadas a persistência e claims.

Quando Redis/banco estiverem indisponíveis, não apague registros nem invente sucesso de processamento. HTTP 200 significa recebimento persistido com intenção durável, não processamento concluído.

## Identidade e migrations

Migration: 1800000000200-EvolveMarketplaceWebhooks.

Adiciona conta externa, IDs de recursos/produto/envio, tópico, correlação, datas de processamento/retry, erro classificado, contagem de duplicatas, geração, resultados e auditoria. Inclui cooldown por conta, índices de consulta/pendências e FK composta empresa/conta.

Índices únicos: (marketplace, external_account_id, external_event_id), quando ID presente; (marketplace, external_account_id, payload_hash). Com ID oficial o hash deriva dele; sem ID usa conta/tópico/recurso/data original received (sent como fallback). Não usa attempts nem receivedAt do OmniStock. Notificações sem ID e sem qualquer data têm identidade conservadora por recurso e podem ser consolidadas; reconciliação periódica é indispensável.

Eventos existentes preservam IDs, conta, estado e conteúdo permitido. Payload legado é sanitizado e tipos são normalizados. Mensagens legadas de erro são substituídas por indicação segura. A reversão pode falhar se houver eventos com mesmo ID em contas diferentes, porque o esquema antigo exigia unicidade global; não remove dados para forçar rollback.

## HTTP e administração

Público:
- POST /api/webhooks/mercado-livre: 200 aceito/duplicado/desconhecido/conta não resolvida, após persistência; resposta não enumera contas.
- 400: JSON/formato/aplicação inválidos; 413: excesso de corpo; 429: rate limit; 503: indisponibilidade temporária. Método/rota inexistente responde 404 pelo roteador Nest.
- POST /api/webhooks/shopee, /amazon, /magalu: 501.

JWT + X-Company-Id + CompanyGuard:
- GET /api/marketplace-webhooks: page/limit, marketplace, accountId, eventType, status, externalId, dateFrom/dateTo e withError=true.
- GET /api/marketplace-webhooks/stats: agregação por estado, duplicatas e tempos médios da empresa.
- GET /api/marketplace-webhooks/:id: projeção segura de detalhes.
- POST /api/marketplace-webhooks/:id/retry e /ignore: ADMIN/MANAGER/SUPPORT; VIEWER não pode mutar.

Retry/ignore só em FAILED/DEAD_LETTER/IGNORED. Evento processado/em execução não pode ser reprocessado pelo endpoint. Retry exige conta conectada e tipo suportado; registra usuário/data, reinicia orçamento e publica por intenção durável. O endpoint legado /marketplace-webhook-events/:id/retry delega a esse serviço.

Conta desconhecida/ambígua não é associada a empresa errada. Eventos sem company_id não aparecem em páginas empresariais; investigação é operacional com acesso restrito ao banco. Não existe interface global que permita a um membro visualizar eventos de outras empresas.

Frontend: /integrations/webhooks, menu Integrações → Notificações. Lista, filtros, paginação real, detalhes, badges, duração, erro, confirmação e retorno de ações. Nenhum dado fictício. Ação Atualizar recarrega o estado; não há polling automático.

## Configuração e ativação local

Defaults documentados em api/.env.example:

```env
MARKETPLACE_WEBHOOKS_ENABLED=true
MARKETPLACE_WEBHOOK_MAX_BODY_SIZE=256kb
MARKETPLACE_WEBHOOK_RATE_LIMIT=120
MARKETPLACE_WEBHOOK_RATE_WINDOW_SECONDS=60
MARKETPLACE_WEBHOOK_MAX_ATTEMPTS=5
MARKETPLACE_WEBHOOK_BACKOFF_MS=5000
MARKETPLACE_WEBHOOK_CONCURRENCY=5
MARKETPLACE_WEBHOOK_PROCESSING_TIMEOUT_MS=30000
MARKETPLACE_WEBHOOK_STALE_MINUTES=10
```

A concorrência configurável é de 1 a 5 para reservar conexões do pool também para persistência e importação. O stale mínimo é 6 minutos para não concorrer com o máximo configurável de 5 minutos do processamento. Reutiliza MERCADO_LIVRE_CLIENT_ID, a conexão, credenciais criptografadas e renovação existentes. Não adicionar segredos no webhook.

1. Pare start:dev antes de compilar/aplicar migration.
2. Confirme que a configuração aponta ao PostgreSQL de desenvolvimento, nunca produção.
3. Em api: npm run migration:run.
4. Mantenha PostgreSQL e Redis ativos; inicie uma única API.
5. Configure URL pública HTTPS /api/webhooks/mercado-livre no DevCenter. Callback de webhook é diferente do callback OAuth.
6. Habilite os tópicos de negócio e faça homologação controlada. Não expor banco/Redis publicamente.

A migration foi testada em banco descartável; não foi aplicada automaticamente ao banco operacional nesta tarefa.

## Investigação, retenção e testes

Use a página e correlationId para encontrar erros. Verifique conexão, permissões funcionais e métricas /stats. Em QUEUE_UNAVAILABLE, restaure Redis e aguarde o publicador; não gere notificações falsas. Em AUTHENTICATION_ERROR, reconecte/renove pelo mecanismo existente e só então reenvie o evento elegível. Em DEAD_LETTER, investigue antes do retry.

Eventos/auditoria/divergências não são apagados automaticamente. Defina política de arquivo/retencão antes da produção, respeitando histórico e privacidade. O limite automático é apenas dos jobs de transporte. Não há exportador Prometheus; logs estruturados e endpoint de agregação são os pontos de instrumentação.

Testes:
- Jest: adapter oficial, payload inválido, fachada única, handlers, propriedade do recurso, confirmação/divergência, envio antigo, permissões e preservação de estados.
- PostgreSQL descartável: migrations, concorrência, índices, resolução, intenção durável, recuperação, dead-letter e retry manual.
- Redis/BullMQ descartável: publicação e consumo reais com handler externo simulado.
- HTTP Nest: 200, duplicata, aplicação inválida, companyId externo, JSON inválido, payload excessivo, endpoint não suportado e rate limit.
- A suíte de kits valida snapshots, reserva/baixa/estorno idempotentes separadamente. Nenhuma conta real foi chamada para executar estes testes.

```sh
# api, somente serviços de TESTE locais
WEBHOOK_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55442/postgres \
WEBHOOK_TEST_REDIS_PORT=55443 npm run test:webhooks:integration
```

O teste cria/remove seu próprio banco, com nome aleatório. Não use credenciais do banco operacional. Browser e entrega real pelo Mercado Livre ainda precisam de homologação. APIs de outros marketplaces, assinatura/rotação de segredos não documentadas para estes tópicos e expedição/fiscal fora dos recursos existentes permanecem fora deste escopo.

### Resultados desta execução

28 suítes Jest / 117 testes aprovados; integração PostgreSQL + Redis + HTTP aprovada; regressão de kits em banco descartável aprovada; migration testada em down/up com evento legado e sanitização; build isolado da API, build TypeScript/Vite do frontend e lint dos arquivos alterados aprovados. Nenhum banco operacional migrado, nenhum token exibido e nenhuma chamada autenticada real ao Mercado Livre durante os testes.

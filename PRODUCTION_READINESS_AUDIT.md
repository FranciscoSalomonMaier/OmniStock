# Auditoria de preparação para produção — OmniStock

## Resumo executivo

**Recomendação objetiva: não publicar para uso real neste estado.** A aplicação compila e seus testes unitários passam, mas isso não demonstra segurança operacional. Há bloqueadores em autenticação, exposição da infraestrutura, documentação pública, TLS/proxy e recuperação de dados.

Auditoria realizada em **20/10/2026**, fuso America/Sao_Paulo, sobre o commit `c7f481b` e a árvore local inicialmente limpa. **Somente este relatório foi adicionado.** Não houve correções, deploy, criação de recursos AWS, alteração no Mercado Livre, envio de e-mails, conexão ao banco operacional ou execução de migrations. Builds geraram apenas artefatos locais; o backend foi compilado em diretório temporário isolado, sem apagar `api/dist` ou interromper eventual `start:dev`.

**Contagem dos 13 requisitos:** 1 APROVADO, 7 PARCIAIS, 4 REPROVADOS, 1 PENDENTE AWS, 0 NÃO APLICÁVEL. A contagem usa a classificação principal por requisito; pendências AWS dentro de requisitos parciais não são contadas novamente.

| Requisito | Status | Risco | Evidência resumida |
|---|---|---|---|
| HTTPS | PARCIAL | Alto | URLs configuráveis e cookie Secure em produção; faltam proxy confiável, redirecionamento e headers de segurança. |
| Segredos fora do Git | PARCIAL | Alto | Ambientes locais ignorados; exemplos com campos secretos vazios; lacunas para `.env.production`, certificados e credenciais. Busca histórica sem achado confirmado. |
| Tokens criptografados | PARCIAL | Alto | AES-256-GCM com IV aleatório e tag; falta processo recuperável de rotação/gestão da chave. |
| Swagger | REPROVADO | Alto | `/api/docs` é montado incondicionalmente e sem controle específico de acesso. |
| PostgreSQL e Redis | REPROVADO | Crítico | Compose publica portas sem restringir interface; Redis sem autenticação/TLS configurados. |
| Backups | REPROVADO | Alto | Volumes existem; não há rotina automática, cópia externa, retenção nem restauração comprovada. |
| E-mail real | PARCIAL | Alto | Fluxos SMTP implementados; infraestrutura local Mailpit; provedor real e entregabilidade não demonstrados. |
| Autenticação e cookies | REPROVADO | Crítico | Flags e armazenamento bons; refresh JWT comparado diretamente por bcrypt permite equivalência indevida e compromete rotação. |
| CORS | APROVADO | Baixo, condicionado ao domínio | Origem única explícita configurável e credentials; não há wildcard ou reflexão arbitrária no código. |
| Rate limiting | PARCIAL | Alto | Throttler global e limites adicionais; armazenamento em memória, login genérico e ausência de configuração de proxy. |
| OAuth Mercado Livre | PARCIAL | Alto | State aleatório, hash, expiração e consumo sob lock; domínio/painel e callbacks em HTTPS não homologados. |
| Logs | PARCIAL | Alto | Sanitização localizada; não há política central, proteção de query strings, retenção ou captura de erros uniforme. |
| AWS Budgets | PENDENTE AWS | Financeiro médio | Não há IaC ou procedimento específico de Budgets/alertas/tags no repositório. |

### Cinco riscos mais importantes

1. **Refresh token antigo pode voltar a ser aceito após uma nova sessão:** limitação de 72 bytes do bcrypt demonstrada com JWTs sintéticos distintos; não existe consumo atômico nem família de sessões.
2. **PostgreSQL, Redis e Mailpit podem ficar acessíveis externamente** se o Compose local for usado em uma EC2 sem barreiras adicionais.
3. **HTTPS, confiança no proxy e cabeçalhos de segurança não estão preparados como uma implantação verificável**, afetando tráfego, rate limit e proteção do navegador.
4. **Swagger público por padrão**, expondo o inventário de endpoints e schemas em produção.
5. **Não existe backup automático externo com restauração testada**, incluindo banco, imagens e recuperação das chaves necessárias para ler credenciais.

Os riscos 2–4 descrevem exposição possível no deploy proposto, não uma afirmação de que exista hoje uma EC2 pública comprometida. Nenhuma AWS foi inspecionada.

## Escopo e método

Inspecionados backend, frontend, DTOs/guards, serviços de credenciais, OAuth, SMTP, workers, filtros de exceção, Compose, exemplos de ambiente, ignores, scripts, testes e documentação. Ferramentas já disponíveis: Node, npm, TypeScript, ESLint, Jest, Nest CLI, Vite, Docker Compose, Git, ripgrep e Python. Não foram instaladas dependências ou ferramentas. Gitleaks e TruffleHog não estavam disponíveis; foi usada busca heurística própria, sem exibição dos valores encontrados.

A busca no histórico percorreu **21 commits e 1.037 objetos nomeados** alcançáveis pelas referências Git locais, examinando blobs textuais de tamanho limitado e padrões de tokens/chaves/configurações sensíveis. Também foram examinados metadados de ambientes e notas locais, sem imprimir conteúdo sensível. **Não foram confirmados segredos versionados** nos padrões analisados; exemplos históricos inicialmente sinalizados por uma heurística foram descartados após corrigir a leitura de campos vazios entre linhas. Ausência de achado não comprova ausência de segredo: formatos arbitrários, blobs grandes/binários, commits inalcançáveis, branches remotos não baixados, serviços externos e backups antigos não estão certificados.

Não foram executados o e2e que importa `AppModule` nem integrações que exigem PostgreSQL/Redis. Sem ambiente descartável explicitamente separado nesta execução, esses testes poderiam inicializar workers reais a partir do `.env`. Os resultados anteriores de outras tarefas não são apresentados como testes desta auditoria. Também não foi feita varredura de vulnerabilidades CVE, teste de invasão ou teste de carga; são verificações complementares futuras.

## 1. HTTPS obrigatório

**Status: PARCIAL. Prioridade: alta.** Certificado, DNS e regras do proxy: **Pendente de configuração na AWS**.

- **Evidências e trechos:** `api/src/main.ts:18–78` cria aplicação HTTP, sem `trust proxy`, Helmet ou configuração equivalente de headers; `api/src/auth/auth.controller.ts:138–145` define `httpOnly`, `sameSite: 'lax'`, `secure` condicionado a produção e path restrito. `api/src/config/env.validation.ts` aceita URLs por Joi `.uri()`, mas não exige esquema HTTPS em produção. `frontend/src/services/api.ts:1` usa `VITE_API_URL` no build. OAuth e e-mail dependem de configurações, não de localhost fixo no código de produção.
- **Mixed content:** não foram identificadas chamadas HTTP hardcoded no código TS/TSX da interface. Exemplos de desenvolvimento usam HTTP e não devem ser reaproveitados como configuração de produção. O build local não comprova que o futuro bundle estará livre de mixed content: seu endereço de API é resolvido no build. URIs de namespace SVG não são downloads HTTP e não constituem mixed content.
- **Risco:** tráfego inseguro se publicado diretamente; identificação errada de protocolo/IP atrás de proxy; ausência de CSP, proteção contra framing e política de referrer. O cookie Secure atual é uma flag explícita e pode ser emitido sem `trust proxy`; a ausência dessa configuração afeta principalmente reconhecimento de protocolo/IP e controles dependentes deles.
- **Correção recomendada:** usar proxy reverso TLS com redirecionamento HTTP→HTTPS, manter API acessível apenas pelo proxy, configurar confiança apenas no proxy/rede efetivamente controlados e aplicar headers apropriados à versão NestJS instalada. Validar HTTPS obrigatório para URLs públicas em produção. Recomenda-se frontend e `/api` sob a mesma origem no MVP.
- **Critério objetivo de aceite:** HTTP redireciona ao HTTPS sem servir autenticação; certificado válido; API não acessível externamente por sua porta interna; `req.secure`/IP são corretos; headers recebidos não podem ser falsificados por acesso direto; navegador sem mixed content; teste de cookies de produção passa. HSTS só após comprovar todos os hosts necessários em HTTPS; não ativar preload/includeSubDomains sem verificar os subdomínios.
- **Dependências:** domínio, DNS, proxy e topologia AWS. Não há configuração de Caddy/Nginx, Dockerfile da aplicação ou Compose de produção encontrados.

## 2. Variáveis e segredos fora do Git

**Status: PARCIAL. Prioridade: alta.**

- **Evidências e trechos:** `.gitignore:1–4` cobre os três ambientes locais por caminho e notas `.txt`; `api/.gitignore` cobre `.env` e algumas variantes locais; `frontend/.gitignore` cobre `*.local`. `git check-ignore` confirmou proteção dos `.env` atuais e ausência de proteção para `api/.env.production`, `frontend/.env.production`, exemplos de caminhos PEM/PFX e um arquivo de credenciais JSON. Nenhum desses caminhos hipotéticos representa segredo efetivamente encontrado.
- **Exemplos:** `.env.example`, `api/.env.example`, `frontend/.env.example` são versionados. Os campos de senha/chave/token examinados nos exemplos atuais estão vazios; os demais campos são parâmetros de desenvolvimento. Não contêm credenciais reais identificadas. Os ambientes locais atuais não são rastreados pelo Git.
- **Risco:** adicionar futuramente `.env.production`, certificado ou export de credenciais pode vazar segredos; alterar `.gitignore` depois de um vazamento não apaga o histórico.
- **Correção recomendada:** cobrir famílias `.env*` com exceção deliberada de templates seguros, certificados/chaves e arquivos de credenciais; revisão do índice antes de commit; scanner de segredos em pre-commit/CI. Produção deve injetar segredos por mecanismo restrito, preferencialmente Secrets Manager/SSM com IAM Role, sem colocá-los no bundle Vite ou imagem. Não usar credenciais permanentes AWS na aplicação.
- **Critério objetivo de aceite:** exemplos só fictícios/vazios; testes de ignore para variantes; scanner do histórico e CI sem achados; arquivos de ambiente fora do Git, com acesso de SO restrito; apenas configuração pública no prefixo VITE_.
- **Rotação:** **nenhuma rotação obrigatória pode ser atribuída a um arquivo versionado nesta auditoria**, pois não houve achado confirmado. Se uma exposição anterior for confirmada, rotacionar conforme o tipo: senha PostgreSQL/Redis/SMTP, segredos JWT, Client Secret OAuth, credenciais AWS e tokens envolvidos. Chave de criptografia deve ser rotacionada com recriptografia/recuperação planejada; substituí-la cegamente torna tokens existentes ilegíveis. Credenciais ou links de autorização que tenham sido compartilhados fora do Git exigem avaliação independente; esta auditoria não certifica conversas ou serviços externos.
- **Dependências:** administração Git, scanner e gestão AWS de segredos; estado da conta AWS **não inspecionado**.

## 3. Criptografia dos tokens dos marketplaces

**Status: PARCIAL. Prioridade: alta.** A criptografia em repouso está implementada corretamente nos pontos examinados; a lacuna é operacional.

- **Evidências e trechos:** `sales_channel_credentials` contém `encrypted_access_token`, `encrypted_refresh_token`, IVs, tags e `encryption_key_version`; entidade em `api/src/sales-channels/entities/sales-channel-credential.entity.ts:14–26`. `SalesChannelCredentialsService.save/get` criptografa antes de salvar e recupera/descriptografa. `MarketplaceCredentialProvider` é o acesso das integrações.
- **Algoritmo/chave:** `api/src/sales-channels/token-encryption.service.ts:14–61` lê chave Base64 do ambiente, exige 32 bytes decodificados para ficar configurado, usa **AES-256-GCM**, IV aleatório de 12 bytes por operação e autenticação por tag. Não confunde hash com criptografia reversível. Não foi necessário ler tokens no banco.
- **Respostas/logs:** `api/src/sales-channels/sales-channels.service.ts:149–193` devolve indicadores de existência de token, não o token em texto; o caminho de callback salva credenciais pelo provider. A busca não identificou retorno público deliberado de tokens do marketplace. O serviço interno retorna entidades/segredos aos seus consumidores, exigindo manter a separação de DTOs no futuro.
- **Risco:** só uma chave/versão é aceita para leitura; mudar versão ou chave sem recriptografar interrompe integrações. Perder a chave inviabiliza recuperação a partir do banco. Há lock de refresh por processo, sem coordenação entre várias instâncias da API/worker.
- **Correção recomendada:** armazenamento restrito e recuperação testada da chave; procedimento de rotação com chave antiga temporariamente legível, recriptografia transacional por registro, verificação e retirada planejada da antiga; coordenação distribuída para refresh quando houver mais de um processo.
- **Critério objetivo de aceite:** teste de IVs distintos, rejeição de tag/ciphertext alterados, DTOs/logs sem segredo, backup/restauração com descriptografia de um registro de teste e ensaio de rotação. Nunca colocar a chave no mesmo arquivo público do dump.
- **Dependências:** Secrets Manager/SSM/KMS e procedimentos de recuperação **pendentes de configuração na AWS**. O uso atual não é criptografia por KMS nem um keyring completo.

## 4. Swagger protegido ou desabilitado

**Status: REPROVADO. Prioridade: alta.**

- **Evidência/trecho:** `api/src/main.ts:67–77` monta `SwaggerModule.setup('api/docs', ...)` incondicionalmente. `addBearerAuth()` descreve como autenticar chamadas; **não autentica a página nem o schema OpenAPI**. Não existe flag de desativação ou gate específico observado.
- **Risco:** exposição do inventário da API, campos fiscais e superfícies administrativas, além de interface de execução de chamadas.
- **Correção recomendada:** desabilitar em produção por padrão ou proteger UI e JSON/YAML com autenticação e rede administrativa. Revisar exemplos sem credenciais/documentos reais.
- **Critério objetivo de aceite:** em modo produção, `/api/docs` e variantes/assets/spec não são públicos; teste negativo sem sessão/rede autorizada. Não basta esconder o link da interface.
- **Dependências:** configuração de aplicação e, se necessário, proxy/SSM/VPN administrativa AWS.

## 5. PostgreSQL e Redis inacessíveis publicamente

**Status: REPROVADO. Prioridade: crítica.** Security Groups/NACL/host firewall: **Pendente de configuração na AWS**.

- **Evidências/trechos:** `docker-compose.yml:10–11` publica PostgreSQL sem interface local explícita; `:24–25` faz o mesmo com Redis; `:38–40` publica SMTP e interface do Mailpit. Na configuração Docker padrão isso permite bind em todas as interfaces, sujeito às barreiras de rede do host. Redis não tem senha/ACL/TLS/requirepass configurados; `api/src/app.module.ts:37–47` passa apenas host e porta ao BullMQ. O Compose é de infraestrutura local, não uma implantação de produção completa.
- **Persistência:** volumes PostgreSQL/Redis existem, mas `redis.restart` está configurado para não reiniciar automaticamente. Não há política explícita AOF, `noeviction`, disponibilidade ou recuperação de filas para produção. A existência de volume não comprova durabilidade de todas as alterações.
- **Risco:** acesso remoto a dados/filas; uso indevido de Redis; console de e-mails com links de recuperação expostos; perda operacional após reinício. Porta publicada não prova porta alcançável da internet: o Security Group ainda não foi definido/inspecionado.
- **Correção recomendada:** banco e Redis em rede Docker privada sem publicação no host; administração por túnel/SSM quando necessária. Se houver binding local de desenvolvimento, restringir à interface loopback. Remover Mailpit da implantação real. Usar credenciais exclusivas e menor privilégio no PostgreSQL; decidir ACL/TLS Redis conforme a rede e suporte dos clientes. Separar credencial de migration da aplicação quando viável. Definir reinício, persistência e monitoramento.
- **Critério objetivo de aceite:** testes a partir de uma máquina externa falham para DB/Redis/SMTP/Mailpit/API interna; só proxy acessa API; DB/Redis acessíveis apenas pelos consumidores autorizados. Na AWS: 80 para redirecionamento, 443 para aplicação, SSH apenas IP administrativo ou substituído por SSM. Não presumir que UFW sozinho protege portas publicadas pelo Docker.
- **Dependências:** redes/Compose de produção, configuração de host, credenciais e SG; avaliação de impacto em jobs pendentes.

## 6. Backup automático

**Status: REPROVADO. Prioridade: alta.** S3/IAM/KMS/retention AWS: **pendentes de configuração na AWS**.

- **Evidências/trechos:** `docker-compose.yml:12–13,26–27,47–49` contém volumes; não foram encontrados scripts `pg_dump`, cron/systemd timer de backup, política de retenção, envio externo ou procedimento/teste de restauração. `api/src/products/storage/local-storage.service.ts:8–30` grava imagens em disco no UPLOAD_DIR. README reconhece que armazenamento local é de desenvolvimento.
- **Risco:** perda de pedidos, cadastros, auditoria e imagens por exclusão, corrupção, ataque ou perda da EC2/EBS. Volume persistente e snapshot não testado não equivalem a backup restaurável; dump sem chave não recupera tokens criptografados.
- **Correção recomendada:** dump consistente PostgreSQL em formato comprimido, agendado; envio para bucket privado externo à instância com TLS e criptografia em repouso; IAM mínimo, retenção, versionamento/lifecycle e monitoramento de execução/falha. Backup separado das imagens/arquivos ou armazenamento primário em objetos com proteção de versões. Guardar configuração e material de recuperação das chaves por canal restrito separado. Planejar restauração compatível com versões, roles e extensão `btree_gist`.
- **Metas propostas para o MVP (não garantidas):** banco **RPO ≤ 1 hora**, **RTO ≤ 4 horas**; uploads **RPO ≤ 1 hora**, **RTO ≤ 4 horas**. Proposta inicial: dumps horários mantidos por 48 horas, diários por 14 dias e semanais por 8 semanas, ajustando a volume, custo e obrigações de retenção. Se dump horário for pesado, avaliar backup físico/PITR; não prometer RPO de uma hora com backup diário.
- **Critério objetivo de aceite:** job automático registra resultado sem documentos/segredos; falha e ausência de execução geram alerta; backup externo tem integridade verificada; restauração mensal em ambiente descartável comprova tempo, contagens, relações, imagens e leitura de credencial sintética. Registrar duração e idade do último backup restaurável.
- **Dependências:** bucket, IAM Role, criptografia, lifecycle, alertas e responsável com procedimento de restauração. Redis precisa de plano próprio de persistência/reconciliação de jobs; backup do PostgreSQL não salva automaticamente toda a fila.

## 7. Serviço real de e-mail

**Status: PARCIAL. Prioridade: alta.** Provedor/identidade/DNS/quotas: **Pendente de configuração na AWS** se escolhido SES.

- **Evidências/trechos:** `api/src/mail/mail.service.ts:11–22` usa Nodemailer/SMTP parametrizado; Compose contém Mailpit para desenvolvimento. README explica como substituir SMTP, mas não há configuração homologada de provedor real no repositório. Não foi enviada mensagem nem foi feito login SMTP nesta auditoria.
- **Fluxos:** confirmação, reenvio e reset estão implementados; `UsersController` permite mudar nome/senha, não e-mail. Não foi identificado fluxo de alteração de e-mail ou notificação de segurança: são funcionalidades ausentes, não uma falsa alegação de cobertura.
- **Tokens:** `api/src/auth/auth.service.ts:82–113,116–148,223–243` cria tokens aleatórios e armazena SHA-256, com expiração por configuração; `api/src/users/users.service.ts:93–121` limpa hashes após uso/mudança de senha. Hash é adequado para esses tokens de uso único. Os consumos são leitura seguida de atualização, sem condição transacional de uso único: requisições concorrentes podem reutilizar o mesmo token antes de ele ser limpo.
- **Enumeração/rate limit:** forgot/reenvio usam resposta genérica; cadastro informa conflito de e-mail, e login de conta não confirmada informa situação após senha válida. Há throttles específicos para recuperação/reenvio/reset, além do global. Resposta genérica não elimina diferenças de tempo. `resendHistory` é mapa local sem política global de tamanho.
- **Falhas de entrega:** envio de confirmação registra erro genérico e pode falhar o cadastro após gravar usuário; envio de reset captura falha e retorna, sem fila/retry/alerta de entrega. Expiração nominal de confirmação vem da configuração; reset tem padrão de 30 minutos no schema, sem necessidade de expor valores do ambiente local.
- **Risco:** usuários reais sem acesso por falhas de entrega; spam/abuso; reaproveitamento concorrente do link; dificuldade de operação sem métricas.
- **Correção recomendada:** SES ou SMTP transacional com TLS obrigatório conforme provedor, identidade verificada, DKIM/SPF/DMARC, bounce/complaint, quotas e política de retries. Mailpit deve existir somente em desenvolvimento. Tornar consumo de reset/confirm transacional e condicional ao hash vigente/não consumido; não registrar tokens/links.
- **Critério objetivo de aceite:** testes de entrega em homologação autorizada (não realizados aqui), expiração, uso único inclusive concorrente, revogação ao reenviar, respostas genéricas e limite por IP/conta; alerta de falhas. Para SES, confirmar acesso de produção, região, identidade e destinatários permitidos antes de atender usuários reais.
- **Dependências:** domínio, provedor, SMTP_* e política de privacidade; segurança adicional de notificação de senha pode ser planejada após o primeiro deploy, sem adiar entrega confiável de recuperação.

## 8. Cookies, access token e refresh token

**Status: REPROVADO. Prioridade: crítica.**

- **O que está correto:** `frontend/src/contexts/AuthContext.tsx:9–26` mantém access token em estado/ref de memória; não foi encontrado armazenamento de JWT em localStorage. localStorage guarda apenas ID da empresa. `api/src/auth/auth.controller.ts:138–145` usa refresh em cookie HttpOnly, Secure em produção, SameSite Lax, path `/api/auth`, sem Domain (host-only). Access token vai no header Bearer, não automaticamente em cookie. `frontend/src/services/api.ts` envia credentials, serializa refresh em voo na instância do cliente e invalida requisições ao encerrar sessão.
- **Validades:** o schema define padrões de access de 15 minutos e refresh de sete dias, com maxAge do cookie configurado separadamente. É preciso impedir divergência entre expiração do JWT e cookie. Não foram expostos valores locais.
- **Falha comprovada — bcrypt em JWT:** `api/src/auth/auth.service.ts:161–177,246–264` compara o JWT de refresh com bcrypt e grava `hash(refreshToken, 12)`. Bcrypt considera apenas os primeiros 72 bytes. Uma prova inteiramente local, usando chave aleatória efêmera e dois JWTs sintéticos assinados do mesmo usuário, retornou: tokens distintos = verdadeiro; prefixo de 72 bytes igual = verdadeiro; token antigo comparado com hash do novo = **verdadeiro**. Nenhum token real, string JWT ou chave foi impresso. Isso compromete a expectativa de rotação: token válido anterior pode ser aceito contra hash de sessão nova. Não significa que qualquer token sem assinatura seja aceito, pois há verificação JWT anterior.
- **Outras lacunas:** refresh sem jti/nonce pode repetir exatamente no mesmo segundo; leitura/comparação/atualização não são atômicas; não existe família de sessões, registro de reutilização ou CAS de consumo. Um único hash por usuário tenta limitar sessões, mas não corrige a equivalência e pode gerar races. Testes atuais usam refresh strings curtas mockadas, não cobrindo o caso de JWT real longo.
- **Logout/revogação:** logout tenta limpar o hash e o cliente limpa sessão antes da chamada; access tokens já emitidos não são individualmente revogados no logout, permanecendo válidos até expiração segundo a política atual. Revalidar uma sessão antiga após novo login é risco distinto e deve ser impedido.
- **Senha:** `api/src/users/users.service.ts:93–100` limpa refresh/reset e grava `passwordChangedAt`; `JwtStrategy:38–41` rejeita access anterior. A comparação usa segundos e `>`: token emitido no mesmo segundo da alteração pode passar. `ChangePasswordPage` limpa sessão e redireciona ao login; reset remove token da URL, mas não chama `clearSession` explicitamente. Refresh falho limpa o estado auth por `applySession(null)`, sem executar toda a rotina de limpeza de empresa/versão/evento de logout, o que merece teste de estado residual. Não se afirmou exposição entre empresas decorrente disso sem reprodução.
- **CSRF/XSS/domínios:** SameSite Lax e Bearer reduzem superfícies, mas não substituem política contra XSS nem validação Origin/CSRF para endpoints baseados no cookie. CORS não é proteção geral contra CSRF. Cookies host-only funcionam bem com mesma origem ou subdomínios same-site; domínios cross-site podem exigir outra política e sofrem bloqueios de cookies de terceiros. Não mudar indiscriminadamente para SameSite None.
- **Correção recomendada:** digest criptográfico do token completo (SHA-256/HMAC apropriado para token de alta entropia), identificador de sessão/jti e consumo/rotação atômicos; detectar replay e revogar família conforme política; versionar sessão/senha com garantia transacional. Bcrypt continua adequado para senha humana, não para comparar diretamente JWT longo. Unificar limpeza de sessão e definir revogação de access no logout intencionalmente.
- **Critério objetivo de aceite:** token anterior rejeitado depois da rotação e depois de novo login; refresh concorrente não cria reutilizações aceitas fora da política; tokens únicos; teste de senha no mesmo segundo e refresh concorrente à revogação; logout/reset/mudança de senha testados no navegador; cookies reais corretos em HTTPS; CSRF negativo; nenhuma credencial em armazenamento persistente do frontend.
- **Dependências:** mudança cuidadosamente migrada de sessão/hash, testes de regressão e topologia de domínio. Não reutilizar as sessões antigas como prova de que a correção funcionou.

## 9. CORS restrito

**Status: APROVADO no código inspecionado. Prioridade: média para validação do deploy.** Domínio oficial: **Pendente de configuração na AWS**.

- **Evidências/trechos:** `api/src/main.ts:63–66` define `origin` como valor explícito de `FRONTEND_URL` e `credentials: true`; não usa wildcard, callback permissivo nem reflexão de origem arbitrária. `env.validation.ts` exige URI; o frontend usa API configurável e cookies com credentials.
- **Risco residual:** copiar URL de desenvolvimento, configurar uma URL com path ou mudar posteriormente para wildcard quebra a integração ou amplia acesso. CORS não autentica endpoints nem bloqueia clientes fora do navegador.
- **Correção recomendada:** manter uma origem oficial exata (esquema, host e porta) por ambiente ou allowlist explícita se houver mais de uma; não adicionar barras/paths indevidos ao valor de origem. Preferir mesma origem no MVP.
- **Critério objetivo de aceite:** preflight/chamada da origem oficial funcionam com credentials; origem estrangeira, origin null e subdomínio não listado não recebem permissão CORS; teste real depois de definir domínio. Isso ainda não foi validado contra a futura AWS.
- **Dependências:** DNS, URLs públicas e decisão de topologia. A aprovação refere-se ao mecanismo atual, não à configuração AWS ainda inexistente.

## 10. Rate limiting

**Status: PARCIAL. Prioridade: alta.**

- **Evidências/trechos:** `api/src/app.module.ts:49,64` registra Throttler global de 120 requisições por minuto e guard global; armazenamento padrão da biblioteca é em memória. `auth.controller.ts:67,78,85` reforça reenvio, forgot e reset; login/cadastro/verify/refresh/logout e callback OAuth dependem apenas da política global. `mercado-livre-webhook.controller.ts:19–26` possui limite/janela configuráveis para notificações. Os valores citados são constantes/padrões do código, não extração de configurações locais.
- **Proxy:** não há trust proxy. Atrás do proxy, diversos clientes podem compartilhar o mesmo tracker e esgotar o limite uns dos outros. Em múltiplos processos, o armazenamento em memória permite multiplicação de limites e reinício zera contagens. Não recomendar confiar irrestritamente em X-Forwarded-For.
- **Risco:** brute force e abuso de custo de bcrypt; negação de serviço por bloqueio compartilhado; limitação indevida de picos legítimos dos marketplaces. O mapa de reenvio por e-mail no AuthService é local e cresce com chaves novas.
- **Correção recomendada:** política específica para login/registro/refresh/callback, por IP validado e por identidade normalizada quando pertinente; armazenamento compartilhado quando escalar; bounds/expiração dos mapas; limites distintos e mensurados para webhooks, além de limite de corpo já existente.
- **Critério objetivo de aceite:** testes com dois IPs reais atrás do proxy, duas instâncias/reinício, tentativa de spoof de forwarding headers e picos legítimos de notificações; 429 e Retry-After coerentes; alarmes sem registrar dados sensíveis.
- **Dependências:** topologia do proxy e armazenamento de limites. Usar a API compatível com a versão instalada, sem assumir recursos de versões futuras do NestJS.

## 11. Callback OAuth do Mercado Livre

**Status: PARCIAL. Prioridade: alta.** Painel e domínio: pendências manuais, não alterados.

- **Evidências/trechos:** `mercado-livre-integration.service.ts:32–55` cria state aleatório de 32 bytes, hash SHA-256, vínculo empresa/conexão/usuário e expiração de dez minutos; `:191–205` consome com lock pessimista em transação, conferindo expiração e uso anterior. `mercado-livre-api.client.ts:30–39` e `mercado-livre.connector.ts:54–85` usam a redirect URI configurada. Strings vazias passadas na interface genérica não substituem esse valor: os adaptadores usam a configuração real. `:57–115` do serviço trata erros com códigos genéricos, salva tokens criptografados e redireciona sem repassar o código OAuth ao frontend.
- **Lacunas:** validação URI não exige HTTPS em produção; não há configuração final verificável no painel. Code/state entram na query do callback e podem aparecer em logs de proxy, APM e histórico antes do redirecionamento. PKCE não está implementado neste fluxo (`codeChallenge: null`); avaliar exigência e suporte atuais do provedor antes de alterar, sem inventar regra obrigatória. Renovação de credencial usa lock em memória por processo.
- **URLs a configurar, sem inventar domínio:**
  - Redirect URI OAuth no DevCenter: **origem HTTPS pública do backend + `/api/integrations/mercado-livre/callback`**. Deve coincidir exatamente com `MERCADO_LIVRE_REDIRECT_URI` nas etapas de autorização/troca.
  - URL de notificações no DevCenter: **origem HTTPS pública do backend + `/api/webhooks/mercado-livre`**. É diferente da redirect URI OAuth.
  - URL/site da aplicação, **se esse campo estiver cadastrado/exigido no painel**: origem HTTPS real do frontend. Não é uma terceira redirect URI obrigatória inventada.
  - `FRONTEND_URL` aponta à origem real do frontend; retorno interno usa `/integrations/mercado-livre/callback`. Essa rota de interface **não substitui o callback do backend** no DevCenter. `VITE_API_URL` aponta à base pública da API terminada em `/api`.
- **Risco:** quebra da conexão após deploy; uso de HTTP; vazamento de code/state por observabilidade; renovação concorrente entre processos.
- **Correção recomendada:** configurar URLs por ambiente, validar HTTPS em produção, restringir/redigir query strings e homologar reconexão/renovação sob a topologia efetiva. Verificar permissões OAuth realmente necessárias. Remover URLs antigas de túnel/localhost do cadastro de produção quando apropriado, sem alterar a aplicação de desenvolvimento indevidamente.
- **Critério objetivo de aceite:** callback exato cadastrado; state inválido/expirado/reutilizado rejeitado; callback de erro seguro; tokens só no armazenamento criptografado; OAuth concluído em HTTPS; logs sem code/state. **Não foi acessado o painel nem executado OAuth real nesta auditoria.**
- **Dependências:** domínio, conta/app do Mercado Livre e autorização para homologação real, além de TLS e segredos AWS.

## 12. Proteção dos logs

**Status: PARCIAL. Prioridade: alta.**

- **Evidências/trechos:** `WebhookPublicExceptionFilter` registra apenas evento/status para rejeições; `api/src/fiscal/fiscal-exception.filter.ts:8–15` registra código genérico de banco; `mercado-livre-api.client.ts:261–310` remove segredos conhecidos da requisição e padrão de token de mensagens externas. Logger de conexões em `sales-channels.service.ts:198–207` usa IDs. Workers de webhook guardam erros resumidos e têm payload allowlist no adapter.
- **Lacunas:** filtro global de webhook delega erros das demais rotas ao tratamento padrão; `api/src/config/database.config.ts:18` e `database/data-source.ts` permitem logging SQL por configuração; mesmo com SQL logging desligado, um QueryFailedError não tratado pode incluir consulta/parâmetros no erro registrado. Processadores de pedidos/reconciliação e estoque persistem mensagens genéricas de `Error` em alguns caminhos (`orders/marketplace-order.processor.ts:91–100`, `marketplace-order-reconciliation.processor.ts:142–145`, `stock/marketplace-stock.processor.ts:389–394`). Truncar mensagem não equivale a sanitizar. Scripts de seed têm tratamento de erro próprio. Não há redactor central, política de retenção ou configuração de access log do proxy. Não foi encontrado logging deliberado de `.env` ou tokens em texto nos caminhos examinados, o que não elimina vazamentos em exceções futuras.
- **Risco:** informações de autenticação, documentos fiscais, dados pessoais ou corpos de requests em CloudWatch/console/filas/APM; query string de OAuth/reset e dados de banco em errors. Payload permitido de webhook é um dado persistido controlado e não deve ser confundido com um dump aceitável de log.
- **Política proposta:** log estruturado por allowlist contendo timestamp, evento, resultado, duração, request/correlation ID, IDs internos mínimos e código de erro. **Remover totalmente** Authorization, Cookie, Set-Cookie, senha/currentPassword/newPassword, accessToken/access_token, refreshToken/refresh_token, clientSecret/client_secret, JWT secrets, chaves de criptografia/AWS, code/state OAuth e connection strings. Remover query strings dos endpoints de callback/verificação/reset; não registrar link completo. Documentos CPF/CNPJ, nomes, e-mails, telefones e endereços: omitir por padrão; quando estritamente necessário para suporte autorizado, mascarar e documentar finalidade/retenção. Nunca serializar request, response, job, erro ou ambiente completo.
- **Correção recomendada:** redactor central e wrappers de erros por fronteira; sanitização antes de persistir falhas de job/integração, não apenas na tela; logs proxy sem query; DB_LOGGING desativado em produção; acesso mínimo, criptografia, retenção e alertas no destino de logs. Auditoria fiscal autorizada tem finalidade e retenção próprias e não deve ser copiada indiscriminadamente ao log operacional.
- **Critério objetivo de aceite:** testes com sentinelas sintéticas em todos esses campos asseguram ausência nos logs, erros de API, falhas de fila e access logs; demonstrar redaction também em exceção SQL e resposta externa. Validar prazo de retenção/apagamento e quem tem acesso.
- **Dependências:** proxy, logger/APM, configuração CloudWatch e política de privacidade; nenhum log real de produção foi inspecionado.

## 13. Alertas de orçamento

**Status: PENDENTE AWS — Pendente de configuração manual ou IaC. Prioridade: média, antes de criar os recursos.**

- **Evidências:** não foram encontrados Terraform/CloudFormation/CDK, AWS Budgets, destinatários, tags de custo ou runbook específico de orçamento nos arquivos examinados. Não houve chamada AWS, portanto não se afirma que a conta não tenha orçamento criado fora do repositório.
- **Risco:** custos inesperados de EC2/EBS, IPs/rede, snapshots, S3, logs e e-mail. Budget é mecanismo de aviso; não presumir corte imediato/automático de gastos ou proteção integral por Free Tier/créditos.
- **Correção recomendada:** definir orçamento mensal com responsável, moeda e destinatários aprovados; alertas de gasto real em **50%, 80%, 100%** e previsão de ultrapassar **100%**; confirmar entrega de e-mail/SNS quando usado. Habilitar alertas de Free Tier/créditos aplicáveis à conta e revisar a data/condições de expiração efetivas. Tags de custo propostas: Project=OmniStock, Environment, Owner, CostCenter; ativar cost allocation quando necessário. Considerar orçamento da conta inteira e do projeto para não esconder itens sem tag.
- **Critério objetivo de aceite:** evidência de budget/limiares/destinatários sem credenciais, alerta de teste recebido, responsável definido e revisão semanal no MVP. Registrar se valores estão incluindo ou excluindo créditos/reembolsos/tributos conforme a finalidade.
- **Dependências:** acesso Billing/Budgets, destinatários e orçamento autorizado. Nenhum valor monetário foi inventado nem recurso criado nesta tarefa.

## Validação técnica desta execução

| Verificação | Resultado | Observações |
|---|---|---|
| Ferramentas/dependências existentes | Disponíveis | Nada instalado; scanners especializados ausentes, sem instalação automática. |
| Typecheck backend | PASSOU | `node node_modules/typescript/bin/tsc --noEmit --incremental false -p tsconfig.build.json`, em api/. |
| Testes unitários backend | PASSARAM | Jest `--runInBand`: **29 suítes, 142 testes, zero falhas**. Relatório temporário de resultados, sem tokens. |
| Typecheck frontend | PASSOU | `node node_modules/typescript/bin/tsc -b --noEmit`, em frontend/. |
| Build frontend | PASSOU | `npm run build`, em frontend/. Produz build com a configuração local, não um deploy de produção homologado. |
| Build backend | PASSOU, isolado | Nest CLI `build --path` com tsconfig temporário estendendo `api/tsconfig.build.json`, saída em /tmp e typeRoots apontando aos tipos instalados da API. Nenhuma alteração em tsconfig do projeto. |
| Lint frontend | PASSOU | ESLint sem `--fix`, zero erros/avisos. |
| Lint backend | FALHOU | **1 erro de prettier/prettier**, em `api/src/database/seed-kit-demo.ts:109`; zero avisos. Nenhuma correção automática. |
| Docker Compose | PASSOU sintaticamente | `docker compose config --quiet`; não imprime o YAML interpolado, não sobe containers e não certifica segurança de rede. |
| Busca de segredos e histórico | Nenhum achado confirmado nos padrões analisados | 21 commits/1.037 objetos nomeados; `.env` reais não rastreados; limitações descritas no escopo. Nenhum valor sensível emitido. |
| Prova bcrypt/refresh | FALHA DE SEGURANÇA REPRODUZIDA | JWTs sintéticos distintos e prefixo de 72 bytes igual: bcrypt aceitou token anterior contra hash do posterior. Sem acesso externo/banco/usuários reais. |
| E2E/integrados de banco e filas | NÃO EXECUTADOS nesta auditoria | `api/test/app.e2e-spec.ts` importa AppModule real. Exigem isolamento e configuração próprios antes de iniciar os workers. |
| Testes automatizados frontend | Não há suíte própria configurada no package.json | Typecheck, lint e build não substituem testes de navegador. |
| AWS/painel Mercado Livre/TLS real/SMTP real | NÃO VALIDADOS | Nenhum acesso/alteração/envio real autorizado ou executado. |

O script `npm run lint` do backend contém `--fix`; por isso **não foi usado**. A execução chamou ESLint diretamente em modo leitura. O build Nest padrão contém `deleteOutDir`; por isso não foi executado no diretório `dist` compartilhado com desenvolvimento. A primeira tentativa de build isolado precisou ajustar a resolução do caminho e dos tipos no arquivo **temporário**, depois passou; isso não é falha de compilação atual do projeto.

## Bloqueadores absolutos para publicação com usuários reais

1. Corrigir comparação/rotação atômica de refresh tokens, sua migração e os testes com JWTs longos reais/sintéticos; cobrir revogação e recuperação concorrentes.
2. Fechar a exposição do banco/Redis/Mailpit e demonstrar SG/host/rede Docker coerentes. Não copiar o Compose local diretamente para internet.
3. Implantar TLS/proxy, identificar IP/protocolo corretamente e comprovar proteção do tráfego/cookies. Definir URLs reais de produção e rebuildar o frontend.
4. Desabilitar ou restringir Swagger e o schema OpenAPI.
5. Ter backup automático externo com restauração ensaiada do banco/imagens/chaves; atribuir responsável e alertas.
6. Homologar SMTP transacional/recuperação de conta; tornar consumo de links de segurança resistente a reuso concorrente.
7. Garantir gestão de segredos e redaction mínima, especialmente parâmetros SQL, headers e query de callback/reset. Não publicar com arquivos de ambiente/certificados acessíveis.
8. Se a operação inicial depender de Mercado Livre, concluir OAuth e notificações em HTTPS com URLs aprovadas no painel. Sem isso, somente um teste interno sem essa dependência seria possível.

São gates de saída, não mudanças feitas nesta tarefa. Um deploy privado para testes controlados só deve acontecer depois de corrigir o isolamento e usando exclusivamente dados/contas de teste, sem tratá-lo como produção liberada.

## Itens que podem evoluir depois do primeiro deploy seguro

- IaC completa, depois que os controles manuais iniciais estiverem registrados e verificados.
- Alta disponibilidade/múltiplas instâncias; antes de escalar, resolver lock distribuído de refresh e armazenamento compartilhado de rate limits.
- Painéis de operação mais completos e exportação de métricas, desde que monitoramento mínimo de falhas/backups já exista.
- Notificação adicional de alteração de senha e futuro fluxo de troca de e-mail, sem enfraquecer os fluxos atuais.
- Automação avançada da rotação de chave; um procedimento manual seguro, recuperação e ensaio de rotação continuam necessários antes do uso real.
- PITR/retention avançada e armazenamento de imagens em objetos, se a solução inicial de backup externo já cumprir RPO/RTO e restauração de arquivos.
- Ajustes cosméticos e expansão de testes de interface. O erro atual de lint deve ser resolvido no ciclo de correção/CI, apesar de não ser a principal falha de segurança.

## Variáveis de produção — apenas nomes

As listas abaixo não contêm valores. Parâmetros públicos não são todos segredos; sua presença aqui indica necessidade de decisão/configuração no deploy. São nomes existentes no projeto, exceto onde explicitamente classificados como configuração ainda a projetar.

**Aplicação, frontend e banco:**

```text
NODE_ENV
PORT
FRONTEND_URL
VITE_API_URL
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_LOGGING
DATABASE_URL
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_PORT
REDIS_HOST
REDIS_PORT
```

DATABASE_URL é reconhecida como variável opcional, mas o DataSource/configuração Nest examinados usam DB_*; defini-la sozinha não substitui esses campos. POSTGRES_* pertencem ao Compose atual, não ao cliente TypeORM. REDIS_PORT é usado em contextos de host/cliente diferentes; separar publicação externa de porta interna no Compose de produção. Não há suporte de Redis password/TLS configurado no cliente atual: adicionar apenas uma variável com nome novo não habilitaria isso.

**Autenticação e e-mail:**

```text
JWT_ACCESS_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN
JWT_REFRESH_MAX_AGE_MS
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_NAME
SMTP_FROM_EMAIL
EMAIL_VERIFICATION_EXPIRES_IN_MINUTES
PASSWORD_RESET_EXPIRES_IN_MINUTES
```

**Imagens, integrações e filas:**

```text
UPLOAD_DIR
PRODUCT_IMAGE_MAX_SIZE_MB
PRODUCT_IMAGE_MAX_COUNT
MARKETPLACE_TOKEN_ENCRYPTION_KEY
MARKETPLACE_TOKEN_ENCRYPTION_KEY_VERSION
MERCADO_LIVRE_CONNECTOR_ENABLED
MERCADO_LIVRE_CLIENT_ID
MERCADO_LIVRE_CLIENT_SECRET
MERCADO_LIVRE_REDIRECT_URI
MERCADO_LIVRE_AUTH_BASE_URL
MERCADO_LIVRE_API_BASE_URL
MERCADO_LIVRE_HTTP_TIMEOUT_MS
ORDER_SYNC_ENABLED
ORDER_SYNC_CRON
ORDER_SYNC_OVERLAP_MINUTES
ORDER_IMPORT_MAX_ATTEMPTS
ORDER_IMPORT_CONCURRENCY
STOCK_SYNC_ENABLED
STOCK_SYNC_CONCURRENCY
STOCK_SYNC_MAX_ATTEMPTS
STOCK_SYNC_BACKOFF_MS
STOCK_SYNC_DEBOUNCE_MS
STOCK_SYNC_REQUEST_TIMEOUT_MS
MARKETPLACE_WEBHOOKS_ENABLED
MARKETPLACE_WEBHOOK_MAX_BODY_SIZE
MARKETPLACE_WEBHOOK_RATE_LIMIT
MARKETPLACE_WEBHOOK_RATE_WINDOW_SECONDS
MARKETPLACE_WEBHOOK_MAX_ATTEMPTS
MARKETPLACE_WEBHOOK_BACKOFF_MS
MARKETPLACE_WEBHOOK_CONCURRENCY
MARKETPLACE_WEBHOOK_PROCESSING_TIMEOUT_MS
MARKETPLACE_WEBHOOK_STALE_MINUTES
SHOPEE_CONNECTOR_ENABLED
AMAZON_CONNECTOR_ENABLED
MAGALU_CONNECTOR_ENABLED
```

ADMIN_INITIAL_PASSWORD existe somente para bootstrap/seed autorizado; não usar o seed de desenvolvimento nem deixar essa senha como um mecanismo de acesso permanente em produção. Somente VITE_API_URL é configuração pública do frontend; segredos nunca devem receber prefixo VITE_.

Não existem ainda flags implementadas para Swagger de produção, proxy confiável, Redis ACL/TLS, backups S3 ou redactor. Seus nomes e validação devem ser definidos na tarefa de implementação: este relatório não apresenta nomes inventados como se já funcionassem. AWS deve preferir IAM Role da instância, em lugar de acrescentar chaves AWS estáticas ao `.env`.

## Alterações manuais necessárias na AWS

Todas **pendentes de configuração na AWS**, sem criação ou inspeção da conta nesta execução:

- Definir região, domínio, DNS, proxy/TLS e endpoint público; não foi inventado domínio ou arquitetura final.
- EC2 com atualizações de SO, IAM Role mínima, IMDSv2, volumes criptografados e acesso administrativo restrito por SSM ou IP autorizado. Medir limites de CPU/memória/disco e manter alertas.
- Security Group com 443 público, 80 somente para redirecionamento, sem DB/Redis/API interna/Mailpit públicos; validar também host e redes Docker.
- Injetar segredos via Secrets Manager/Parameter Store e definir responsáveis por acesso/rotação/recuperação; permissões não devem ser distribuídas ao frontend.
- Bucket privado para backups/arquivos conforme desenho, bloqueio de acesso público, criptografia, versionamento/lifecycle, retenção e IAM por prefixo/finalidade. Recuperação de chave em canal separado.
- Provedor SMTP/SES, região/identidade, DNS e autorização de produção quando aplicável; plano de bounce/complaint e alarmes. Não enviar e-mails reais como parte desta auditoria.
- Destino de logs com acesso restrito, retenção, redaction na origem e alarmes de erro/fila/backup; observar uso de disco e crescimento de jobs/eventos/auditoria.
- AWS Budgets/alertas reais e previstos, Free Tier/créditos, destinatários e tags. Esses alertas não substituem revisão de custo nem são um limite de gasto automático.
- Registrar procedimento de deploy/rollback, migrations autorizadas e compatibilidade de schema. Não iniciar migrations automaticamente de forma concorrente em cada container.

## Alterações manuais necessárias no Mercado Livre

Quando forem definidos os domínios, e somente com autorização:

1. Atualizar a redirect URI cadastrada para a URL HTTPS exata do backend com `/api/integrations/mercado-livre/callback`.
2. Atualizar a URL de notificações para a URL HTTPS exata do backend com `/api/webhooks/mercado-livre` e conferir tópicos necessários.
3. Se aplicável ao cadastro existente, atualizar URL/site da aplicação com o frontend real; revisar app, permissões e conta vendedora habilitada, sem ampliar escopos arbitrariamente.
4. Configurar os nomes de ambiente correspondentes e rebuildar o frontend; remover dependência de túneis de desenvolvimento no ambiente de produção.
5. Homologar conexão, state de uso único, refresh e entrega/repetição de webhook com conta/dados apropriados. Verificar no painel a coincidência exata das URLs; não foi possível confirmá-la por leitura do repositório.

## Plano de correção e ordem recomendada

Estimativas são de complexidade, não prazos ou autorização de implementação.

| Ordem / tarefa | Prioridade | Complexidade | Entregável e critério de conclusão |
|---|---|---|---|
| 1. Corrigir digest de refresh e unicidade | Crítica | Média | Digest completo + jti; teste antigo/novo, mesmo segundo e sessão após login novo. |
| 2. Tornar rotação/revogação atômicas | Crítica | Alta | Sessão/família/versão, política de replay e testes concorrentes; migração planejada das sessões existentes. |
| 3. Consumo atômico de reset/confirm | Alta | Média | Uso único sob concorrência e revogação demonstrados. |
| 4. Ampliar ignores e scanner CI | Alta | Baixa | Famílias de ambiente/chaves protegidas e índice/histórico revisados sem expor valores. |
| 5. Desativar/proteger Swagger | Alta | Baixa | UI e specs inacessíveis publicamente em modo produção. |
| 6. Projetar domínios/proxy/containers de aplicação | Alta | Média | Dockerfiles/builds reprodutíveis, produção sem Vite dev server, proxy com SPA fallback e roteamento /api; plano de rollback. |
| 7. Fechar portas e aplicar mínimo privilégio | Crítica | Média | DB/Redis internos, sem Mailpit público; varredura externa de portas permitidas aprovada. |
| 8. Configurar TLS/proxy/headers/CORS | Alta | Média | HTTPS redirecionado, IP/protocolo corretos e testes de cookie/origem; CSP/HSTS introduzidos com validação. |
| 9. Segredos e recuperação da chave de tokens | Alta | Média | IAM Role, injeção restrita e procedimento testado de recuperação/rotação. |
| 10. Backup automático do banco e uploads | Alta | Média | Agendamento, envio externo criptografado, retenção e alertas. |
| 11. Ensaio de restauração | Alta | Média | RPO/RTO medidos; arquivos e credenciais sintéticas recuperáveis; runbook com responsável. |
| 12. SMTP transacional/SES | Alta | Média | Configuração real homologada em tarefa autorizada, DNS/quotas/entrega e falhas observáveis. |
| 13. Redaction central e observabilidade mínima | Alta | Média | Sentinelas ausentes de logs/SQL/jobs/proxy e retenção/acesso definidos. |
| 14. Rate limiting por risco e topologia | Alta | Média | IP real, limites específicos; armazenamento compartilhado antes de múltiplas instâncias. |
| 15. OAuth/notificações de produção | Alta | Média | Domínios configurados no painel e homologação ponta a ponta autorizada, sem códigos nos logs. |
| 16. Budgets, tags e alertas AWS | Média | Baixa | Limiares/destinatários testados antes de ampliar consumo; orçamento aprovado pelos responsáveis. |
| 17. Corrigir lint e criar gates de release | Média | Baixa | Seed formatado em tarefa separada; lint/typecheck/testes/build sem falhas, sem auto-fix no gate. |
| 18. Homologação de navegador/carga/recuperação | Alta | Alta | Login, refresh, senha, empresa, OAuth, filas e backup em infraestrutura representativa; inventário de dependências/CVEs e capacidade revisados. |

Tarefas independentes podem ser planejadas em paralelo, mas os bloqueadores devem passar antes da liberação real. Não se deve avançar para uma AWS pública simplesmente porque os testes unitários passaram.

## Checklist final de publicação

- [ ] Digest/rotação de refresh corrigidos e testados com JWTs completos, reuso e concorrência.
- [ ] Consumo de links de segurança/revogação de senha atômicos e testados.
- [ ] Segredos/certificados fora do Git, imagem e frontend; scanner e recuperação de chave validados.
- [ ] Build reprodutível de produção de API/frontend e artefatos identificados para rollback.
- [ ] Lint, typecheck, testes e builds passando; integração/e2e em ambiente seguro separado.
- [ ] Domínios definidos, HTTPS válido e HTTP redirecionado; mixed content ausente.
- [ ] Proxy confiável restrito; forwarding headers falsos rejeitados/ignorados; cookies reais testados.
- [ ] Swagger UI e schema protegidos ou desabilitados.
- [ ] PostgreSQL/Redis/API interna/Mailpit não acessíveis publicamente; SG/host/Docker conferidos externamente.
- [ ] Persistência/reinício/recuperação de filas e capacidade de disco monitorados.
- [ ] Backup automático externo criptografado com alerta e restauração dentro das metas RPO/RTO.
- [ ] Imagens e chaves necessárias cobertas por estratégia própria de recuperação.
- [ ] SMTP real homologado, com identidade/quotas/DNS/falhas e privacidade adequados.
- [ ] CORS apenas origem oficial; rate limits compatíveis com proxy e volume legítimo.
- [ ] Logs/proxy/APM/SQL/jobs sem tokens, documentos e query strings sensíveis.
- [ ] OAuth e notificações configurados e homologados no domínio final, se necessários à operação inicial.
- [ ] Budget mensal e alertas 50/80/100% + previsão; Free Tier/créditos e destinatários verificados.
- [ ] Responsáveis por incidentes, backup, chaves, custo e rollback identificados.
- [ ] Aprovação explícita dos responsáveis para publicar; nenhuma emissão fiscal real pressuposta por este relatório.

## Referências técnicas primárias

Consultadas em 20/10/2026. Servem para recomendações; não certificam configuração de conta ou infraestrutura que não foi acessada.

- [NestJS — Throttler, proxies e armazenamento](https://docs.nestjs.com/security/rate-limiting): armazenamento padrão em memória e necessidade de considerar proxy.
- [Express — atrás de proxies](https://expressjs.com/en/guide/behind-proxies.html): confiar somente na topologia controlada, com cabeçalhos encaminhados corretamente.
- [bcrypt — implementação oficial](https://github.com/kelektiv/node.bcrypt.js/): limite de 72 bytes, confirmado também pela prova local desta auditoria.
- [AWS — Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html) e [boas práticas](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html): alertas reais/previstos e confirmação de notificações.
- [AWS — Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html): consultar condições/alertas efetivos da conta, sem presumir gratuidade.
- [AWS — SES, acesso de produção](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html): sandbox/acesso de produção e identidades verificadas.
- [AWS — criptografia S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html) e [versionamento](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html): proteção de objetos e retenção de versões, sem substituir teste de restauração.

**Decisão final: não publicar para uso real.** O relatório identifica trabalho de preparação; não implementa nem autoriza deploy ou correções automaticamente.

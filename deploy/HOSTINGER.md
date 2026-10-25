# Preparação do OmniStock para VPS Hostinger

Esta configuração é para **VPS com Docker Engine e Compose v2.24 ou superior**, não hospedagem compartilhada. Os passos deste documento são instruções para uma publicação futura: nenhum servidor foi alterado automaticamente.

## O que está preparado

- API em Node 22, build por `npm ci`, execução sem root; migrations disponíveis na mesma imagem.
- Frontend compilado com `VITE_API_URL=/api`, servido por Nginx com fallback para React Router e `/healthz`.
- Caddy publica apenas 80/443, obtém/renova TLS para o domínio e preserva `/api` ao encaminhar. API, PostgreSQL, Redis e frontend não publicam portas no host.
- Cabeçalhos de segurança, CSP da aplicação, HSTS inicial de um dia sem preload/includeSubDomains, sem access log de URLs com tokens.
- Swagger desabilitado pelo backend em produção e bloqueado pelo proxy. Confiança em exatamente um proxy; não publique a porta da API nem coloque CDN/proxy adicional sem revisar essa topologia.
- Logs Docker limitados; Redis AOF/noeviction; volumes para banco, Redis, uploads e certificados.
- Cookies HttpOnly/Secure em produção e autenticação com rotação atômica por digest SHA-256 do refresh completo. Refresh tem jti aleatório. Não há nova migration de autenticação: as colunas existentes comportam o digest. **Refresh hashes bcrypt anteriores deixam de funcionar e exigem novo login.** Continua existindo apenas uma sessão de refresh corrente por usuário, sem histórico de famílias ou painel de dispositivos. Access emitido antes de logout pode continuar válido até expirar; troca/reset de senha revoga também access pela versão da senha.
- Confirmação e reset consomem seu hash uma única vez com UPDATE condicional e expiração. Senhas humanas continuam usando bcrypt. O estado de empresa no frontend também é limpo quando o refresh falha.

A auditoria `PRODUCTION_READINESS_AUDIT.md` é o retrato anterior e não uma certificação desta configuração. TLS real, entregabilidade SMTP, domínio, firewall, capacidade e alertas continuam dependendo de configuração e homologação.

## 1. Preparar arquivos e segredos

Versionar os Dockerfiles, arquivos de configuração, scripts e templates. **Não versionar nem colocar na imagem** `.env`, `.env.production`, chaves, certificados, dumps ou uploads. Os templates `.env*.example` são públicos e não devem receber valores reais.

Na primeira configuração, copiar `.env.production.example` para `.env.production` **somente se esse arquivo ainda não existir**. Não substituir um arquivo já preenchido. Ajustar sua permissão para 600 e manter acesso somente ao administrador responsável.

Preencher:

- `APP_DOMAIN`: domínio real apontado à VPS, somente hostname. Sem `https://`, porta, barra ou caminho.
- `ACME_EMAIL`: e-mail do responsável pelos certificados.
- Senha exclusiva do PostgreSQL e dois segredos JWT diferentes com pelo menos 32 caracteres aleatórios. Não usar exemplos de teste.
- `MARKETPLACE_TOKEN_ENCRYPTION_KEY`: Base64 de **32 bytes aleatórios**. Se importar banco que já contém credenciais, **preservar a chave e sua versão correspondentes**; gerar outra tornará os tokens ilegíveis. Manter cópia de recuperação restrita separada dos backups.
- SMTP do provedor real: host, porta, usuário, senha, remetente e domínio autorizado. Porta 587 normalmente usa STARTTLS (`SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=true`); porta 465 normalmente TLS desde a conexão (`SMTP_SECURE=true`). Confirmar os dados com o provedor; não copiar configuração Mailpit. SMTP_REQUIRE_TLS é obrigatório em produção.
- Mercado Livre: habilitar somente depois de informar client ID, Client Secret e callback HTTPS exato. O padrão é desabilitado, sem inventar credenciais.

Para volumes de uploads já existentes, conferir acesso do usuário node (UID 1000) antes da atualização.

O `.env.production` existente foi preservado; campos de e-mail ausentes foram acrescentados vazios ou com padrões técnicos. Ainda é necessário preencher os campos específicos do provedor. **Não substitua senhas de um banco existente apenas editando o `.env`**: POSTGRES_PASSWORD inicializa um volume novo, não troca a senha de um cluster já criado.

O wrapper `./deploy/compose.sh` sempre seleciona `.env.production` para interpolação e `compose.production.yml` como configuração. `env_file` sozinho não substitui `--env-file` do Compose. Evitar `docker compose config` sem `--quiet`, pois sua saída pode conter segredos resolvidos.

## 2. Transferir para a VPS

Enviar código e configurações por Git ou transferência restrita; os segredos devem ser provisionados separadamente com permissões restritas. Não copiar `node_modules`, `dist` local, ambientes de desenvolvimento, `.git` se desnecessário, uploads ou dumps sem um plano específico de migração de dados. Os builds usam os lockfiles.

Banco e uploads locais **não são transferidos por enviar o código**. Importar dados existentes exige backup consistente, plano de restauração, confirmação do destino e preservação da chave de criptografia. Não executar uma importação sobre banco real sem autorização.

A VPS precisa de Docker/Compose instalados e atualizados, espaço para builds/volumes e firewall que permita 80/443. SSH apenas para IPs administrativos autorizados. Não publicar PostgreSQL, Redis, API interna, Mailpit ou interface administrativa. O grupo Docker concede privilégios elevados ao usuário: limitar os membros.

## 3. Validar e construir (na publicação futura)

Na raiz do projeto, depois de completar `.env.production`:

```sh
./deploy/compose.sh --profile tools config --quiet
./deploy/compose.sh build api frontend
```

Validação das variáveis dentro da imagem, sem iniciar API ou banco e sem imprimir valores:

```sh
./deploy/compose.sh run --rm --no-deps api node -e 'const s=require("./dist/config/env.validation").envValidationSchema;const r=s.validate(process.env,{allowUnknown:true,abortEarly:false});if(r.error){console.error("Campos inválidos:",r.error.details.map(d=>d.path.join(".")));process.exit(1)}console.log("Configuração válida")'
```

Usar um `IMAGE_TAG` de release diferente a cada publicação e registrar o commit. As tags base são versionadas por major/canal; para releases de produção homologadas, registrar/pinar os digests das imagens base e revisar atualizações de segurança. Não adotar `latest` da aplicação como histórico de rollback.

## 4. Migrations antes de abrir a aplicação

Antes de atualizar uma instalação existente: verificar backup externo recente e ensaio de restauração, agendar janela de manutenção e interromper escrita da versão anterior. Não manter versões escrevendo enquanto o schema estiver em transição.

Na instalação inicial:

```sh
./deploy/compose.sh up -d postgres redis
./deploy/compose.sh --profile tools run --rm migrate
# Somente se a migration terminou com sucesso:
./deploy/compose.sh up -d api frontend proxy
```

O serviço `migrate` é uma ferramenta separada e não roda automaticamente em cada início da API. Se falhar, **não abrir a aplicação**. Em rollback, não usar `migration:revert:prod` indiscriminadamente: certas migrations removem dados. Definir compatibilidade de schema, imagem anterior e recuperação com backup antes da atualização.

Nunca usar `down -v` em produção: ele remove volumes. A documentação não autoriza esse comando. Não usar seeds de desenvolvimento. A preparação não cria administrador real automaticamente; o fluxo autorizado de criação e associação de empresas precisa ser homologado antes de abrir o acesso.

## 5. Homologar domínio, e-mail e Mercado Livre

1. Configurar DNS A/AAAA corretamente. Não manter AAAA apontado para endereço que não atende à VPS.
2. Abrir somente as portas esperadas; verificar certificado e redirecionamento HTTP→HTTPS. Caddy precisa alcançar as autoridades certificadoras; não gerar certificados com domínio de exemplo. A renovação usa o volume caddy_data.
3. Inicialmente usar DNS direto à VPS. Se houver Cloudflare/CDN ou load balancer adicional, revisar confiança nos proxies e identificação do IP antes de habilitá-lo. Não ativar confiança irrestrita em headers encaminhados.
4. Testar login, refresh, logout, atualização de página, mudança/reset de senha, confirmação de e-mail, troca de empresa, imagens e rotas React. Testar origem não autorizada e ausência pública de `/api/docs`, `/api/docs-json` e `/api/docs-yaml`.
5. Enviar testes de e-mail somente em homologação autorizada; confirmar SPF/DKIM/DMARC, quotas e recuperação de falhas conforme o provedor. Não há Mailpit no Compose de produção.
6. No DevCenter do Mercado Livre: redirect URI = origem HTTPS do backend + `/api/integrations/mercado-livre/callback`; notificações = mesma origem + `/api/webhooks/mercado-livre`. O retorno de interface `/integrations/mercado-livre/callback` não substitui o callback do backend. Conferir escopos e reconectar em ambiente autorizado.

Rate limits de login/cadastro/reset foram reforçados; o armazenamento continua em memória. Este desenho prevê **uma API**, não réplicas horizontais. Antes de escalar, implementar armazenamento compartilhado de limites e coordenar também o refresh das credenciais dos marketplaces entre processos.

## 6. Backups

A automação de backups foi retirada desta entrega por decisão do projeto. Não há serviço, perfil ou credenciais de backup a configurar no Compose atual.

## Verificações e limites da entrega

Os testes de autenticação usam PostgreSQL descartável e valores sintéticos, sem enviar e-mail ou consultar marketplaces. Novos arquivos não contêm credenciais. A imagem da API omite `.env`, fontes de teste e dependências de desenvolvimento; imagem final executa como usuário node. A imagem frontend contém apenas arquivos estáticos públicos e configuração do Nginx.

Ainda dependem de dados/ações do responsável: confirmação de VPS, domínio, DNS, provedor SMTP, credenciais, alertas, migração autorizada dos dados e homologação real. Não houve acesso SSH, upload, emissão fiscal, commit ou push.

Referências: [Compose e interpolação](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/), [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [HTTPS automático do Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy). O Caddy está na borda pública e, por padrão, não confia em X-Forwarded-* fornecido pelo cliente; a API confia num salto porque só é alcançada pelo proxy na rede Docker privada.

### Validação local realizada nesta preparação

- 30 suítes e **151 testes unitários** aprovados; typecheck da API e lint dos arquivos alterados aprovados; lint do frontend aprovado.
- Builds Docker da API e frontend concluídos. Caddy validado sem rede; Nginx validado, healthcheck e fallback React testados sem portas públicas.
- Integração de autenticação em PostgreSQL descartável: unicidade do JWT, rejeição de sessão antiga, compare-and-swap concorrente, logout, versão da senha, rejeição de hashes legados e uso único de confirmação/reset aprovados.
- Compose validado com valores sintéticos e todos os perfis. Não foram executadas migrations em banco operacional nem acessado servidor Hostinger.

Para repetir a integração de sessão no ambiente de desenvolvimento, usar `AUTH_TEST_DATABASE_URL` apontando exclusivamente a PostgreSQL local descartável e `npm run test:auth:integration` dentro de api/.

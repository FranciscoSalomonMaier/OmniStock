# Módulo fiscal — etapa 15

Implementação cadastral, sem emissão. Consulta de fontes: **15/10/2026**.

## Diagnóstico e compatibilidade

Antes desta etapa, `companies` já tinha `document` (CNPJ), razão social, nome fantasia, e-mail e telefone. `products` já tinha `ncm`, `cest`, `default_cfop`, `merchandise_origin` e `unit_of_measure`. `order_customers`, `order_addresses` e `order_fiscal_data` armazenam dados importados do destinatário/pedido. Não existia endereço cadastral reutilizável de estabelecimento, perfil fiscal versionado ou catálogo de permissões efetivas: a autorização era por `CompanyRole`.

Nenhuma coluna anterior é removida. A migration copia exatamente NCM, CEST, CFOP, origem e unidade **comercial** dos produtos existentes para a primeira versão de perfil fiscal. Não deduz unidade tributável, fator, CST/CSOSN, tributo ou classificação de kit. Valores legados potencialmente incorretos permanecem preservados e sujeitos à revisão. Empresas não são convertidas automaticamente em estabelecimentos, pois faltam endereço, CRT e inscrições confiáveis.

O perfil fiscal versionado é a fonte do novo módulo. Os campos básicos antigos continuam sendo compatibilidade do cadastro/importação e não são sincronizados automaticamente: alterações posteriores nos campos antigos não aprovam nem alteram perfis fiscais. A interface identifica a seção antiga como legado. Novos produtos podem ser cadastrados sem perfil; sua preparação fiscal é feita depois de salvar o produto. Não se alteram pedidos, composição de kits, reservas, saldos ou snapshots históricos.

## Estrutura e migration

`1800000000300-CreateFiscalModule.ts`, com `synchronize: false`:

- `fiscal_addresses`: endereço brasileiro cadastral, CEP, município/UF e país com código NF-e separado; versões de endereço são preservadas ao editar estabelecimento.
- `fiscal_establishments`: matriz/filiais, CNPJ numérico ou alfanumérico normalizado, inscrições, CRT explícito, situação e revisão. CNPJ único na estrutura fiscal; índice parcial assegura um único padrão **ativo** por empresa.
- `fiscal_document_settings`: modelo 55, ambiente, série, próximo número, versão de número e estado ativo. Identidade da sequência imutável: crie outra configuração para outro ambiente/série. Unique também sobre sequências inativas para não reiniciar uma identidade existente.
- `product_fiscal_profiles`: versões, vigência `[início, fim)`, classificações, unidades, fator e alíquotas. Restrição PostgreSQL `EXCLUDE USING gist` evita sobreposição de perfis ativos. Usa extensão PostgreSQL `btree_gist` (permissão de instalação necessária; não é removida no rollback por poder ser compartilhada).
- `product_tax_rules`: escopo por empresa/estabelecimento/produto/tributo/operação/destinatário/UF, prioridade, vigência e campos tributários extensíveis. `tax_type` é um código extensível, não enum de banco.
- `fiscal_audit_logs`: antes/depois, ação, responsável, motivo, correlação e data. Trigger impede UPDATE/DELETE inclusive pelo repositório comum; migração de rollback remove a tabela explicitamente.
- `fiscal_permission_overrides`: concessões/bloqueios por usuário, empresa e permissão, vinculadas à associação da empresa.

FKs compostas impedem relacionar endereço, produto ou estabelecimento de outra empresa. Todas as consultas de registros usam empresa + ID. Operações de escrita serializam por lock da empresa em transação; assim, definição de padrão, revisão, versões e detecção de regras conflitantes são atômicas. Para regras, a sobreposição também considera escopos genéricos (destinatário ANY e UFs não especificadas); prioridades diferentes são permitidas. A garantia para escopos genéricos depende do serviço transacional, não de escritas SQL administrativas que o contornem.

## Vigência, revisão e histórico

Perfis de produto e regras tributárias usam `valid_from`, `valid_until`, `active`, `version` e `timestamptz`. Nova versão fecha a anterior no início informado; se o início coincidir, inativa a anterior. Não é permitido substituir implicitamente uma versão futura com um início anterior ao dela. Perfis anteriores permanecem consultáveis; regras anteriores ficam na listagem e nos logs. Edições de regras retornam **um novo ID**.

Estabelecimentos têm versão e histórico por auditoria, sem agendamento futuro de suas alterações. Sequências têm versão cadastral e `number_version`, sem períodos de vigência sobrepostos: a identidade é única. Não há exclusão física pelos endpoints.

Revisão: `NOT_REVIEWED` → `PENDING_REVIEW` → `APPROVED` ou `REJECTED`. Aprovar/rejeitar exige referência do contador e observação; grava usuário e data. Alteração relevante cria versão não revisada ou invalida aprovação do estabelecimento. As versões anteriores conservam sua revisão. Aprovação representa registro da análise do responsável, nunca garantia de conformidade fiscal.

`FiscalSnapshot` define o contrato futuro com empresa, data da operação e IDs/versões/dados de estabelecimento, produtos e regras. Nenhum snapshot é adicionado retroativamente aos pedidos. O futuro emissor precisará resolver os dados vigentes na data da operação e congelá-los no documento, sem ler cadastros mutáveis para reproduzir notas anteriores.

## Numeração e ambientes

Séries de aplicativo do contribuinte emitente CNPJ: **0–889**. Próximo número inteiro **1–999999999**. Emissão normal (`1`); não se habilitam contingências nesta etapa. Homologação e produção são identidades independentes. Configurações nascem inativas e produção exige confirmação explícita tanto no cadastro quanto na ativação.

Mudança do próximo número tem endpoint exclusivo, permissão especial, justificativa de pelo menos cinco caracteres e `expectedVersion`. Dois pedidos concorrentes com a mesma versão não podem ambos alterar a sequência: o segundo recebe 409. Redução também exige `allowDecrease: true`, sempre com permissão especial e auditoria.

`FiscalNumberReservationService` / `ReservedFiscalNumber` são contratos. O provider atual **recusa a reserva com 501**, sem consumir nem simular número. O lock e controle de versão já protegem a administração da sequência; a política futura de reserva para emissões terá de adicionar reservas duráveis, idempotência, concorrência, rollback e inutilização legalmente corretos. Não se incrementa número ao consultar prontidão, salvar produto ou receber pedido.

## Validações e limites fiscais

- CNPJ: 14 posições, normalização e DV módulo 11, incluindo alfanumérico (ASCII menos 48), sem consulta cadastral externa. A coluna antiga da empresa é preservada.
- IE: contribuinte exige inscrição não ISENTO; isento permite vazio/ISENTO. A aplicabilidade legal e DV por UF não são inferidos. Indicações são cadastrais e deverão ser mapeadas conforme o contexto no futuro XML.
- Endereço: CEP de oito dígitos; UF válida e prefixo do código IBGE de sete dígitos compatível. **Não há catálogo completo de municípios instalado**: existência e vigência são conferências pendentes. País usa código de quatro dígitos da NF-e, diferente do ISO usado pelos endereços importados de pedidos.
- NCM oito dígitos; CEST opcional de sete; CFOP quatro dígitos iniciando em 1/2/3 (entrada) ou 5/6/7 (saída). Regras verificam direção da operação. Um CFOP padrão não resolve todas as operações. Não se deduz aplicabilidade de CEST a partir do NCM.
- CST ICMS, CSOSN, CST IPI/PIS/COFINS e origem usam domínios explícitos; CST ICMS é separado da origem. CST e CSOSN são excludentes. CRT 1/4 usa CSOSN, CRT 2/3 usa CST ICMS; particularidades de operação/MEI continuam sujeitas à tabela/regra oficial e análise contábil. Nenhum código é escolhido automaticamente.
- Unidades distintas, até seis caracteres, fator positivo `numeric(18,6)`. Percentuais em `numeric(7,4)`, intervalo técnico 0–100. Alíquota por quantidade em `numeric(18,6)`, não negativa. API exige strings decimais, rejeitando números binários e escala excedida; PostgreSQL retorna strings. Não há cálculo tributário com Number.
- IBS/CBS: CST (3), classificação (6) e alíquotas opcionais; IS tem código e alíquota opcionais. **Formato não valida existência, vigência ou combinação nas tabelas dinâmicas oficiais.** Não há obrigatoriedade geral nem alíquota presumida da reforma.
- Dados legados não passam por limpeza destrutiva. Nenhum cadastro comum é bloqueado por pendência fiscal.

`FiscalReadinessService` retorna `ready`, `errors`, `warnings`, categorias e códigos. `ready` significa apenas ausência dos impedimentos técnicos **cobertos por esta etapa**. Endereço/códigos oficiais e particularidades fiscais não verificadas aparecem como avisos, não como validação concluída. Empresa verifica cadastro, endereço, revisão e sequência; produto verifica perfil vigente, classificação/unidades, regime do estabelecimento padrão e revisão; pedido agrega estabelecimento/itens comerciais/destinatário/endereço e vínculos ausentes. Não percorre os componentes do kit para criar tributação. Validação de pedido é preliminar sobre cadastros atuais; não substitui resolução histórica/snapshot ou análise de CFOP para destinatário/finalidade.

## Endpoints

Prefixo `/api`, JWT e `X-Company-Id` validado contra associação ativa real do usuário:

| Recurso | Operações |
|---|---|
| `/fiscal` | GET visão geral |
| `/fiscal/permissions` | GET permissões efetivas do usuário |
| `/fiscal/establishments` | GET paginado, POST |
| `/fiscal/establishments/:id` | GET, PATCH |
| `/fiscal/establishments/:id/set-default` | POST |
| `/fiscal/establishments/:id/submit-review`, `/approve` | POST (approve recebe APPROVED ou REJECTED) |
| `/fiscal/document-settings` | GET paginado, POST |
| `/fiscal/document-settings/:id` | PATCH sem alteração arbitrária de número |
| `/fiscal/document-settings/:id/activate`, `/deactivate`, `/change-next-number` | POST |
| `/products/:productId/fiscal-profile` | GET histórico, PUT nova versão |
| `/products/:productId/fiscal-profile/submit-review`, `/approve` | POST sobre perfil vigente |
| `/fiscal/tax-rules` | GET paginado, POST |
| `/fiscal/tax-rules/:id` | GET, PATCH nova versão |
| `/fiscal/tax-rules/:id/activate`, `/deactivate`, `/submit-review`, `/approve` | POST |
| `/fiscal/readiness/company/:establishmentId`, `/product/:productId`, `/order/:orderId` | GET |
| `/fiscal/audit` | GET paginado, somente leitura |

Swagger: `/api/docs`, tag Fiscal, DTOs e operações documentados. Listagens usam `page`, `limit` (até 100), `productId` e `fiscalEstablishmentId` quando aplicáveis. Pipe global rejeita campos inesperados; IDs usam ParseUUIDPipe. Rate limit global existente continua ativo. Erros de banco fiscal são sanitizados; log contém evento/código, nunca conteúdo de documento ou credenciais. Não configure DB_LOGGING em produção para registrar parâmetros fiscais indiscriminadamente.

## Permissões efetivas

`fiscal.establishments.read/manage`, `fiscal.document_settings.read/manage/change_number`, `fiscal.products.read/manage`, `fiscal.tax_rules.read/manage`, `fiscal.review.submit/approve`, `fiscal.audit.read`.

| Papel | Padrão |
|---|---|
| ADMIN | Todas |
| MANAGER / BILLING | Leitura e gestão, envio à revisão; sem aprovação nem alteração manual de número |
| STOCKIST | Apenas leitura fiscal de produto |
| SUPPORT / VIEWER | Leitura |

Overrides em `fiscal_permission_overrides` prevalecem até sobre ADMIN: negação explícita bloqueia. Não há endpoint de autoatribuição de permissões. Provisionamento deve ser feito por administração autorizada do banco, com permissão válida do catálogo e associação existente. A interface consulta o endpoint de permissões, mas a proteção é sempre repetida pelo backend. Auditoria fiscal tem leitura restrita e imutabilidade no banco.

## Interface

Menu Fiscal: visão geral, estabelecimentos, configuração NF-e, regras, prontidão e auditoria. Estabelecimento tem seções identificação, inscrições, regime, endereço e situação; configuração NF-e e revisão ficam nas respectivas telas/ações. Edição do produto contém perfil fiscal próprio, alíquotas, reforma, vigência, histórico e revisão. Verde #237447, cartões brancos, bordas e badges; homologação destacada. Campos aceitam valores normalizados ou formatos visuais indicados (CNPJ/CEP); não há máscara rígida que apague letras do CNPJ. Erros nativos próximos ao campo e erros de API no ErrorDialog existente. Estados de carga, vazio e erro; confirmações para mudança relevante, produção e redução de número.

Listas auxiliares de seleção carregam até 100 produtos/estabelecimentos; catálogos maiores precisam de busca/paginação dedicada futuramente. Visão geral verifica produtos individualmente; otimizar para catálogos grandes antes de uso em grande escala. Não há teste visual automatizado de navegador nesta entrega.

## Fontes primárias consultadas e rastreabilidade

Consulta em **15/10/2026**; não se utilizaram blogs como fonte normativa. Alguns downloads do Portal Nacional retornaram loop de redirecionamento; as referências abaixo foram localizadas pelo conteúdo oficial indexado. A consulta complementar ao índice oficial da SVRS identificou revisões mais recentes (registradas abaixo). **Os documentos integrais e todas as combinações das tabelas da reforma não foram certificados nesta implementação.** Por isso não se embutiu tabela dinâmica nem se ativou motor de regras/emissão com alegação de vigência normativa completa.

| Fonte / URL | Documento / versão identificada | Vigência e uso nesta etapa |
|---|---|---|
| [Portal NF-e — MOC](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=J+I+v4eN00E%3D) | MOC 7.0, Anexo I, leiaute/regras; série B07, número B08 e campos tributários | Base estrutural, complementada por NT posteriores; não é fonte única suficiente para emissão em 2026. Série de aplicativo contribuinte CNPJ 000–889; número 1–999999999. |
| [Portal NF-e — NT MEI](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=kIiniiSkpKc%3D) | NT 2024.001, CRT=4; índice oficial identifica v1.10 em 17/06/2024 | Suporta identificação explícita de MEI; não automatiza enquadramento tributário por operação. |
| [Portal NF-e — reforma](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=bBbBVKSai3U%3D) | NT 2025.002-RTC, IBS/CBS/IS | Base da separação CST/cClassTrib e campos futuros. Última versão integral e cronograma não certificados nesta consulta; revisar antes de integrar emissão. |
| [Portal NF-e — IT](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=ljFBKt0aLks%3D) e [índice de tabelas](https://hom.nfe.fazenda.gov.br/portal/listaConteudo.aspx?AspxAutoDetectCookieSupport=1&tipoConteudo=%2FNJarYc9nus%3D) | IT 2025.002 v1.40 identificada; índice oficial também referencia tabelas do IT v1.60 | Tabelas são versionadas/dinâmicas; não importadas nem assumidas como vigentes. Implementação só de formato e armazenamento opcional. |
| [Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/cnpj-alfanumerico) e [manual DV](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj) | CNPJ alfanumérico; manual DV publicado em 05/11/2024 | Implantação a partir de julho/2026; coexistência com numéricos, 12 posições alfanuméricas + 2 DVs. Não é consulta de situação cadastral. |
| [IBGE](https://www.ibge.gov.br/explica/codigos-dos-municipios.php) | Tabela de códigos municipais (7 posições; prefixo da UF) | Verificação estrutural UF/prefixo. Cadastro completo e vigência municipal não foram importados. |
| [CONFAZ](https://www.confaz.fazenda.gov.br/legislacao/convenios/2018/CV142_18) | Convênio ICMS 142/18, texto consolidado e alterações indicadas na página | Referência para CEST/ST; aplicabilidade depende de produto/operação/UF. Nenhum CEST é escolhido por NCM. |
| [Receita — Classificação fiscal](https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/classificacao-fiscal-de-mercadorias) | NCM e consulta oficial de classificação | Formato NCM; existência e vigência devem ser revisadas na tabela oficial. |

A [SVRS, em seu índice oficial](https://dfe-portal.svrs.rs.gov.br/Nfe/Documentos), registra MOC 7.00; NT 2025.002 **v1.52**, publicada em 01/10/2026; IT 2025.002 **v1.70** e tabela CST/cClassTrib de 01/10/2026; IT 2023.002 **v2.00** para CFOP, de 25/08/2026. O [aviso oficial de 05/10/2026](https://dfe-portal.svrs.rs.gov.br/Nfce/Avisos) informa implantação da NT 2025.002 v1.52 em homologação em 26/10/2026 e produção em 16/11/2026. Identificar publicação não equivale a implementar todas as suas regras: não se congelam as versões antigas como tabela válida. Contribuinte exclusivo IBS/CBS e particularidades novas da NT 2026.007 exigem evolução do enquadramento antes de emissão.

Próxima evolução normativa: obter os documentos integrais atuais, registrar hashes/versões e intervalos de vigência, importar catálogos oficiais NCM/CEST/CFOP/municípios/IBS-CBS-IS, validar combinações condicionais com o contador. Nenhum endpoint deste módulo consulta serviço governamental/pago ou marketplace.

## Ativação e testes

Não executar build Nest simultaneamente com start:dev, nem iniciar segunda API em 3000.

Em desenvolvimento, após validar a conexão do `.env` e encerrar a API se necessário:

```bash
cd api
npm run migration:run
npm run start:dev
```

Não executar a migration em produção sem plano/autorização. Migração preserva colunas anteriores; rollback elimina **os novos cadastros fiscais**, portanto não deve ser usado para apagar dados de operação.

Testes isolados:

```bash
cd api
npm test -- --runInBand
FISCAL_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55444/postgres npm run test:fiscal:integration
```

A integração exige PostgreSQL descartável local com privilégio CREATE DATABASE/extensão. Cria banco aleatório, executa migrations, valida rollback/backfill, concorrência de padrão/número, revisão/versionamento, kits, regras genéricas conflitantes, prontidão, auditoria imutável, FK e autorização. Cenários HTTP usam substituto **somente da autenticação JWT**, mantendo CompanyGuard, permissões efetivas e pipe de DTO reais. Não faz chamadas externas, não usa a base operacional e remove apenas o banco aleatório criado pelo teste.

Verificações da entrega: 29 suítes/142 testes unitários; integração fiscal 56 cenários; TypeScript API emitido em `/tmp/omnistock-fiscal-build`, sem apagar dist em uso; frontend `npm run build`; lint escopado aos arquivos novos/alterados (consulte resultado final da execução).

## Limites e próximas etapas

Não implementados: emissão/transmissão, assinatura, certificados, XML final, DANFE, SEFAZ, cancelamento, CC-e, inutilização, motor fiscal definitivo, envio a marketplace, reserva real de numeração. Não há alíquotas fictícias, seleção automática de NCM, nem cálculo de IBS/CBS. Falta certificação integral das versões normativas mais recentes e importação de catálogos dinâmicos. IE por estado, destinatário/CFOP por operação, tabela municipal completa e tratamento fiscal de kits exigem evolução e validação contábil antes de qualquer emissão. A etapa prepara cadastros e contratos, não certifica conformidade fiscal.

### Resultado no desenvolvimento local

Migration aplicada ao PostgreSQL **de desenvolvimento** após os testes descartáveis. Consulta real de visão geral validada sem expor dados empresariais. Nenhuma configuração foi preenchida com códigos deduzidos, nenhum estabelecimento real foi criado para teste e não houve emissão, commit ou push. Regressão de kits/estoque também passou com os artefatos compilados isoladamente e banco descartável.

# Kits no OmniStock

Implementação do fluxo descrito em IMPLEMENTACAO_KITS.txt: composição, expansão recursiva, snapshots, reserva, baixa, cancelamento/estorno, disponibilidade calculada, sincronização e interface administrativa.

## Como usar

1. Cadastre o produto físico e mantenha o estoque nele.
2. Cadastre outro produto comercial para o kit, com SKU próprio. Salve o produto e abra seus detalhes ou edição.
3. Em **Composição do kit**, clique em **Cadastrar como kit**, selecione os componentes e suas quantidades.
4. Vincule o anúncio do kit ao produto comercial pela interface de vínculos com marketplaces. Revise e altere os anúncios existentes gradualmente, sem inferir composições pelo título.
5. O pedido continua mostrando o produto vendido e exibe **Consumo de estoque** com os componentes físicos.
6. Em pedidos prontos para faturamento, **Dar baixa no estoque** conclui todas as reservas. Cancelar libera reservas abertas ou estorna as baixas já realizadas, sem recalcular a composição atual.

O produto físico sem composição segue o fluxo normal. Um kit pode conter vários componentes e outros kits; componentes físicos compartilhados são consolidados. A quantidade por componente é um inteiro positivo nesta versão. As quantidades dos pedidos e saldos continuam usando precisão de três casas decimais.

## Garantias

- Autenticação, empresa ativa e permissões ADMIN/MANAGER/STOCKIST para alterar composições; ADMIN/MANAGER/BILLING para baixar pedidos.
- Validações de empresa, quantidade, duplicidade, ciclos e composição ativa única, com proteções adicionais no PostgreSQL.
- Kit comercial não recebe estoque físico. A disponibilidade usa o menor floor(disponível do componente / quantidade necessária), descontando reservas.
- Produtos com saldo ou histórico de movimentações não podem virar kits; cadastre um produto comercial separado.
- Snapshots são reutilizados no reprocessamento e congelam também a quantidade vendida. Alterações na quantidade de um item já congelado exigem revisão em vez de mudar silenciosamente o consumo.
- Reservas são atômicas para todo o pedido e serializadas por empresa para impedir excesso em concorrência. Falta de um componente mantém PENDING_STOCK sem reserva parcial.
- Cancelamentos, baixas e reprocessamentos são idempotentes e abrangem todos os componentes.
- Alterações do estoque físico e da composição geram eventos para sincronizar os kits dependentes. O worker publica a disponibilidade calculada e mantém os controles existentes de versão e repetição.
- Kit sem componentes ou com componente inativo fica indisponível. Para parar de vender, inative o produto; remover a classificação de kit é bloqueado para preservar sua identidade comercial e o histórico.

## Banco de dados

Execute `npm run migration:run` na pasta api, com a configuração do banco local.

As migrations de snapshot e endurecimento acrescentam chaves por empresa, unicidade, marcadores do snapshot, função SQL de disponibilidade e triggers. Duplicatas legadas de snapshots são arquivadas em `order_item_components_legacy_duplicates`; a linha mais antiga permanece no conjunto ativo. Composições ativas duplicadas, ciclos, referências entre empresas ou saldo físico de kits precisam ser corrigidos antes da migration: ela falha sem tentar inferir regras de negócio.

Reservas antigas são usadas para recuperar o consumo real quando o pedido ainda não tem snapshot marcado. A composição futura não substitui esse histórico.

## Validação

- Backend: build e 23 suites Jest, 81 testes aprovados.
- Frontend: build TypeScript/Vite e ESLint aprovados.
- Código alterado do backend: ESLint aprovado.
- Integração com PostgreSQL descartável: produto normal, um/dois kits, vários componentes, compartilhamento, insuficiência atômica, cancelamento, estorno, composição futura, floor, ciclos, isolamento entre empresas, concorrência e reprocessamento.
- Worker real de marketplace testado com banco real, fila e conector simulados: 25 unidades / 6 = envio de 4 kits. Nenhuma chamada externa ao marketplace durante os testes.
- Migration de endurecimento validada em subida, descida e nova subida.

Para repetir a integração, a URL deve apontar a um PostgreSQL de testes onde o usuário possa criar bancos descartáveis:

```sh
KITS_TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:55440/postgres npm run test:kits:integration
```

O teste cria um banco isolado por execução e o remove ao terminar. Não use a URL do banco operacional.

A aplicação não possuía emissão fiscal integrada; a baixa explícita do pedido está disponível, sem simular faturamento ou emissão de nota.

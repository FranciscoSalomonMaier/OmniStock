# Refatoração visual da vinculação de anúncios

## Escopo

Somente frontend: as rotas, serviços, payloads, permissões e endpoints permanecem existentes. Nenhuma alteração no banco, backend ou integração OAuth.

As quatro imagens anexadas orientaram hierarquia, listas, badges e seleção de produtos. `docs/layout-references/` não estava presente no checkout.

## Interface

- Cabeçalho e abas compartilhados; total apenas da consulta ativa, sem totais fictícios para outras abas.
- Vínculos em tabela com cinco colunas, títulos limitados a duas linhas e título completo acessível por tooltip e detalhes.
- Detalhes mostram situação, origem, SKU externo, variação, conta e dados de validação; ações secundárias em menu.
- Não vinculados em lista compacta; sugestões em cartões de comparação entre anúncio e produto.
- Drawer comum com Escape, controle de foco, restauração do foco e bloqueio de fechamento enquanto processa.
- Pesquisa de produtos no servidor, com debounce e paginação; seleção mantida ao mudar a pesquisa.
- Revisão antes de criar ou aceitar vínculo, mensagens de sucesso e erro e proteção contra clique duplicado.
- Lote disponível para ADMIN/MANAGER, usando o endpoint existente, seleção dos elegíveis da página, revisão e resultados individuais. Cada item continua passando pelas validações do backend.
- Filtros de marketplace/conta consultam as conexões reais; filtros de status preservados. A rota com connectionId mantém a conta fixa.
- Link de criação de produto acessa /products/new para ADMIN/MANAGER. Não há criação automática nem vínculo automático ao retornar.
- CSS limitado à central de vinculação; cores neutras solicitadas e verde existente #237447.

## Componentes compartilhados

`MarketplaceLinksLayout`, `LinkBadge`, `ProductInfo`, `LinkEmpty`, `LinkPagination`, `LinkDrawer` e `MarketplaceAccountFilters`. As duas rotas de anúncios usam a mesma pesquisa de produtos no drawer.

## Limitações dos contratos atuais

- API de sugestões filtra withSuggestion após a paginação e retorna total de anúncios. A interface mostra contagem de sugestões da página, preservando a paginação original. Corrigir totais e páginas vazias exige mudança no backend, não realizada.
- Vínculos e sugestões não retornam imagens dos produtos internos; exibem ícone neutro. A pesquisa de produtos usa imagens quando recebidas. Não são feitos GETs individuais por produto para preencher a tabela.
- Não há endpoint de rejeitar/ignorar sugestão: ação não criada.
- Não há filtro de status da validação independente do status do vínculo no DTO existente; não foi simulada filtragem local.
- O mecanismo de sugestões atualmente produz correspondências de SKU. O rótulo segue matchedBy; nenhuma pontuação de confiança foi inventada.
- Não há comando de sincronizar importações nessa central; não foi criado um botão apenas por constar nas referências.

## Validação

- Build frontend (TypeScript e Vite): aprovado.
- ESLint dos componentes e páginas alterados: aprovado.
- Sem suíte existente de testes de frontend ou ferramenta de automação de navegador instalada/disponível nesta sessão. Interações reais e renderização em navegador não foram executadas; nenhuma operação real de vincular/desvincular foi disparada para testar.

## Roteiro de conferência no navegador

1. Abrir as três abas e conferir seleção ativa, rotas e permissões.
2. Pesquisar SKU/título/ID, mudar status, marketplace e conta; navegar entre páginas.
3. Conferir estados de carregamento, consulta sem resultados e erro da API.
4. Abrir Vincular, pesquisar produtos e paginar; selecionar produto; fechar com X/Escape e conferir foco de retorno.
5. Revisar vínculo, voltar à seleção e confirmar um anúncio de teste; conferir atualização da lista e sucesso/erro.
6. Alterar produto em sugestão; selecionar lote elegível, revisar, confirmar e conferir cada resultado.
7. Validar e desvincular um vínculo de teste, preservando confirmação e motivo.
8. Conferir desktop, notebook e tablet; rolagem da tabela e drawer em tela estreita.

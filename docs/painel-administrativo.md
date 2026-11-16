# Painel administrativo integrado

O painel em `/admin` usa os registros persistidos no MongoDB. Não gera vendas,
pagamentos, clientes ou crescimento fictícios. Só sessões com papel `admin`,
validado no banco pelo middleware, acessam as rotas administrativas. A conta
administradora configurada continua sendo `delimafelipe291@gmail.com`.

## Catálogo compartilhado com a vitrine

`Product` e `Category` agora são a fonte do catálogo da loja e do painel.
Cada variação tem um `lojaId` numérico estável, atribuído pelo contador atômico do
catálogo. As URLs de produto, itens da sacola e checkout usam esse identificador.
Variações diferentes aparecem como itens distintos, com seus atributos no nome.

Em desenvolvimento/testes, a inicialização importa os 12 produtos e três
categorias que antes ficavam apenas em `shared/sampleProducts.json`. O usuário
autorizou **100 unidades disponíveis por produto para demonstração**. A importação
usa IDs determinísticos compatíveis com os pedidos anteriores; é idempotente e
não sobrescreve preços, estoque ou status já editados. Pedidos históricos são
preservados e não descontam retroativamente desse estoque inicial.

Produção não importa esses produtos nem cria estoque de demonstração. O checkout
continua restrito ao sandbox; esta integração não habilita cobranças reais.

Alterações de nome, descrição, imagens, preço, preço anterior, nível do cupom,
estoque, SKU, atributos, status do produto e categoria aparecem na vitrine.
Produtos, categorias e variações inativos não são oferecidos para novas compras.
Imagens locais em `/products/` e URLs HTTP/HTTPS são aceitas; preços ficam em
centavos no servidor. Fotos retornadas pelo backend prevalecem sobre referências
locais. Edições concorrentes são recusadas quando `updatedAt` mudou.

A vitrine atualiza o catálogo a cada 30 segundos, ao recuperar foco e após
notificação de edição em outra aba. Não usa produtos de demonstração locais como
fallback silencioso quando a API falha. A sacola mantém somente IDs e recebe
preços e disponibilidade atuais do servidor.

## Pedidos, estoque e entrega

- Pedidos da loja aparecem na administração com cliente, itens, quantidades,
  desconto, frete, endereço, pagamento, rastreio e histórico.
- O checkout reserva estoque na mesma transação que grava o pedido. Categoria,
  produto, variação, preço e cupom são novamente conferidos no banco, impedindo
  confirmar valores antigos após uma edição administrativa durante o frete.
- Pagamento aprovado consome a reserva. Pedidos gratuitos consomem na criação.
- Cancelamento antes do envio libera a reserva ou devolve o estoque consumido.
- Reembolso de produto já enviado não o recoloca automaticamente à venda. O
  administrador confirma o recebimento físico da devolução para reintegrar as
  unidades. A operação é transacional e não pode ser aplicada duas vezes.
- Reservas vencidas dos novos pedidos controlados são liberadas automaticamente.
  Aprovação tardia de pagamento é encaminhada para reembolso, sem vender unidades
  cuja reserva já foi liberada.
- Pedidos antigos sem `estoqueControlado` preservam o comportamento histórico;
  não movimentam indevidamente o novo estoque.

A administração avança pedidos somente na sequência
`pago → em_preparacao → enviado → entregue`. Não existe botão para marcar
pagamento como aprovado. O código de rastreio é informativo; não há contratação
ou consulta automática a transportadoras.

Cancelamento e consulta financeira usam os mesmos serviços do cliente, incluindo
validação no Mercado Pago, idempotência e confirmação do reembolso. Em ambiente
local sem webhook público, use “Consultar pagamento no Mercado Pago” no pedido.
Em ambiente com webhook válido, o registro é atualizado pela notificação e
aparece no próximo refresh do painel/conta do cliente.

## Indicadores e relatórios

Dashboard, pedidos, pagamentos e clientes aceitam os filtros
`ambiente=todos|teste|producao`, `de=YYYY-MM-DD` e `ate=YYYY-MM-DD`. O período
inclui dias completos no horário de São Paulo e aceita até 366 dias. Listas de
pedidos, pagamentos e clientes são paginadas (`pagina`, `limite` até 100).
Pedidos e clientes também aceitam busca literal, sem interpretar regex do usuário.

Os indicadores têm as seguintes definições:

| Indicador | Fonte e cálculo |
| --- | --- |
| Recebimentos brutos | Soma de `Payment.capturedCentavos`, por data de aprovação. Não inclui pedidos aguardando pagamento. |
| Reembolsos | Soma de `refundSucceededCentavos` confirmados, por data de confirmação do reembolso quando há filtro de período. |
| Receita após reembolsos | Recebimentos menos reembolsos. Pode ser negativa se o período tem devoluções de recebimentos anteriores. |
| Taxas | Valores efetivamente informados em `fee_details` pelo provedor. Fica indisponível se faltam dados, sem estimar taxa zero. |
| Ticket médio | Soma dos valores dos pedidos com pagamento confirmado dividida pela quantidade desses pedidos, entre os pedidos criados no período. |
| Conversão de pedidos | Percentual dos pedidos criados no período que receberam confirmação de pagamento. Não mede conversão de visitas. |
| Evolução | Recebimentos capturados agrupados por dia de aprovação, no fuso de São Paulo; exibe até 366 datas recentes. |
| Produtos mais vendidos | Quantidade e total líquido dos itens em pedidos pagos/em preparação/enviados/entregues. |
| Clientes recorrentes | Clientes com mais de um pedido confirmado no período selecionado. |
| Estoque crítico | Variações ativas com disponível menor ou igual ao limite configurado na loja. |

Os registros de teste são identificados. O filtro “Todos” inclui testes de
sandbox e não deve ser confundido com faturamento de produção. Não são calculados
lucro, custos de mercadoria, tributos, notas fiscais ou liquidação bancária.
Dados financeiros históricos sem taxas ou datas de reembolso registradas não
são inventados; a consulta ao provedor pode ser necessária para conciliação.

O botão “Exportar relatório CSV” fica no dashboard e exporta os indicadores,
evolução e produtos mais vendidos, respeitando os filtros aplicados. A seção
separada de relatórios foi removida; `/admin/relatorios` redireciona para `/admin`. A exportação trata caracteres que poderiam ser interpretados como
fórmulas de planilha.

## Clientes, configurações e histórico

A lista de clientes apresenta cadastro, e-mail verificado, situação, quantidade de
pedidos e compras confirmadas. Há navegação para os pedidos do cliente e ação de
ativar/desativar a conta. Desativação revoga sessões. Essa tela não altera papéis,
não desativa administradores e nunca retorna hash de senha, tokens ou CPF.

As configurações permitem editar nome público, contato, mensagem no topo da
vitrine e limite de alerta de estoque. O painel apresenta as faixas de frete e se
credenciais/webhook estão configurados, sem revelar seus valores secretos.

Criações/edições de catálogo, alterações de pedidos, clientes e configurações são
registradas em `AdminEvent`. Pedidos novos também registram recebimento na loja,
confirmações de pagamento e cancelamento. Alterações críticas e seus eventos são
salvos na mesma transação. Eventos anteriores à integração não são reconstruídos
artificialmente.

## Rotas administrativas

- `GET /api/v1/admin/catalog`
- `POST /api/v1/admin/products` e `/categories`
- `PUT /api/v1/admin/products/:id` e `/categories/:id`
- `GET /api/v1/admin/overview` e `/reports`
- `GET /api/v1/admin/orders` e `/orders/:id`
- `PATCH /api/v1/admin/orders/:id/status`
- `POST /api/v1/admin/orders/:id/sync`, `/cancel` e `/stock-return`
- `GET /api/v1/admin/payments` e `/customers`
- `PATCH /api/v1/admin/customers/:id`
- `GET` e `PUT /api/v1/admin/settings`

Escritas exigem a origem autorizada e sessão administrativa. Listas e detalhes
não ficam em cache e as requisições usam os limites e timeouts da aplicação.

## Validação da entrega

A suíte completa passou com **308 testes em 34 arquivos**. Os testes cobrem
publicação de catálogo, autorização, preço alterado durante a cotação, reserva
concorrente, avanço da entrega refletido no cliente, recebimentos e reembolsos,
retorno físico de produto, expiração e pagamento tardio, configuração da vitrine,
clientes desativados e importação sem reset de estoque. Todos usam o banco
isolado de testes; nenhum pagamento de produção ou e-mail real foi executado.
O build e o lint dos arquivos de frontend alterados também passaram.

## Tratamento de erros e proteção da integração

A revisão de falhas do painel acrescentou:

- Uma barreira de erro de renderização dentro do layout administrativo. Uma seção
  que falha não desmonta o menu inteiro nem depende do fallback global da loja.
- Cancelamento de consultas ao sair da tela e mensagens de sessão expirada,
  indisponibilidade, resposta incompleta e resultado de gravação não confirmado.
  Gravações não são repetidas automaticamente em caso de perda de resposta.
- Trava síncrona contra envio duplicado no catálogo. Após salvamento confirmado,
  falha ao recarregar a lista não é apresentada como falha de cadastro. Há ação
  explícita para atualizar o catálogo e reabrir uma edição com a versão atual.
- Configurações com controle otimista de versão (`versao`). Um formulário antigo
  recebe 409 e não sobrescreve uma alteração mais recente. É possível carregar a
  versão atual e conferir os campos antes de salvar novamente.
- Validação de tipos de rastreio e rejeição de campos de permissão na operação de
  clientes, antes de qualquer alteração no banco.
- Limite administrativo adicional de 60 requisições/minuto/IP e quatro operações
  administrativas simultâneas por processo. A capacidade é liberada também após
  falhas. Autenticação e limite são aplicados uma vez por requisição ao atravessar
  os roteadores administrativos.
- Agregações e principais consultas de leitura administrativas com `maxTimeMS`
  de cinco segundos. Consulta vencida retorna 503, sem expor detalhes do banco.
- Transações preservadas para alterações críticas e seu histórico. Erros de
  auditoria provocam rollback; falhas de provedor preservam a intenção de
  cancelamento para conciliação, sem confirmar reembolso ou estoque fictício.

Foram executados **320 testes em 36 arquivos**, incluindo injeção de falhas de
auditoria, timeout de consulta, indisponibilidade de provedor, conflito de
configuração, envio duplicado e continuidade das leituras da vitrine/conta do
cliente após uma falha administrativa isolada. Build e lint dos arquivos de
frontend alterados passaram.

Isso não constitui isolamento de infraestrutura: painel e loja continuam usando
a mesma API, conexão e banco. Uma queda geral desses serviços pode afetar ambos.
Os limites reduzem sobrecarga, mas alta disponibilidade e isolamento completo
exigem infraestrutura apropriada e testes de carga. Os limitadores em memória
são por processo, não compartilhados entre várias instâncias.

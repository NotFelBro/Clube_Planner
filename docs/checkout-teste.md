# Compra dos produtos exemplares

## Estrutura analisada

O catálogo visual estava em `frontend/src/data/products.js`, a sacola existia somente em memória e checkout, detalhes do pedido e feedbacks eram demonstrativos. Os modelos Order, Payment e Cart já existiam; o serviço de checkout anterior trabalha com estoque e cupons, mas bloqueia qualquer banco que não seja o de testes automatizados porque ainda não há frete real.

O fluxo atual usa os modelos Order, Payment e Cart com snapshots de endereço,
itens e frete. O catálogo público e o painel consultam os mesmos produtos e
categorias em MongoDB. `shared/sampleProducts.json` é apenas a referência inicial
de importação em desenvolvimento/testes. Foram autorizadas 100 unidades de
estoque de demonstração por produto importado; novas compras reservam essas
unidades transacionalmente e os movimentos aparecem no painel.

O frete é calculado por CEP em três níveis (R$ 3, R$ 6 e R$ 9), com cupons por
nível em produtos participantes; veja `frete-por-cep.md`. Cancelamento, pagamento,
reembolso e expiração atualizam os mesmos registros e o estoque conforme o
estágio da entrega. O checkout permanece de demonstração, bloqueado em produção,
sem cobrança ou entrega real. Veja [a integração administrativa](painel-administrativo.md).

## Produtos gratuitos e frete

`CHECKOUT_TEST_MODE=gratuito` mantém os exemplares em R$ 0,00, mas o frete é calculado pelo CEP e compõe um total positivo. O checkout mostra subtotal, faixa de frete e total antes de confirmar. O pedido fica aguardando pagamento, inclusive quando apenas o frete é cobrado.

O pagamento continua no sandbox do Mercado Pago. Configure as credenciais abaixo para concluí-lo. Pedidos históricos totalmente gratuitos continuam disponíveis, mas novas compras com frete não são aprovadas automaticamente.

O pedido mantém snapshots do endereço, dos itens e do frete. Repetir a mesma chave e conteúdo retorna o mesmo pedido; alterar os valores com a mesma chave causa conflito. A sacola fica no navegador por usuário e o servidor valida os preços ao confirmar.

## Preparar Mercado Pago (ainda exige configuração externa)

Valide a configuração atual com `npm run checkout:check`. A verificação consulta a conta do vendedor sem criar pagamentos nem imprimir credenciais.

1. Crie aplicação Checkout Pro via Preferences API e contas de teste brasileiras de vendedor e comprador em Mercado Pago Developers.
2. No `.env` privado do backend configure `CHECKOUT_TEST_MODE=mercado_pago`, `MP_ACCESS_TOKEN` da conta de vendedor de teste, `MP_WEBHOOK_SECRET` e `MP_WEBHOOK_URL=https://SEU_BACKEND/api/v1/shop/mercado-pago/webhook`. Não coloque tokens no frontend ou no Git.
3. Configure `FRONTEND_URL` com o endereço público HTTPS do frontend e autorize esse mesmo endereço para as requisições. A URL pública precisa encaminhar `/api` ao backend. Reinicie o backend e recarregue a loja.
4. No painel do Mercado Pago configure eventos Pagamentos para o webhook. A chave de assinatura deve corresponder à aplicação das credenciais.
5. Neste modo os preços vêm do catálogo cadastrado no painel, mais o frete calculado. Os exemplares iniciais têm valores de demonstração entre R$ 0,50 e R$ 1,00, incluindo descontos. Isso permite um pagamento de teste com valor positivo. Não representa cobrança real autorizada: o servidor consulta `/users/me` e recusa vendedores sem a tag `test_user`.
6. Crie um pedido e clique em Pagar no Mercado Pago (teste). Use a conta de comprador e os cartões de teste da documentação oficial, nunca cartões reais.
7. Ao retornar, os detalhes consultam o servidor e sincronizam o pagamento; também há atualização manual e webhook assinado. Os parâmetros da URL de retorno nunca aprovam pedidos.
8. Teste pagamento aprovado, pendente e recusado; notificação repetida, valor incorreto e acesso por outra conta devem ser rejeitados ou tratados sem duplicar o pedido.

O servidor verifica assinatura HMAC, consulta o pagamento na API e compara ambiente, vendedor, moeda, valor e referência do pedido antes de confirmar. Pagamentos e reembolsos de teste são registrados em Payment. As notificações antigas do mesmo pagamento não sobrescrevem dados mais recentes. A preferência vence em até 14 minutos; depois disso deve-se iniciar um novo pedido. As etapas de preparação, envio e entrega são atualizadas manualmente pelo administrador, apenas em pedidos pagos. Não há contratação ou consulta automática de transportadoras. Não há pagamento produtivo nesta implementação.

## Fontes

- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases


## Preview compilado para teste HTTPS

1. Execute `npm --prefix frontend run build`.
2. Inicie a API com `npm start` (porta 3002 no `.env` atual).
3. Execute `npm run checkout:preview`. A porta 3003 serve apenas o build e encaminha `/api` para a API local; arquivos como `.env` não são servidos.
4. A publicação temporária do preview por túnel exige autorização para expor a loja e suas rotas de API. Nenhum túnel foi aberto automaticamente.
5. Depois de obter a URL HTTPS autorizada, configure `FRONTEND_URL` com sua origem, sem barra final, e `MP_WEBHOOK_URL` com essa origem seguida de `/api/v1/shop/mercado-pago/webhook`.
6. No painel Mercado Pago, configure o evento **Pagamentos** para essa URL no ambiente de teste. Salve a assinatura fornecida pelo painel em `MP_WEBHOOK_SECRET`; não invente uma chave local.
7. Reinicie a API após salvar o `.env` e execute `npm run checkout:check`.
8. Acesse a loja pela URL HTTPS, autentique-se, escolha o produto e o endereço e crie o pedido. Nos detalhes, clique em **Pagar no Mercado Pago (teste)**.
9. Use um comprador de teste diferente do vendedor. Ao retornar, consulte o status confirmado pela API.

URLs de túneis temporários mudam quando o túnel é reiniciado. Atualize a configuração e o painel quando isso ocorrer.

## Cancelamento pelo cliente

Nos detalhes do pedido há uma confirmação para cancelar o pedido inteiro antes de
`entregue`. `POST /api/v1/shop/orders/:id/cancel` exige sessão, origem autorizada
e propriedade do pedido. Pedidos pendentes podem ser cancelados sem pagamento;
pedidos pagos solicitam reembolso integral (produtos e frete) no Mercado Pago.

A intenção fica persistida em `cancelamentoSolicitadoEm` antes de contatar o
provedor e impede iniciar outro checkout. A preferência existente é expirada,
pagamentos pendentes são cancelados e aprovados são reembolsados via Payments API,
com chave de idempotência estável por pagamento. O status de reembolso somente é
confirmado após nova consulta ao provedor. Falhas conservam a intenção para
repetição pelo botão ou sincronização; nenhuma falha é apresentada como devolução
concluída. Webhooks de aprovação tardia também solicitam reembolso. O pedido
cancelado permanece no histórico e não volta a pago.

O fluxo permanece restrito ao sandbox existente; não habilita cobranças ou
reembolsos de produção. Testes automatizados simulam respostas do provedor.

Referências: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-pro-preferences/update-preference/put
 e https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-cancellation/put
 e https://www.mercadopago.com.mx/developers/en/reference/online-payments/checkout-api-payments/create-refund/post

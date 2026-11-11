# Compra dos produtos exemplares

## Estrutura analisada

O catálogo visual estava em `frontend/src/data/products.js`, a sacola existia somente em memória e checkout, detalhes do pedido e feedbacks eram demonstrativos. Os modelos Order, Payment e Cart já existiam; o serviço de checkout anterior trabalha com estoque e cupons, mas bloqueia qualquer banco que não seja o de testes automatizados porque ainda não há frete real.

O novo fluxo usa o mesmo modelo Order e snapshots de endereço/itens. O catálogo de exemplares foi centralizado em `shared/sampleProducts.json`. O modo é decidido pelo servidor. O fluxo de demonstração é separado do serviço de estoque real: os IDs determinísticos dos exemplares não representam produtos físicos e não alteram inventário. O frete é calculado por CEP em três níveis (R$ 3, R$ 6 e R$ 9); veja `frete-por-cep.md`. Não há entrega real nem cupom neste fluxo. O checkout de demonstração é bloqueado em produção.

## Produtos gratuitos e frete

`CHECKOUT_TEST_MODE=gratuito` mantém os exemplares em R$ 0,00, mas o frete é calculado pelo CEP e compõe um total positivo. O checkout mostra subtotal, faixa de frete e total antes de confirmar. O pedido fica aguardando pagamento, inclusive quando apenas o frete é cobrado.

O pagamento continua no sandbox do Mercado Pago. Configure as credenciais abaixo para concluí-lo. Pedidos históricos totalmente gratuitos continuam disponíveis, mas novas compras com frete não são aprovadas automaticamente.

O pedido mantém snapshots do endereço, dos itens e do frete. Repetir a mesma chave e conteúdo retorna o mesmo pedido; alterar os valores com a mesma chave causa conflito. A sacola fica no navegador por usuário e o servidor valida os preços ao confirmar.

## Preparar Mercado Pago (ainda exige configuração externa)

Esta etapa não está validada no provedor enquanto não existirem credenciais/contas de teste.

1. Crie aplicação Checkout Pro via Preferences API e contas de teste brasileiras de vendedor e comprador em Mercado Pago Developers.
2. No `.env` privado do backend configure `CHECKOUT_TEST_MODE=mercado_pago`, `MP_ACCESS_TOKEN` da conta de vendedor de teste, `MP_WEBHOOK_SECRET` e `MP_WEBHOOK_URL=https://SEU_BACKEND/api/v1/shop/mercado-pago/webhook`. Não coloque tokens no frontend ou no Git.
3. Configure `FRONTEND_URL` com o endereço público HTTPS do frontend e autorize esse mesmo endereço para as requisições. A URL pública precisa encaminhar `/api` ao backend. Reinicie o backend e recarregue a loja.
4. No painel do Mercado Pago configure eventos Pagamentos para o webhook. A chave de assinatura deve corresponder à aplicação das credenciais.
5. Neste modo cada exemplar custa **R$ 1,00 fictício**, mais o frete calculado. Isso permite um pagamento de teste com valor positivo. Não representa cobrança real autorizada: o servidor consulta `/users/me` e recusa vendedores sem a tag `test_user`.
6. Crie um pedido e clique em Pagar no Mercado Pago (teste). Use a conta de comprador e os cartões de teste da documentação oficial, nunca cartões reais.
7. Ao retornar, os detalhes consultam o servidor e sincronizam o pagamento; também há atualização manual e webhook assinado. Os parâmetros da URL de retorno nunca aprovam pedidos.
8. Teste pagamento aprovado, pendente e recusado; notificação repetida, valor incorreto e acesso por outra conta devem ser rejeitados ou tratados sem duplicar o pedido.

O servidor verifica assinatura HMAC, consulta o pagamento na API e compara ambiente, vendedor, moeda, valor e referência do pedido antes de confirmar. Pagamentos e reembolsos de teste são registrados em Payment. As notificações antigas do mesmo pagamento não sobrescrevem dados mais recentes. A preferência vence em até 14 minutos; depois disso deve-se iniciar um novo pedido. Etapas de preparação/transporte/entrega não avançam artificialmente: ainda dependem da futura operação logística. Não há pagamento produtivo nesta implementação.

## Fontes

- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/create-payment-preference
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts
- https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases

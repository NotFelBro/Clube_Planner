# Frete por CEP

## Origem e faixas

Origem: SENAI Barueri — Escola José Ephim Mindlin, Alameda Wagih Salles Nemer, 124, Centro, Barueri/SP, CEP 06401-134.

A configuração compartilhada fica em `shared/shippingRules.json`:

| Nível | Distância | Frete |
| --- | --- | --- |
| 1 | Até 10 km, inclusive | R$ 3,00 |
| 2 | Acima de 10 km até 30 km, inclusive | R$ 6,00 |
| 3 | Acima de 30 km | R$ 9,00 |

A distância é aproximada, em linha reta entre as coordenadas dos CEPs, calculada pela fórmula de Haversine. Não é quilometragem de trajeto rodoviário. As coordenadas da origem (-23.51056, -46.87611) foram obtidas pela BrasilAPI para o CEP 06401134, em 11/11/2026; representam a localização aproximada do CEP, não uma medição da porta do prédio.

## Consulta

`POST /api/v1/shop/shipping-quote`, autenticado e com origem autorizada, recebe `{ "cep": "01001000" }` e devolve `data.frete` com CEP, nível, valor em centavos, distância e origem.

O servidor consulta a BrasilAPI CEP V2. Consultas do mesmo CEP são compartilhadas, com cache de seis horas e limite de mil entradas. O CEP da própria origem resulta em nível 1 sem consulta externa. CEP inválido, inexistente ou sem coordenadas válidas e indisponibilidade do provedor não geram um valor fictício: a interface mostra o erro, oferece nova tentativa e impede a confirmação sem cotação.

O checkout calcula o frete ao digitar oito dígitos no novo endereço ou selecionar um endereço salvo. Mostra subtotal, frete e total; respostas antigas são ignoradas ao trocar o CEP. Cadastrar o endereço continua obrigatório antes de criar o pedido.

## Pedido e pagamento

O cliente envia `freteEsperadoCentavos` e `totalEsperadoCentavos`. O servidor lê o endereço pertencente ao usuário, recalcula o frete pelo CEP salvo e confere os valores. Não aceita o preço do frete fornecido pelo cliente como fonte de verdade. Mudança de CEP durante a confirmação causa conflito, sem gravar pedido inconsistente.

O pedido armazena o frete em centavos e um snapshot de origem, CEP, nível e distância. Alterar um endereço depois não muda o pedido já criado. A chave de idempotência inclui os valores esperados e evita duplicação em tentativas idênticas.

O frete compõe o valor pago no Mercado Pago. Em pedidos com produtos de valor positivo, é enviado como `shipments.cost`. Quando os exemplares custam zero, o frete é enviado como um único item de entrega de valor positivo, sem duplicar o custo. Novos pedidos com frete ficam aguardando pagamento; não são aprovados automaticamente.

O fluxo existente continua sendo de demonstração, sem entrega real e com pagamento somente no sandbox. O valor do frete é positivo mesmo quando `CHECKOUT_TEST_MODE=gratuito` deixa os produtos em R$ 0,00. Credenciais de vendedor e comprador de teste são necessárias para pagar; esta alteração não ativa pagamentos de produção nem contrata transporte.

## Fontes

- SENAI Barueri: https://www.sp.senai.br/unidade/barueri/
- BrasilAPI CEP V2: https://brasilapi.com.br/docs#tag/CEP-V2
- Implementação da geolocalização: https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/api/cep/v2/%5Bcep%5D.js
- Frete no Mercado Pago: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/shipping-cost

## Cupons de frete em produtos participantes

O catálogo compartilhado usa `shippingCouponLevel` apenas nos produtos participantes:
Planner Semanal (FRETE1), Kit de Canetas Pastel (FRETE2) e Agenda Permanente (FRETE3).
Cada código zera o frete do pedido somente se o CEP resultar no mesmo nível do cupom
(1: até 10 km; 2: acima de 10 até 30 km; 3: acima de 30 km).
Basta uma unidade participante na compra; outros produtos podem acompanhar.
Não há acúmulo: o checkout permite um código por pedido, selecionado pelo cliente.

A cotação recebe `itens` e `cupomFrete`. O servidor confere o catálogo, os itens e o nível;
o checkout repete essa validação sobre o CEP do endereço salvo. O snapshot do pedido
registra código, valor original e desconto do frete, separadamente dos descontos dos produtos.
O frete grátis preserva a distância e o nível calculados. Sem cupom, aplicam-se as tarifas normais.

# Validação dos cartões — 13/11/2026

| Cartão | Situação no código local | Pendente para encerramento formal |
| --- | --- | --- |
| RN-04 — Cadastro único | CPF/e-mail normalizados; CPF validado; índices únicos parciais para usuários ativos; conflito 409; testes de concorrência, recadastro e reativação. CPF editável; alteração de e-mail exige senha atual e confirmação do novo endereço. | Registrar commit e validar os critérios de aceite no ambiente de homologação. |
| RF-10 — Gestão de pedidos | Snapshots de itens/endereço; chave idempotente; valores em centavos no servidor; status de reserva separado; reserva de até 15 minutos; transações para pedido/estoque; expiração libera estoque sem apagar pedidos; cancelamentos e reembolsos idempotentes. | Registrar commit e homologar o fluxo integrado com o provedor de pagamentos no ambiente publicado. Pagamentos locais são sandbox. |
| RNF-05 — Disponibilidade | API com health check, encerramento controlado e tratamento de indisponibilidade; isso não comprova a meta de 99,9%. | Definir janela e SLI/SLO de disponibilidade; implantar monitoramento externo e alertas; infraestrutura redundante de API/MongoDB; política de backups e teste documentado de restauração com RPO/RTO; medir a meta no deploy. |

Evidências: `tests/userModel.test.mjs`, `tests/userIndexSecurity.test.mjs`,
`tests/emailChange.test.mjs`, `tests/authHttp.test.mjs`, `tests/orderModel.test.mjs`,
`tests/checkoutCreation.test.mjs`,
`tests/storeCancellation.test.mjs`, `tests/adminIntegration.test.mjs`.

Os cartões externos não foram movidos. Há mudanças anteriores no diretório;
nenhum commit foi criado nesta revisão. A execução local e seus testes não
substituem a validação operacional de disponibilidade nem a homologação externa.

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

## RF-10 e RNF-02 — complemento de 16/11/2026

- RF-10: snapshots protegidos no modelo, prazo de reserva ajustado para 15 minutos
  e índice de idempotência aguardado na inicialização. Testes de criação, concorrência,
  rollback e preservação dos snapshots disponíveis. Pagamentos reais ficam para depois.
- RNF-02: proxy Caddy com TLS 1.2/1.3, cabeçalhos para frontend/API, API restrita a
  loopback em produção e verificador de deploy preparados. Homologação local não
  substitui aplicação e validação no domínio público.

Procedimento e limites: [validação RNF-02/RF-10](rnf02-rf10-validacao.md).

## Implantação escolhida — Vercel e Atlas

O usuário escolheu manter frontend e backend na Vercel, com MongoDB Atlas existente.
A entrada da API reutiliza conexões, aguarda índices e não depende dos timers do
servidor local. A rota de manutenção usa segredo; o Hobby possui agendamento diário
e limpeza adicional durante o uso da loja. Isso não comprova liberação a cada minuto
sem tráfego. Pagamentos reais continuam desativados.

A configuração com Caddy permanece como alternativa para servidor próprio; na
Vercel a terminação TLS é da plataforma. A publicação completa ainda requer mudar
o Root Directory, cadastrar variáveis privadas/rede Atlas e validar a API pública.
Veja [implantação Vercel + Atlas](deploy-vercel-atlas.md).

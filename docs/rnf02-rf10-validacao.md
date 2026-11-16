# RNF-02 e RF-10 — implementação e validação

## RF-10 — Gestão de pedidos

Os dois serviços de checkout criam o pedido e reservam as variantes na mesma
transação MongoDB. O banco deve executar como replica set. A inicialização da API
aguarda os índices de pedidos, incluindo a unicidade de usuário/chave de checkout.
O fingerprint recusa reutilizar uma chave para outra intenção de compra.

Itens, endereço, valores financeiros e snapshots de frete/cupom ficam protegidos
contra alterações após a criação. A proteção cobre gravação de documentos, inclusive
sem validação, updates por campos e operadores, pipelines e substituição de documentos.
Gravações em lote de pedidos por `bulkWrite` são recusadas; usar os serviços
transacionais existentes para atualizar status/estoque. A proteção pertence ao modelo
Mongoose; acesso administrativo direto à coleção exige controle próprio de permissões.

As duas criações usam a mesma referência de tempo para `createdAt` e
`reserva.expiresAt`, com diferença exata de 900.000 ms (15 minutos).
A rotina verifica reservas a cada minuto, em lotes de 50. O pagamento é recusado
quando o prazo termina; a devolução física da reserva ocorre no ciclo seguinte e
pode levar mais tempo sob carga. Não há TTL no modelo de pedidos: a expiração
atualiza o status, libera estoque/cupom e preserva o histórico.

Os status em português correspondem a pending/paid/shipped/delivered/canceled;
existe ainda `em_preparacao`. O status da reserva continua separado.
Pagamentos reais permanecem pendentes por decisão do usuário.

## RNF-02 — Segurança em trânsito

`infra/production/Caddyfile` serve frontend e API na mesma origem HTTPS, com
TLS 1.2/1.3, renovação automática de certificados públicos, redirecionamento HTTP,
HSTS, CSP e demais cabeçalhos. A CSP inclui as fontes Google já usadas pelo frontend.
A API de produção escuta exclusivamente em `127.0.0.1`, aceita o protocolo
encaminhado somente por proxies loopback e recusa HTTP sem esse encaminhamento.
Este desenho exige que Caddy e Node executem no mesmo host. Não expor a porta
3002 por túneis ou por outro proxy. A configuração local continua usando HTTP.
Cookies de refresh continuam HttpOnly/SameSite=Lax, com Secure em produção.

### Implantação

1. Definir domínio com DNS apontando para o servidor e liberar as portas públicas
   TCP 80/443 (UDP 443 é opcional para HTTP/3). Manter a API e o MongoDB sem acesso público.
2. Instalar Node compatível com o projeto e Caddy no servidor. Usar
   `infra/production/.env.example` como referência para um arquivo privado do backend,
   completar os segredos e a conexão MongoDB e manter `CHECKOUT_TEST_MODE` vazio.
   A configuração local `.env` não deve ser copiada para produção.
3. Instalar dependências pelos lockfiles e executar `npm run build --prefix frontend`.
   Copiar o projeto para `/srv/clube-planner`, ou ajustar os caminhos abaixo.
4. Iniciar o backend com seu gerenciador de serviços, diretório de trabalho do projeto
   e variáveis de produção. Ele deve usar `PORT=3002` e `FRONTEND_URL=https://SEU_DOMINIO`.
5. Configurar no ambiente do serviço Caddy `SITE_DOMAIN=SEU_DOMINIO` (sem esquema)
   e `FRONTEND_DIST=/srv/clube-planner/frontend/dist`. O usuário do Caddy deve poder
   ler esse diretório. Copiar o Caddyfile de produção para a configuração do serviço.
   Validar com `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`
   usando essas mesmas variáveis; então iniciar/recarregar o serviço.
6. Executar `npm run deploy:check -- https://SEU_DOMINIO` a partir de uma máquina
   com acesso à internet. Guardar o resultado como evidência de implantação.

O script valida certificado/hostname, negocia TLS 1.2 e 1.3, exige rejeição explícita
de TLS 1.0/1.1, verifica redirecionamento, cabeçalhos no frontend/API e o health check.
Erros locais de cifra/rede/certificado não contam como comprovação de rejeição do
TLS legado. Uma porta HTTP alternativa pode ser passada como segundo argumento
para homologação. Não é necessário fornecer credenciais de clientes.

Referências: [TLS no Caddy](https://caddyserver.com/docs/caddyfile/directives/tls),
[proxy reverso](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) e
[cabeçalhos](https://caddyserver.com/docs/caddyfile/directives/header).

## Testes

`npm test` verifica a conexão ao banco de testes antes de abrir o Vitest, para
apresentar um diagnóstico claro quando o banco estiver indisponível. Os testes HTTP
exigem `mongodb://127.0.0.1:27017/clube_planner_test?replicaSet=rs0&directConnection=true`.
Somente esse banco exclusivo pode ser usado nas fixtures de integração.

A verificação inicial encontrou o MongoDB indisponível e um erro secundário de
source maps do Vitest. Com o banco de testes disponível, a suíte voltou a executar;
não foi necessário trocar dependências.

Validações locais em 16/11/2026: suíte de integração, build do frontend, validação
sintática do Caddy e homologação HTTPS com CA temporária exclusiva, sem instalar
certificado no sistema. A homologação usa portas alternativas e certificado local;
não comprova DNS, certificado público, firewall ou disponibilidade em produção.
A conclusão integral do RNF-02 depende da execução no domínio real.

Resultado final: **345 testes passaram em 37 arquivos**; build do frontend e
`git diff --check` passaram. O Caddy validou a configuração de produção. O
verificador de deploy passou contra a homologação local: TLS 1.2/1.3 e certificado,
rejeição explícita de TLS 1.0/1.1, redirecionamento e cabeçalhos no frontend e API.
O cenário de MongoDB indisponível também foi repetido: o comando encerrou com
código 1 e diagnóstico de conexão, antes de iniciar o Vitest.

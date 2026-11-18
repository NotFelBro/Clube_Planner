# Clube Planner

O Clube Planner é uma loja virtual de papelaria com vitrine, sacola, checkout e painel administrativo. O frontend é feito em React e o backend em Express, com dados persistidos em MongoDB. A versão pública está hospedada na Vercel e usa MongoDB Atlas.

[Abrir a loja](https://clube-planner.vercel.app/loja) · [Acessar a conta](https://clube-planner.vercel.app/login) · [Painel administrativo](https://clube-planner.vercel.app/admin)

## Funcionalidades

**Loja e conta do cliente**

- Catálogo com busca, filtros por categoria, detalhes de produtos, variações e avaliações de compradores.
- Cadastro com confirmação por e-mail, login, recuperação de senha, alteração de e-mail e gerenciamento de sessões e endereços.
- Sacola e checkout com consulta de endereço pelo ViaCEP, cálculo de frete por CEP e cupons de frete para itens elegíveis.
- Acompanhamento de pedidos e solicitação de cancelamento. Quando há um pagamento aprovado, a confirmação do reembolso depende do Mercado Pago.

**Administração**

- Dashboard com indicadores, gráfico de recebimentos e exportação de relatório em CSV.
- Cadastro de categorias e produtos com imagens, preços, SKUs, variações e controle de estoque.
- Consulta de pedidos, vendas, clientes e configurações da loja. A equipe pode atualizar o andamento do pedido e registrar o código de rastreio.
- Acesso protegido pelo papel `admin`, validado pelo backend.

## Arquitetura

| Camada | Tecnologia e localização |
| --- | --- |
| Interface web | React, Vite, Tailwind CSS e React Router em [frontend/](frontend/) |
| API | Node.js e Express em [src/](src/), com rotas sob `/api/v1` |
| Persistência | MongoDB e Mongoose em [src/models/](src/models/) |
| Autenticação e e-mail | JWT de acesso, renovação por cookie HttpOnly e envio SMTP com Nodemailer |
| Pagamentos | Mercado Pago Checkout Pro com API Preferences, em modo sandbox |
| Deploy | Vercel para o frontend e a função Node [api/index.js](api/index.js), com MongoDB Atlas |
| Testes | Vitest e Supertest em [tests/](tests/) |

Em desenvolvimento, o Vite encaminha `/api` para o Express na porta `3002`. Na Vercel, o frontend e a API compartilham o domínio. O MongoDB armazena valores monetários em centavos. Os pedidos preservam os valores, os itens e o endereço da compra, mesmo após mudanças no catálogo.

## Executar localmente

Use **Node.js 24**, npm e um MongoDB local em **replica set `rs0`**. O checkout usa transações do MongoDB para reservar e movimentar estoque. O [.env.example](.env.example) aponta para `127.0.0.1:27017`.

```bash
npm ci
npm ci --prefix frontend
test -f .env || cp .env.example .env
```

No `.env` da raiz, confira `MONGODB_URI` e `FRONTEND_URL`. Defina um `JWT_ACCESS_SECRET` com pelo menos 64 caracteres e um `EMAIL_CODE_SECRET` distinto com pelo menos 32 bytes. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` e `SMTP_PASS` para confirmação de e-mail e recuperação de senha. Mantenha as credenciais nos arquivos locais ignorados pelo Git ou nas variáveis privadas da Vercel.

Com o MongoDB em execução, inicie a API e o frontend em terminais separados.

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run dev --prefix frontend
```

Acesse [a loja local](http://localhost:5173/loja). O [health check local](http://localhost:3002/api/v1/health) verifica a API. Em desenvolvimento, o backend inicializa o catálogo com os produtos de demonstração de [shared/sampleProducts.json](shared/sampleProducts.json). O catálogo publicado consulta os produtos cadastrados no Atlas.

## Testes e build

`npm test` usa um banco separado chamado `clube_planner_test`. Configure `MONGODB_TEST_URI` para o MongoDB local em `127.0.0.1:27017`, conforme o [.env.example](.env.example).

```bash
npm test
npm run build --prefix frontend
```

Para executar só uma suíte, use, por exemplo, `npm test -- tests/adminCatalog.test.mjs`.

## Pagamentos de teste e deploy

O checkout publicado pode ser habilitado explicitamente em **Production** com `CHECKOUT_SANDBOX_PRODUCTION=1` e as credenciais de uma conta vendedora de teste. Use uma conta compradora de teste para simular compras. Os pedidos de teste no domínio público são registrados no Atlas da loja e afetam seu estoque. O fluxo atual não processa cobranças reais.

Para implantar, configure a raiz do repositório no projeto Vercel e cadastre as variáveis no ambiente correto. O [vercel.json](vercel.json) define o build, as rotas e a manutenção agendada. Após publicar, confira a implantação com:

```bash
npm run deploy:check -- https://clube-planner.vercel.app
```

[Configuração da Vercel e do Atlas](docs/deploy-vercel-atlas.md) · [Checkout e pagamentos de teste](docs/checkout-teste.md)

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Modelo de dados MongoDB](docs/modelo-dados-mongodb.md) | Coleções operacionais, campos, índices, objetos embutidos e relacionamentos |
| [Diagrama editável para Draw.io Desktop](docs/Modelo_Dados_ClubePlanner_Diagrama_Editavel_Organizado.drawio) | Diagrama do banco em formato `.drawio` |
| [Painel administrativo](docs/painel-administrativo.md) | Gestão da loja, pedidos, pagamentos e estoque |
| [Cadastro de produtos](docs/cadastro-produtos.md) | Categorias, variações, imagens e SKUs |
| [Frete por CEP](docs/frete-por-cep.md) | Faixas de frete e critérios de cupons |
| [Acesso por e-mail](docs/acesso-email.md) | Confirmação e recuperação da conta |
| [Status dos requisitos](docs/status-requisitos.md) | Acompanhamento dos requisitos do projeto |

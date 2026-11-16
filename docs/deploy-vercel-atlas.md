# Frontend e backend na Vercel com MongoDB Atlas

O projeto usa uma implantação na Vercel, com o frontend Vite como arquivos estáticos
e a API Express como uma função Node. O backend continua fora do Vite. O banco
fica no Atlas existente. Não é necessário usar Render ou Caddy nesse desenho.

## Preparação feita no repositório

- `vercel.json` instala as dependências dos dois pacotes e gera `frontend/dist`.
- `api/index.js` atende `/api/*` pela aplicação Express existente. As demais rotas
  têm fallback para o React, permitindo abrir e atualizar links internos.
- Cookies e chamadas `/api/v1/...` permanecem na mesma origem; não há URL de API
  pública embutida no frontend nem segredo com prefixo `VITE_`.
- A inicialização valida a configuração, conecta ao MongoDB e aguarda os índices
  antes de atender. Uma promessa compartilhada evita inicializações concorrentes.
  O pool é reutilizado na instância e limitado a cinco conexões. Uma falha permite
  nova tentativa; a aplicação responde 503 sem expor credenciais.
- A função não abre porta nem inicia intervalos. `npm start` continua disponível
  para execução local/servidor próprio, com seus timers habituais.
- Na Vercel, o protocolo encaminhado é aceito por um salto do proxy da plataforma.
  Isso só é habilitado com a variável de sistema `VERCEL=1`. No servidor próprio,
  continua valendo a confiança restrita ao proxy local.
- Cabeçalhos de segurança também são configurados para o frontend pela Vercel.
  TLS e certificados são geridos pela plataforma e precisam ser conferidos após publicar.

## 1. Conexão com o Atlas existente

No projeto Atlas, usar **Connect → Drivers → Node.js** para obter a URI do cluster.
Selecionar explicitamente o banco pretendido no caminho da URI, por exemplo
`...mongodb.net/clube_planner?retryWrites=true&w=majority`. Usar um usuário de banco
com acesso apenas ao banco da aplicação e senha codificada para uso em URL.
Não publicar a URI no GitHub nem compartilhar sua senha no chat.

O acesso de rede do Atlas deve permitir a saída da implantação Vercel. O IP do
computador de desenvolvimento não é o IP da função. A estratégia depende do plano
e da rede disponíveis; conferir os endereços de saída/rede privada antes de editar
a lista. Este código não altera a lista de rede nem amplia permissões do cluster.
Uma conexão com timeout pode indicar que essa etapa ainda falta.

O Atlas escolhido deve suportar as transações utilizadas pelo projeto. A URI não
deve apontar para `localhost` e não deve usar `directConnection=true` do MongoDB local.

**Os dados locais não são copiados automaticamente.** Clientes, administradores e
produtos precisam existir nesse banco para serem usados no site. O adaptador não
importa produtos de demonstração nem executa migrações de dados no Atlas. Ele cria
índices esperados em coleções novas, mas recusa índices legados incompatíveis;
nessa situação, preparar uma migração explícita, sem apagar registros existentes.

## 2. Variáveis privadas

Executar `npm run deploy:env` gera `.env.vercel` com segredos aleatórios, permissão
de leitura restrita e sem sobrescrever um arquivo anterior. O arquivo está ignorado
no Git e no upload da Vercel. Completar a URI e as configurações SMTP privadamente.
Depois importá-lo em **Environment Variables**, apenas no ambiente **Production**.

| Variável | Conteúdo |
| --- | --- |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://clube-planner.vercel.app`, sem barra final |
| `MONGODB_URI` | URI privada do Atlas com banco explicitamente escolhido |
| `JWT_ACCESS_SECRET` | Segredo gerado; mínimo 64 caracteres |
| `EMAIL_CODE_SECRET` | Segredo separado gerado; mínimo 32 bytes |
| `CRON_SECRET` | Segredo separado gerado; mínimo 32 caracteres |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Credenciais do provedor de e-mail |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` |

SMTP é necessário para confirmação de e-mail e recuperação de senha. Sem ele, a
API pode responder ao health check, mas os fluxos que enviam e-mail falharão.
Não usar segredos de produção em Preview nem importar o `.env` de desenvolvimento.
Não preencher `MP_ACCESS_TOKEN` de produção: pagamentos reais continuam desativados.
O checkout de demonstração permanece bloqueado em `NODE_ENV=production`.

## 3. Configurações do projeto Vercel

No projeto existente **clube-planner**, em **Settings → Build and Deployment**:

1. Alterar **Root Directory** de `frontend` para a raiz do repositório (campo vazio
   ou `.` conforme a interface). Isso permite incluir `api`, `src` e `shared`.
2. Manter **Framework Preset: Vite**, com Node.js compatível com o projeto (24.x).
3. Desativar os overrides antigos de build, instalação e saída. O `vercel.json` usa:
   instalação `npm ci --include=dev && npm ci --include=dev --prefix frontend`,
   build `npm run build --prefix frontend` e saída `frontend/dist`.
   Não deixar o override antigo `vite build` ou saída `dist` na raiz.
4. Salvar as variáveis privadas em Production antes de implantar a versão nova.
5. Enviar os commits ao GitHub e criar uma implantação da `main` com o novo commit.

O domínio principal permanece `https://clube-planner.vercel.app`.
Origens de deployments temporários não são automaticamente autorizadas para login;
usar o domínio principal na validação dos fluxos autenticados.

## 4. Rotinas agendadas e limite do Hobby

O cron chama `GET /api/v1/internal/maintenance` com
`Authorization: Bearer <CRON_SECRET>`. A Vercel adiciona esse cabeçalho ao definir
`CRON_SECRET` no ambiente. O segredo é verificado antes de abrir o banco. Sem ele,
ou com valor incorreto, a rota devolve 401. Outros métodos recebem 405.

No plano Hobby o agendamento incluído é diário, `0 6 * * *` (03h em São Paulo,
com imprecisão de até 59 minutos). A rotina libera até 50 reservas vencidas e
concilia um lote limitado de pagamentos, conforme os serviços existentes.
As transações tornam a liberação segura mesmo com chamadas concorrentes.

Durante acessos ao catálogo ou checkout, há também limpeza de reservas, limitada
a uma execução por minuto por instância. Não há garantia de execução sem tráfego;
a liberação física pode atrasar, especialmente se houver mais de 50 pendências.
A validade de uma reserva continua sendo de 15 minutos, mas **Hobby não comprova
uma rotina automática de liberação a cada minuto**. Para essa garantia, configurar
um agendador com essa frequência (por exemplo, cron no Pro, com autorização de custo).
O código não contrata nem habilita plano pago. Não iniciar pagamentos reais antes
de validar agendamento, expiração e webhooks na infraestrutura escolhida.

## 5. Conferência após a implantação

1. `/api/v1/health` deve responder JSON com `success: true`; agora a resposta depende
   da inicialização da conexão e dos índices.
2. `/api/v1/shop/orders` sem autenticação deve retornar 401 JSON.
3. Abrir e atualizar `/recuperar-senha`: deve carregar React, sem 404 da hospedagem.
4. Testar cadastro com e-mail próprio, confirmação, login, refresh e logout. Confirmar
   o refresh cookie com `Secure`, `HttpOnly` e `SameSite=Lax` no navegador.
5. Conferir o histórico do cron e os logs privados da função. Não colar credenciais
   em logs ou capturas. Respostas 503 exigem verificar variáveis, rede e índices.
6. Executar `npm run deploy:check -- https://clube-planner.vercel.app` para conferir
   TLS, redirecionamento, cabeçalhos e health check. Isso não substitui testar login.

## Referências

- [Funções Node](https://vercel.com/docs/functions/runtimes/node-js)
- [Configuração do projeto](https://vercel.com/docs/project-configuration/vercel-json)
- [Cabeçalhos encaminhados](https://vercel.com/docs/headers/request-headers)
- [Limites de cron no Hobby](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)
- [Proteção das rotinas agendadas](https://vercel.com/docs/schedules/cron-jobs/manage-cron-jobs)

## Validação local desta adaptação

Em 16/11/2026, passaram **359 testes em 39 arquivos**, incluindo a entrada real
`api/index.js` com MongoDB isolado: inicialização concorrente, reutilização de pool,
reconexão, índices, CORS e pagamentos desativados. Os testes unitários cobrem
proteção do cron, limpeza por demanda, retry e ausência de timers persistentes.
O build do frontend passou. Os campos utilizados do schema oficial e as rotas
foram conferidos com os validadores da Vercel. Isso ainda não é evidência de uma
implantação pública com Atlas: a conexão e o roteamento final devem ser homologados
após configurar o projeto e cadastrar as variáveis na conta do usuário.

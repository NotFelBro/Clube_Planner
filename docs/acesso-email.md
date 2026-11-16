# Cadastro e acesso com senha

O cadastro recebe `nome`, `email`, `senha` e `aceitouPrivacidade: true`.
O servidor exige senha não vazia e aceite booleano explícito. Salva a senha como
hash scrypt com salt aleatório, além da data e versão do aceite (2026-11-13).
A senha original não é armazenada nem devolvida pela API. Não há regras de
composição ou limite de caracteres no campo; permanece o limite de 100 kB do
corpo JSON da API. Espaços, Unicode e caracteres após a posição 72 são preservados.

O cadastro envia um link de confirmação por e-mail, de uso único e com validade de
10 minutos. A confirmação ativa a conta, cria uma sessão e direciona para `/loja`.
O login `POST /api/v1/auth/login` recebe `{ email, senha }` e exige conta ativa,
e-mail confirmado e senha correta. Login somente com e-mail não é mais permitido.
As sessões usam cookies HttpOnly e access tokens, conforme o fluxo existente.

Nos formulários de cadastro e login há um botão acessível para mostrar ou ocultar
a senha. O cadastro apresenta os termos de privacidade e exige uma caixa de
aceite inicialmente desmarcada. O navegador pode oferecer o salvamento das
credenciais via autocomplete; a aplicação não grava senhas em localStorage.

## Contas existentes e recuperação

As contas antigas e seus pedidos são preservados. Contas sem senha podem usar
“Definir ou recuperar minha senha” no login, após confirmar o e-mail.
`POST /api/v1/auth/forgot-password` recebe `{ email }`. A resposta não revela se a
conta existe. Para contas verificadas, envia um link para `/redefinir-senha` com
um token no fragmento, válido por 10 minutos e com intervalo de um minuto entre
envios por conta. O servidor guarda somente o hash do token e restaura o estado
anterior se o envio falhar.

`POST /api/v1/auth/reset-password` recebe `{ token, senha, aceitouPrivacidade: true }`.
O token é consumido uma única vez, e a nova senha e o aceite são salvos em uma
transação que também revoga as sessões anteriores. O cliente volta ao login para
entrar com a nova senha. Tokens de redefinição são separados dos de confirmação
de e-mail. As rotas de envio e consumo têm limitação de tentativas e validam a
origem. A rota de alteração direta `/password` continua indisponível.

## Envio único e apresentação dos e-mails

Confirmação de cadastro e redefinição usam um template HTML com botão, validade e
alternativa em texto simples. O envio só ocorre no cadastro inicial ou em uma
solicitação explícita de envio/reenvio; abrir a página não dispara mensagens.
A interface bloqueia submits duplicados com uma trava síncrona e exibe uma
contagem de 60 segundos antes de liberar o botão de reenvio. A atualização
atômica do último envio no MongoDB mantém o limite entre abas e requisições
concorrentes. Os limites SMTP de conexão e socket são menores que esse intervalo.

`emailService.criarTransportador` bloqueia SMTP real quando `NODE_ENV=test`,
mesmo se existirem credenciais válidas no `.env`. Testes devem simular as funções
de envio ou o transporte. Isso evita que regressões nos mocks enviem mensagens
para a caixa de e-mail durante a execução dos testes.

## CPF editável e confirmação de alteração de e-mail

`PATCH /api/v1/auth/me` permite nome e CPF. CPF informado é normalizado para
11 dígitos e validado por dígitos verificadores; vazio remove o CPF opcional.
Conflito com outra conta ativa retorna 409 sem salvar parcialmente os demais dados.

`POST /api/v1/auth/me/email-change` exige sessão e `{email, senhaAtual}`.
Envia uma única mensagem por solicitação, com intervalo mínimo de 60 segundos.
O e-mail oficial permanece intacto; o endereço pendente não serve para login.
`POST /api/v1/auth/confirm-email-change` consome `{token}` de uso único em até
10 minutos. O token tem propósito separado, somente seu hash fica armazenado.
Confirmação atualiza a mesma conta, revoga sessões e registra o evento em uma
transação. O cliente entra novamente com o novo e-mail e sua senha atual.
`DELETE /api/v1/auth/me/email-change` cancela a pendência. Redefinir a senha
invalida também a troca pendente. Falha SMTP restaura a pendência anterior.

O painel de clientes consulta e-mail oficial e CPF da mesma coleção de usuários.
CPF e e-mail são únicos entre contas com `ativo: true`, por índices parciais
`cpf_ativo_unico` e `email_ativo_unico`. Reutilizar dados de uma conta desativada
cria outra identidade e não transfere pedidos. Reativação conflituosa retorna 409.
A inicialização recusa índices legados que ainda imponham unicidade global.
Migração local explícita: `node scripts/migrations/apply-active-user-indexes.cjs --apply`.
Os índices novos são criados e verificados antes de retirar os legados conhecidos;
nenhum cadastro é excluído. Produção exige migração planejada no seu ambiente.

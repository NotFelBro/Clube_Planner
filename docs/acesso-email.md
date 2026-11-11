# Cadastro e acesso por e-mail

O cadastro recebe apenas `nome` e `email`, salva a conta e envia um código de seis dígitos. `POST /api/v1/auth/login` recebe `{ "email": "cliente@example.com" }` e cria a sessão diretamente para uma conta ativa já cadastrada e verificada, sem código ou senha. Quem souber o e-mail poderá acessar a conta.

`POST /api/v1/auth/verify-email` recebe `email` e `codigo`, consome o código e cria a sessão com cookie HttpOnly. O código expira em dez minutos, permite cinco tentativas e tem intervalo mínimo de um minuto entre envios. O código é exigido somente para confirmar o cadastro. SMTP e `EMAIL_CODE_SECRET` precisam estar configurados.

As rotas `/password`, `/forgot-password` e `/reset-password` foram removidas. O perfil aceita apenas a alteração do nome. Senha e telefone não são mais usados ou retornados pela autenticação. Os registros antigos são preservados.

## Banco existente

Antes de usar o novo cadastro, ajuste o índice único de CPF para aceitar documentos sem esse campo. Com `MONGODB_URI` apontando para o banco desejado:

```sh
node scripts/migrations/migrate-email-access.mjs --check
node scripts/migrations/migrate-email-access.mjs --apply
```

O script altera apenas o índice de CPF, mantendo a unicidade dos CPFs preenchidos e dos e-mails. Não apaga nem modifica documentos. Bancos novos recebem o índice pelo modelo Mongoose.

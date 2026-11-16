# Revisão de segurança — 13/11/2026

A revisão cobre o código local da API Express, autenticação, formulários, catálogo,
pedidos, pagamentos de teste e serviços de estoque. Não equivale a um pentest nem
certifica a infraestrutura de produção. Nenhum teste envia e-mail real.

## Alterações aplicadas

| Área | Proteção e comportamento |
| --- | --- |
| Entrada da API | Corpo JSON de até 100 kB, sem compactação; rejeita arrays na raiz, operadores `$`, chaves de protótipo, caminhos de campos e estruturas com mais de 12 níveis. `data.id` é aceito apenas como chave de consulta para compatibilidade com o webhook. |
| Erros | Respostas JSON para JSON inválido (400), dados inválidos (400), acesso indevido (401/403), inexistência (404), conflitos (409), tamanho excessivo (413), formato/compactação (415), excesso de tentativas (429) e indisponibilidade (503). Outros erros resultam em 500 sem stack ou detalhes internos. |
| Dados pessoais | `Cache-Control: no-store` na API; identificador de requisição gerado no servidor. Falhas internas no handler registram tipo/status/identificador, sem corpo, senha, token ou URI de banco. |
| Abuso | Limite global de 300 requisições/minuto/IP. Login mantém limite de 20 tentativas/15 minutos/IP e agora também 10 falhas/15 minutos/conta normalizada. Quatro derivações scrypt simultâneas por processo limitam consumo de memória. |
| Autorização | JWT com sessão ativa no banco, conta ativa e e-mail verificado. Papel administrativo é consultado no banco. Não confia em papel ou ID enviados pelo cliente. Cabeçalho de autorização limitado a 4096 caracteres. |
| Troca de senha | Usuário e sessão têm versão de credencial. O reset incrementa a versão e revoga sessões. Uma sessão criada numa corrida usando a senha anterior também é rejeitada. |
| CSRF e CORS | Escritas exigem Origin correspondente ao frontend configurado. Origens externas são recusadas pelo CORS. Cookies de renovação continuam HttpOnly/SameSite=Lax e Secure em produção. |
| Endereços | Cadastro atômico limitado a 20 endereços por conta; não remove ou altera os já salvos quando o limite é atingido. |
| Pagamentos | Mantidas validações de vendedor de teste, moeda, valor calculado no servidor, propriedade do pedido, assinatura e idempotência. Webhooks com timestamp fora de cinco minutos são recusados. |
| Estoque | Serviço do catálogo persistido já reservava estoque atomicamente. Novo serviço libera reservas vencidas e cupom na mesma transação, sem duplicar devoluções ou alterar pedidos pagos. Lote limitado a 50 pedidos e execução a cada minuto na API principal. |
| Frontend | Falhas de renderização mostram uma página de recuperação. Chamadas compartilhadas de autenticação e loja têm timeout de 45 segundos, tratam respostas inesperadas e não repetem gravações automaticamente. |
| Desempenho | Índice de avaliações por produto/data; consultas existentes de pedidos e avaliações continuam limitadas. Parsing, criptografia, endereços e execução de reservas têm limites explícitos. |
| Inicialização | Produção exige origem HTTPS, segredos JWT/e-mail e URI do MongoDB. A API aguarda os índices do usuário antes de aceitar cadastros. Timeouts de cabeçalhos/requisições e quantidade de requisições por socket configurados. |

## Requisitos da imagem

- **RNF-01 — Desempenho:** limites de recursos, índice e lotes implementados. Não foi realizado benchmark de carga em infraestrutura pública; não há promessa de tempo de resposta ou capacidade de usuários simultâneos.
- **RNF-03 — Proteção de dados:** controle de acesso, prevenção de cache de respostas privadas, tratamento seguro de erros e invalidação de credenciais reforçados. Infraestrutura, backups e armazenamento em produção ainda exigem configuração própria.
- **RN-03 — Reserva de estoque:** após a integração administrativa, a vitrine e o painel usam o mesmo estoque persistido. Reservas, consumo, cancelamento, expiração e retorno físico são transacionais. Foram autorizadas 100 unidades iniciais por produto importado, somente para demonstração. Veja [o painel integrado](painel-administrativo.md).
- **RN-04 — Cadastro único:** índice único de e-mail e validação de duplicidade, incluindo teste de duas tentativas simultâneas. CPF permanece único quando preenchido. Nenhum cadastro existente foi apagado ou mesclado.

## Dependências: correções concluídas com autorização

Após autorização explícita do usuário, as dependências foram atualizadas usando o
registro público npm, sem executar scripts de instalação:

| Dependência | Antes | Depois |
| --- | --- | --- |
| Mongoose | 9.11.3 | 9.12.1 |
| body-parser | 2.3.0 | 2.4.0 |
| follow-redirects (desenvolvimento) | 1.16.1 | 1.16.3 |
| ESLint (frontend) | 10.13.0 | 10.15.0 |
| @eslint/config-array | 0.23.5 | 0.23.6 |
| minimatch (frontend) | 10.2.6 | 11.0.8 |

O nodemon foi removido para eliminar sua dependência vulnerável de minimatch.
`npm run dev` e `npm run dev:manual` agora usam `node --watch`, disponível no Node
24 deste ambiente, mantendo a reinicialização automática ao alterar arquivos.
A execução `npm start` permanece igual. Os lockfiles foram atualizados.

A auditoria completa `npm audit --json`, incluindo produção e desenvolvimento,
retornou **zero vulnerabilidades conhecidas no backend e no frontend** em
13/11/2026. Esse resultado não equivale a garantir ausência de falhas no código ou
na infraestrutura.

Os bloqueios automáticos iniciais de auditoria/instalação foram resolvidos pela
autorização do usuário. Não há mais atualização de dependências aguardando essa
aprovação. A suíte foi repetida com as versões finais: **295 testes passaram** e
o build do frontend passou. O lint global ainda aponta dois problemas anteriores
em `PersonalData.jsx` (setState em efeito) e `AuthContext.jsx` (exportação de hook
com componente); eles não foram introduzidos por essas atualizações.

Referências dos avisos corrigidos: [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[Mongoose — filtros](https://github.com/advisories/GHSA-gg4r-jv3p-qx3c),
[Mongoose — hidratação](https://github.com/advisories/GHSA-8332-j7wj-wjw4),
[follow-redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Limites e implantação

- Limitadores usam memória do processo; em múltiplas instâncias é necessário um armazenamento compartilhado ou limitação no gateway. Não confiar indiscriminadamente em `X-Forwarded-For`; configurar apenas proxies conhecidos.
- TLS deve proteger frontend e API na entrada pública. Helmet na API não configura automaticamente o servidor que hospeda os arquivos estáticos do frontend.
- MongoDB de produção precisa de autenticação, rede restrita, TLS, backup/restauração e configuração de proteção em repouso. Nada dessa infraestrutura foi publicado ou alterado nesta revisão.
- O checkout continua restrito ao sandbox. O estoque da vitrine foi integrado e há consulta de pagamentos pelo painel; cobranças de produção não foram ativadas.
- As senhas continuam livres de regras de composição e tamanho no formulário, conforme pedido anterior. Senhas curtas ainda podem ser adivinhadas; limites de tentativas não eliminam esse risco.
- A rotina de expiração não contata provedores de pagamento. Ela inclui os novos pedidos de demonstração com estoque controlado e preserva os pedidos antigos sem controle. Aprovação tardia nos pedidos integrados é encaminhada a reembolso, sem consumir estoque cuja reserva já expirou.
- Os termos de privacidade existentes são texto do projeto, não uma revisão jurídica ou certificação de conformidade.

## Validação

Suíte completa: **295 testes passaram em 33 arquivos**, incluindo injeção,
protótipos, autorização, limites, erros de rede, payload grande, compactação,
webhook vencido, cadastro concorrente, versão de credencial, limite de endereços,
reserva/expiração concorrente e rollback. Testes HTTP usam o banco isolado
`clube_planner_test`; nenhum registro de cliente foi usado como fixture.

Build do frontend e lint dos arquivos alterados passaram. O teste antigo de preços
foi atualizado para considerar os descontos já existentes no catálogo, mantendo
as verificações de valores em centavos e dos preços originais.

Referências usadas: [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html),
[segurança em produção no Express](https://expressjs.com/advanced/best-practice-security/).

## Compatibilidade do banco local

A primeira ativação detectou `cpf_1` legado, único e sem filtro parcial, que
conflitava com CPF opcional. No banco local foi criado e verificado primeiro o
índice único parcial `cpf_preenchido_unico`; só depois o índice legado foi
removido. A unicidade de CPFs preenchidos permaneceu protegida durante toda a
substituição. Nenhum documento de cliente foi alterado ou apagado.

A inicialização agora verifica a definição e a unicidade dos índices de usuário,
aceitando nomes equivalentes resultantes de migração. Índices incompatíveis
continuam impedindo a inicialização; não são apagados automaticamente. A rotina
foi coberta por testes de compatibilidade, criação em coleção nova e rejeição de
índice legado.

## Complemento — cadastro único entre contas ativas e dados pessoais

A regra RN-04 agora usa os índices parciais `cpf_ativo_unico` e
`email_ativo_unico`, com `ativo: true`; esta política substitui a unicidade global
mencionada nos registros anteriores desta revisão. A migração verifica as novas
garantias antes de retirar índices legados e não exclui documentos.
O perfil permite editar CPF válido; o e-mail só muda após senha atual e token
recebido no novo endereço. A confirmação é transacional, registra auditoria e
revoga sessões. Reativar conta com identidade reutilizada retorna conflito 409.
O painel lê e-mail confirmado e CPF diretamente do cadastro compartilhado.

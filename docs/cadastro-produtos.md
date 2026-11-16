# Cadastro de produtos

Acesse `/admin/produtos` com uma conta autenticada cujo `role` seja `admin`. A API valida a permissão no servidor em todas as operações. `/admin-demo` continua sendo apenas uma pré-visualização.

Cadastre categorias em `/admin/categorias` ou pelo botão “Nova categoria” no cadastro de produtos. Cada produto possui nome, slug único, descrição, categoria, até 12 imagens com URLs HTTP/HTTPS ou caminhos locais em `/products/` e status ativo. A primeira imagem é a capa; não há envio de arquivos neste fluxo.

Cada variação possui SKU único, atributos livres (um por linha, como `Cor: Rosa`), preço em reais, estoque disponível e status. A API armazena preços em centavos inteiros. O estoque reservado é somente leitura e variações com reservas não podem ser removidas. Use o status inativo para retirar registros de operação sem excluí-los.

A edição exige a data da última atualização e retorna conflito se o registro mudou desde a leitura. Em caso de conflito, recarregue a página e reabra o registro.

Endpoints administrativos:

- `GET /api/v1/admin/catalog`: produtos e categorias.
- `POST /api/v1/admin/categories` e `PUT /api/v1/admin/categories/:id`.
- `POST /api/v1/admin/products` e `PUT /api/v1/admin/products/:id`.

Envie Bearer token e, nas escritas, a origem configurada em `FRONTEND_URL`. Atualizações incluem `updatedAt` do registro carregado. O catálogo público e o checkout agora consultam os mesmos produtos e categorias persistidos em MongoDB. Cada variação tem um ID estável de vitrine. Alterações de estoque, preço e publicação refletem na loja. Veja [a integração administrativa](painel-administrativo.md) para o ciclo de pedidos, pagamentos e reservas.

Validação automatizada: `npx vitest run tests/adminCatalog.test.mjs` (autorização, origem, campos inválidos, duplicação de SKU, conflitos e preservação de reservas); `npm --prefix frontend run build`.

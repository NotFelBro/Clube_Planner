
const mongoose = require("mongoose");
const User = require("../models/User");

const CAMPOS_ENDERECO = [
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "estado",
];

const CAMPOS_OBRIGATORIOS = [
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "cidade",
  "estado",
];

function validarId(id) {
  return mongoose.isObjectIdOrHexString(id);
}

function obterObjectId(id) {
  if (!validarId(id)) {
    throw new Error("Identificador inválido.");
  }

  return new mongoose.Types.ObjectId(id.toString());
}

/**
 * Normaliza e valida um endereço completo.
 *
 * Não permite que o cliente escolha _id ou principal.
 * Utiliza as validações do subdocumento Mongoose.
 */
async function prepararEndereco(dados) {
  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new Error("Dados do endereço inválidos.");
  }

  const endereco = {};

  for (const campo of CAMPOS_ENDERECO) {
    if (dados[campo] !== undefined) {
      if (typeof dados[campo] !== "string") {
        throw new Error(`Campo inválido: ${campo}`);
      }

      endereco[campo] = dados[campo].trim();
    }
  }

  for (const campo of CAMPOS_OBRIGATORIOS) {
    if (!endereco[campo]) {
      throw new Error(
        `Campo obrigatório inválido: ${campo}`
      );
    }
  }

  endereco.cep = endereco.cep.replace(/\D/g, "");
  endereco.estado = endereco.estado.toUpperCase();
  endereco.complemento = endereco.complemento || "";

  // Valida exclusivamente o subdocumento.
  const documentoTemporario = new User({
    enderecos: [{
      ...endereco,
      principal: true,
    }],
  });

  const subdocumento = documentoTemporario.enderecos[0];

  await subdocumento.validate();

  const validado = subdocumento.toObject();

  // O serviço controla esses campos separadamente.
  delete validado._id;
  delete validado.principal;

  return validado;
}

/**
 * Adiciona um endereço.
 *
 * O primeiro endereço torna-se principal.
 * A operação é atômica por documento.
 */
async function adicionarEndereco(userId, dados) {
  const usuarioId = obterObjectId(userId);
  const dadosValidados = await prepararEndereco(dados);

  const novoEndereco = {
    ...dadosValidados,
    _id: new mongoose.Types.ObjectId(),
  };

  const atualizado = await User.findOneAndUpdate(
    {
      _id: usuarioId,
      ativo: true,
    },
    [
      {
        $set: {
          enderecos: {
            $let: {
              vars: {
                atuais: {
                  $ifNull: ["$enderecos", []],
                },
              },
              in: {
                $concatArrays: [
                  "$$atuais",
                  [
                    {
                      $mergeObjects: [
                        { $literal: novoEndereco },
                        {
                          principal: {
                            $eq: [
                              { $size: "$$atuais" },
                              0,
                            ],
                          },
                        },
                      ],
                    },
                  ],
                ],
              },
            },
          },
        },
      },
    ],
    
{
  returnDocument: "after",
  updatePipeline: true,
}

  );

  if (!atualizado) {
    throw new Error("Usuário não encontrado.");
  }

  return atualizado.enderecos;
}

/**
 * Define um endereço existente como principal.
 *
 * Apenas o endereço selecionado recebe principal=true.
 */
async function definirEnderecoPrincipal(
  userId,
  enderecoId
) {
  const usuarioId = obterObjectId(userId);
  const id = obterObjectId(enderecoId);

  const atualizado = await User.findOneAndUpdate(
    {
      _id: usuarioId,
      ativo: true,
      "enderecos._id": id,
    },
    [
      {
        $set: {
          enderecos: {
            $map: {
              input: "$enderecos",
              as: "endereco",
              in: {
                $mergeObjects: [
                  "$$endereco",
                  {
                    principal: {
                      $eq: [
                        "$$endereco._id",
                        { $literal: id },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ],
    
{
  returnDocument: "after",
  updatePipeline: true,
}

  );

  if (!atualizado) {
    throw new Error("Endereço não encontrado.");
  }

  return atualizado.enderecos;
}

/**
 * Edita os dados de um endereço existente.
 *
 * Recebe os campos completos do endereço.
 * Não altera o _id nem o status principal.
 */
async function editarEndereco(
  userId,
  enderecoId,
  dados
) {
  const usuarioId = obterObjectId(userId);
  const id = obterObjectId(enderecoId);

  const dadosValidados = await prepararEndereco(dados);

  const atualizado = await User.findOneAndUpdate(
    {
      _id: usuarioId,
      ativo: true,
      "enderecos._id": id,
    },
    [
      {
        $set: {
          enderecos: {
            $map: {
              input: "$enderecos",
              as: "endereco",
              in: {
                $cond: [
                  {
                    $eq: [
                      "$$endereco._id",
                      { $literal: id },
                    ],
                  },
                  {
                    $mergeObjects: [
                      "$$endereco",
                      { $literal: dadosValidados },
                    ],
                  },
                  "$$endereco",
                ],
              },
            },
          },
        },
      },
    ],
    
{
  returnDocument: "after",
  updatePipeline: true,
}

  );

  if (!atualizado) {
    throw new Error("Endereço não encontrado.");
  }

  return atualizado.enderecos;
}

/**
 * Exclui um endereço.
 *
 * Se o principal for excluído, promove
 * o primeiro endereço restante.
 */
async function excluirEndereco(userId, enderecoId) {
  const usuarioId = obterObjectId(userId);
  const id = obterObjectId(enderecoId);

  const atualizado = await User.findOneAndUpdate(
    {
      _id: usuarioId,
      ativo: true,
      "enderecos._id": id,
    },
    [
      {
        $set: {
          enderecos: {
            $filter: {
              input: "$enderecos",
              as: "endereco",
              cond: {
                $ne: [
                  "$$endereco._id",
                  { $literal: id },
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          enderecos: {
            $cond: [
              {
                $and: [
                  {
                    $gt: [
                      { $size: "$enderecos" },
                      0,
                    ],
                  },
                  {
                    $not: [
                      {
                        $in: [
                          true,
                          "$enderecos.principal",
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                $map: {
                  input: "$enderecos",
                  as: "endereco",
                  in: {
                    $mergeObjects: [
                      "$$endereco",
                      {
                        principal: {
                          $eq: [
                            "$$endereco._id",
                            {
                              $arrayElemAt: [
                                "$enderecos._id",
                                0,
                              ],
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
              "$enderecos",
            ],
          },
        },
      },
    ],
    
{
  returnDocument: "after",
  updatePipeline: true,
}

  );

  if (!atualizado) {
    throw new Error("Endereço não encontrado.");
  }

  return atualizado.enderecos;
}


/**
 * Obtém um snapshot do endereço para o checkout.
 *
 * O endereço precisa pertencer ao usuário ativo.
 * A leitura pode participar da transação MongoDB.
 */
async function obterEnderecoParaCheckout({
  userId,
  enderecoId,
  session,
}) {
  const usuarioId = obterObjectId(userId);
  const id = obterObjectId(enderecoId);

  if (!session) {
    throw new Error("Sessão MongoDB obrigatória.");
  }

  const usuario = await User.findOne({
    _id: usuarioId,
    ativo: true,
    "enderecos._id": id,
  })
    .select("enderecos")
    .session(session);

  if (!usuario) {
    throw new Error(
      "Endereço não encontrado para este usuário."
    );
  }

  const endereco = usuario.enderecos.id(id);

  if (!endereco) {
    throw new Error("Endereço não encontrado.");
  }

  return {
    cep: endereco.cep,
    logradouro: endereco.logradouro,
    numero: endereco.numero,
    complemento: endereco.complemento || "",
    bairro: endereco.bairro,
    cidade: endereco.cidade,
    estado: endereco.estado,
  };
}


module.exports = {
  adicionarEndereco,
  definirEnderecoPrincipal,
  editarEndereco,
  excluirEndereco,
  obterEnderecoParaCheckout,
};

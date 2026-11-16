
require("dotenv").config();

const {
  MongoClient,
  ObjectId
} = require("mongodb");

const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const BANCO = "clube_planner";

const ALVOS = [
  {
    _id: new ObjectId("6af392fb5d2160e3051fc676"),
    email: "delimafelipe291@gmail.com"
  },
  {
    _id: new ObjectId("6af26c17ed0779e1a206fdf7"),
    email: "tagm554@gmail.com"
  }
];

const COLECOES_RELACIONADAS = [
  "sessions",
  "testcards"
];

function validarDestino(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI não configurada.");
  }

  const url = new URL(uri);

  if (
    url.protocol !== "mongodb:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "27017" ||
    url.pathname !== `/${BANCO}` ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error("Destino MongoDB não autorizado.");
  }
}

async function executar() {
  const uri = process.env.MONGODB_URI;
  validarDestino(uri);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000
  });

  const ids = ALVOS.map((alvo) => alvo._id);

  const filtroUsuarios = {
    $or: ALVOS.map((alvo) => ({
      _id: alvo._id,
      email: alvo.email
    }))
  };

  const filtroVinculos = {
    userId: { $in: ids }
  };

  try {
    await client.connect();

    const db = client.db(BANCO);

    console.log("\n=== EXCLUSÃO CONTROLADA ===");
    console.log("Banco:", db.databaseName);

    const usuarios = await db
      .collection("users")
      .find(filtroUsuarios)
      .toArray();

    if (usuarios.length !== ALVOS.length) {
      throw new Error(
        "Quantidade inesperada de usuários. Exclusão bloqueada."
      );
    }

    for (const alvo of ALVOS) {
      const usuario = usuarios.find(
        (item) =>
          String(item._id) === String(alvo._id) &&
          item.email === alvo.email
      );

      if (!usuario) {
        throw new Error(
          `Identidade não confirmada: ${alvo.email}`
        );
      }
    }

    console.log("\nUsuários confirmados:");

    console.table(
      usuarios.map((usuario) => ({
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role
      }))
    );

    const contagens = {};

    for (const nome of COLECOES_RELACIONADAS) {
      contagens[nome] = await db
        .collection(nome)
        .countDocuments(filtroVinculos);
    }

    console.log("\nRegistros vinculados:");
    console.table(contagens);

    const outrasColecoes = [
      "orders",
      "payments",
      "carts",
      "reviews",
      "password_reset_tokens"
    ];

    for (const nome of outrasColecoes) {
      const total = await db
        .collection(nome)
        .countDocuments();

      if (total > 0) {
        throw new Error(
          `Coleção ${nome} possui ${total} documentos. ` +
          "Exclusão bloqueada para revisão."
        );
      }
    }

    console.log(
      "\nA operação removerá somente os dois usuários " +
      "e seus registros vinculados."
    );

    console.log(
      "\nNenhuma alteração foi realizada até aqui."
    );

    const rl = readline.createInterface({
      input: stdin,
      output: stdout
    });

    let confirmacao;

    try {
      confirmacao = await rl.question(
        '\nDigite EXCLUIR DOIS CADASTROS para confirmar: '
      );
    } finally {
      rl.close();
    }

    if (confirmacao !== "EXCLUIR DOIS CADASTROS") {
      console.log("\nOperação cancelada.");
      return;
    }

    // Confere novamente as identidades antes de excluir.
    for (const alvo of ALVOS) {
      const usuario = await db
        .collection("users")
        .findOne({
          _id: alvo._id,
          email: alvo.email
        });

      if (!usuario) {
        throw new Error(
          "Usuário alterado durante a confirmação. " +
          "Exclusão bloqueada."
        );
      }
    }

    // Exclui primeiro os dados vinculados.
    for (const nome of COLECOES_RELACIONADAS) {
      const resultado = await db
        .collection(nome)
        .deleteMany(filtroVinculos);

      console.log(
        `${nome}: ${resultado.deletedCount} excluídos`
      );
    }

    // Exclui somente os usuários confirmados.
    for (const alvo of ALVOS) {
      const resultado = await db
        .collection("users")
        .deleteOne({
          _id: alvo._id,
          email: alvo.email
        });

      console.log(
        `${alvo.email}: ${resultado.deletedCount} excluído`
      );
    }

    console.log("\n=== VERIFICAÇÃO FINAL ===");

    const restantes = await db
      .collection("users")
      .countDocuments({
        _id: { $in: ids }
      });

    console.log(
      "Usuários-alvo restantes:",
      restantes
    );

    for (const nome of COLECOES_RELACIONADAS) {
      const restantesVinculados = await db
        .collection(nome)
        .countDocuments(filtroVinculos);

      console.log(
        `${nome} vinculados restantes:`,
        restantesVinculados
      );
    }

    console.log("\nOperação finalizada.");
  } finally {
    await client.close();
  }
}

executar().catch((erro) => {
  console.error("\nERRO:", erro.message);
  process.exitCode = 1;
});

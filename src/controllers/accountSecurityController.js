const Session = require("../models/session");

function identificarDispositivo(userAgent = "") {
  if (!userAgent) return { tipo: "unknown", nome: "Dispositivo não identificado" };
  const tablet = /iPad|Tablet|SM-T|SM-X/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent));
  const celular = !tablet && /Mobile|iPhone|Android/i.test(userAgent);
  const tipo = tablet ? "tablet" : celular ? "mobile" : "desktop";
  const marca = /Samsung|SM-[A-Z0-9]+/i.test(userAgent) ? "Samsung" : /Lenovo/i.test(userAgent) ? "Lenovo" : /iPad/i.test(userAgent) ? "Apple iPad" : /iPhone/i.test(userAgent) ? "Apple iPhone" : /Macintosh|Mac OS/i.test(userAgent) ? "Mac" : /Android/i.test(userAgent) ? "Android" : /Windows/i.test(userAgent) ? "Windows" : /Linux/i.test(userAgent) ? "Linux" : "";
  return { tipo, nome: `${tablet ? "Tablet" : celular ? "Celular" : "Computador"}${marca ? ` · ${marca}` : ""}` };
}

async function listarSessoes(req, res, next) {
  try {
    const sessoes = await Session.find({ userId: req.auth.userId, revokedAt: null, expiresAt: { $gt: new Date() } })
      .select("_id userAgent createdAt lastUsedAt").sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: { sessoes: sessoes.map((sessao) => ({
      id: String(sessao._id), atual: String(sessao._id) === req.auth.sessionId,
      dispositivo: identificarDispositivo(sessao.userAgent),
      ultimaAtividade: sessao.lastUsedAt || sessao.createdAt,
    })) } });
  } catch (erro) { next(erro); }
}

module.exports = { listarSessoes, identificarDispositivo };

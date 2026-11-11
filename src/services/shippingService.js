const rules = require("../../shared/shippingRules.json");
const { AuthError } = require("./authService");

function normalizarCep(valor) {
  if (typeof valor !== "string" || !/^\d{5}-?\d{3}$/.test(valor.trim())) {
    throw new AuthError("Informe um CEP válido com oito dígitos.");
  }
  return valor.trim().replace("-", "");
}

function distanciaKm(origem, destino) {
  const radianos = (graus) => graus * Math.PI / 180;
  const dLat = radianos(destino.latitude - origem.latitude);
  const dLon = radianos(destino.longitude - origem.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radianos(origem.latitude)) * Math.cos(radianos(destino.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

function faixaParaDistancia(distancia) {
  if (!Number.isFinite(distancia) || distancia < 0) throw new AuthError("Distância inválida.");
  return rules.faixas.find((faixa) => faixa.limiteKm === null || distancia <= faixa.limiteKm);
}

function criarServicoFrete({ consultar = (...args) => fetch(...args), agora = () => Date.now() } = {}) {
  const cache = new Map();
  const pendentes = new Map();

  async function localizarCep(cep) {
    const salvo = cache.get(cep);
    if (salvo && salvo.expiraEm > agora()) return salvo.localizacao;
    if (pendentes.has(cep)) return pendentes.get(cep);
    const requisicao = (async () => {
      let dados;
      try {
        const response = await consultar(`https://brasilapi.com.br/api/cep/v2/${cep}`, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
        if (response.status === 404) throw new AuthError("CEP não encontrado. Confira o endereço de entrega.", 422);
        if (!response.ok) throw new Error("Consulta indisponível.");
        dados = await response.json();
      } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError("Não foi possível calcular o frete agora. Tente novamente.", 503);
      }
      const coordinates = dados?.location?.coordinates;
      const latitude = coordinates?.latitude;
      const longitude = coordinates?.longitude;
      const valido = (valor) => (typeof valor === "number" || (typeof valor === "string" && valor.trim() !== "")) && Number.isFinite(Number(valor));
      if (dados?.cep !== cep || !valido(latitude) || !valido(longitude) || Number(latitude) < -34 || Number(latitude) > 6 || Number(longitude) < -74 || Number(longitude) > -28) {
        throw new AuthError("Não foi possível localizar esse CEP para calcular o frete. Confira o CEP ou tente novamente mais tarde.", 422);
      }
      const localizacao = { latitude: Number(latitude), longitude: Number(longitude) };
      if (cache.size >= 1000) cache.delete(cache.keys().next().value);
      cache.set(cep, { localizacao, expiraEm: agora() + 6 * 60 * 60 * 1000 });
      return localizacao;
    })();
    pendentes.set(cep, requisicao);
    try { return await requisicao; }
    finally { pendentes.delete(cep); }
  }

  async function cotarFrete(cepInformado) {
    const cep = normalizarCep(cepInformado);
    // O próprio CEP da origem tem distância zero, sem consulta externa.
    const destino = cep === rules.origem.cep ? rules.origem : await localizarCep(cep);
    const distancia = distanciaKm(rules.origem, destino);
    const faixa = faixaParaDistancia(distancia);
    return {
      cep,
      nivel: faixa.nivel,
      valorCentavos: faixa.valorCentavos,
      distanciaKm: Math.round(distancia * 100) / 100,
      metodo: "linha_reta_entre_ceps",
      origem: { nome: rules.origem.nome, endereco: rules.origem.endereco, cep: rules.origem.cep },
    };
  }

  return { cotarFrete };
}

module.exports = { ...criarServicoFrete(), criarServicoFrete, normalizarCep, distanciaKm, faixaParaDistancia };

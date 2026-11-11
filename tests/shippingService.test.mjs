import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const shipping = require("../src/services/shippingService");
const rules = require("../shared/shippingRules.json");
const cep = "01001000";
const location = { latitude: "-23.5503898", longitude: "-46.633081" };
const response = (coordinates = location, extra = {}) => ({ ok: true, status: 200, json: async () => ({ cep, location: { coordinates }, ...extra }) });

describe("Frete por distância do SENAI Barueri", () => {
  it.each([[0, 1, 300], [10, 1, 300], [10.001, 2, 600], [30, 2, 600], [30.001, 3, 900], [5000, 3, 900]])("classifica %s km sem arredondar antes de definir a faixa", (distance, level, value) => {
    expect(shipping.faixaParaDistancia(distance)).toMatchObject({ nivel: level, valorCentavos: value });
  });

  it("calcula distância geográfica simétrica e zero na origem", () => {
    expect(shipping.distanciaKm(rules.origem, rules.origem)).toBe(0);
    const saoPaulo = { latitude: -23.5503898, longitude: -46.633081 };
    const distance = shipping.distanciaKm(rules.origem, saoPaulo);
    expect(distance).toBeGreaterThan(20); expect(distance).toBeLessThan(30);
    expect(shipping.distanciaKm(saoPaulo, rules.origem)).toBeCloseTo(distance, 8);
  });

  it("normaliza CEP e não consulta a rede para a própria origem", async () => {
    const consultar = vi.fn(); const service = shipping.criarServicoFrete({ consultar });
    expect(await service.cotarFrete("06401-134")).toMatchObject({ cep: "06401134", nivel: 1, valorCentavos: 300, distanciaKm: 0 });
    expect(consultar).not.toHaveBeenCalled();
  });

  it.each([null, 12345678, "", "123", "abcdefgh", "01001/000", "010010000", {}, "https://example.com"])("recusa CEP inválido %j antes de consultar o provedor", async (value) => {
    const consultar = vi.fn(); const service = shipping.criarServicoFrete({ consultar });
    await expect(service.cotarFrete(value)).rejects.toMatchObject({ statusCode: 400 });
    expect(consultar).not.toHaveBeenCalled();
  });

  it("cota São Paulo e Rio de Janeiro em níveis diferentes", async () => {
    const consultar = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(response({ latitude: "-22.9012347", longitude: "-43.177436" }, { cep: "20040020" }));
    const service = shipping.criarServicoFrete({ consultar });
    expect(await service.cotarFrete(cep)).toMatchObject({ nivel: 2, valorCentavos: 600, metodo: "linha_reta_entre_ceps" });
    expect(await service.cotarFrete("20040020")).toMatchObject({ nivel: 3, valorCentavos: 900 });
  });

  it("compartilha consultas simultâneas e renova o cache após seis horas", async () => {
    let now = 0; const consultar = vi.fn().mockResolvedValue(response());
    const service = shipping.criarServicoFrete({ consultar, agora: () => now });
    const quotes = await Promise.all([service.cotarFrete(cep), service.cotarFrete(cep)]);
    expect(quotes[0]).toEqual(quotes[1]); expect(consultar).toHaveBeenCalledTimes(1);
    now = 6 * 60 * 60 * 1000 + 1;
    await service.cotarFrete(cep); expect(consultar).toHaveBeenCalledTimes(2);
  });

  it.each([{}, { latitude: null, longitude: null }, { latitude: "", longitude: "" }, { latitude: "NaN", longitude: 0 }, { latitude: 80, longitude: 90 }])("não inventa tarifa quando as coordenadas faltam ou são inválidas: %j", async (coordinates) => {
    const service = shipping.criarServicoFrete({ consultar: vi.fn().mockResolvedValue(response(coordinates)) });
    await expect(service.cotarFrete(cep)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("não guarda falhas no cache e permite nova tentativa", async () => {
    const consultar = vi.fn().mockRejectedValueOnce(new Error("Timeout")).mockResolvedValueOnce(response());
    const service = shipping.criarServicoFrete({ consultar });
    await expect(service.cotarFrete(cep)).rejects.toMatchObject({ statusCode: 503 });
    expect(await service.cotarFrete(cep)).toMatchObject({ nivel: 2 });
  });

  it("recusa CEP inexistente e respostas com outro CEP", async () => {
    const consultar = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce(response(location, { cep: "99999999" }));
    const service = shipping.criarServicoFrete({ consultar });
    await expect(service.cotarFrete(cep)).rejects.toMatchObject({ statusCode: 422 });
    await expect(service.cotarFrete(cep)).rejects.toMatchObject({ statusCode: 422 });
  });
});

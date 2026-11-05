
import { randomBytes } from "node:crypto";

function calcularDigito(base) {
  const pesoInicial = base.length + 1;

  const soma = [...base].reduce(
    (total, digito, indice) =>
      total + Number(digito) * (pesoInicial - indice),
    0
  );

  const resto = (soma * 10) % 11;

  return String(resto === 10 ? 0 : resto);
}

export function gerarCpfTeste() {
  // Nove dígitos pseudoaleatórios, exclusivos para dados fictícios.
  // A unicidade global não é garantida; o banco continua
  // responsável por detectar eventuais colisões.
  const numero = randomBytes(4).readUInt32BE(0) % 1000000000;
  const base = String(numero).padStart(9, "0");

  if (/^(\d)\1{8}$/.test(base)) {
    return gerarCpfTeste();
  }

  const primeiro = calcularDigito(base);
  const segundo = calcularDigito(base + primeiro);

  return base + primeiro + segundo;
}

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { salvarDadosConta } from "../../services/authApi.js";

const estadosBrasil = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"],
  ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
  ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
  ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
  ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"],
  ["RN", "Rio Grande do Norte"], ["RS", "Rio Grande do Sul"],
  ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
];

const enderecoInicial = { pais: "Brasil", estado: "", cep: "", cidade: "", bairro: "", logradouro: "", numero: "", complemento: "" };
const camposEndereco = [["cep", "CEP"], ["pais", "País"], ["estado", "Estado (UF)"], ["cidade", "Município"], ["bairro", "Bairro"], ["logradouro", "Rua"], ["numero", "Número"], ["complemento", "Complemento (opcional)"]];
const classeInput = "mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm disabled:bg-sand";

export default function AddressForm({ onSaved, onCepChange, disabled = false, submitLabel = "Salvar endereço" }) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState(enderecoInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [consulta, setConsulta] = useState("");
  const [buscando, setBuscando] = useState(false);
  const consultaRef = useRef(null);

  useEffect(() => () => consultaRef.current?.abort(), []);

  async function alterarCep(valor) {
    consultaRef.current?.abort();
    consultaRef.current = null;
    const cep = valor.replace(/\D/g, "").slice(0, 8);
    setForm((anterior) => ({ ...anterior, cep, estado: "", cidade: "", bairro: "", logradouro: "" }));
    setConsulta("");
    onCepChange?.(cep);
    setBuscando(false);
    if (cep.length !== 8) return;
    const controller = new AbortController();
    consultaRef.current = controller;
    setBuscando(true);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
      if (!resposta.ok) throw new Error("Consulta indisponível.");
      const dados = await resposta.json();
      if (consultaRef.current !== controller) return;
      if (dados.erro) { setConsulta("CEP não encontrado. Confira o número ou preencha o endereço manualmente."); return; }
      setForm((anterior) => anterior.cep === cep ? { ...anterior, estado: dados.uf || "", cidade: dados.localidade || "", bairro: dados.bairro || "", logradouro: dados.logradouro || "" } : anterior);
      setConsulta("Endereço encontrado. Confira os dados e informe o número e o complemento, se houver.");
    } catch {
      if (consultaRef.current === controller) setConsulta("Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.");
    } finally {
      clearTimeout(timeout);
      if (consultaRef.current === controller) setBuscando(false);
    }
  }

  async function salvar(event) {
    event.preventDefault();
    if (salvando || buscando || disabled) return;
    setErro(""); setSucesso(""); setSalvando(true);
    try {
      const dados = await salvarDadosConta("addresses", accessToken, form);
      setForm(enderecoInicial); setConsulta("");
      onSaved?.(dados.enderecos);
      setSucesso("Endereço salvo na sua conta.");
    } catch (error) { setErro(error.message); }
    finally { setSalvando(false); }
  }

  return (
      <form onSubmit={salvar} className="mt-6 space-y-4">
        <fieldset disabled={salvando || disabled} className="grid gap-4 sm:grid-cols-2">
          {camposEndereco.map(([campo, label]) => <label key={campo} className="block min-w-0 text-sm">{label}
            {campo === "estado" ? (
                <select required value={form.estado} disabled={buscando}
                  onChange={(event) => { setSucesso(""); setForm((anterior) => ({ ...anterior, estado: event.target.value })); }}
                  className={classeInput}>
                  <option value="" disabled>Selecione o estado</option>
                  {estadosBrasil.map(([uf, nome]) => <option key={uf} value={uf}>{nome} ({uf})</option>)}
                </select>
              ) : <input required={campo !== "complemento"} readOnly={campo === "pais"} disabled={buscando && ["estado", "cidade", "bairro", "logradouro"].includes(campo)}
                type="text" value={form[campo]} maxLength={campo === "cep" ? 8 : 200}
                inputMode={campo === "cep" ? "numeric" : "text"}
                pattern={campo === "cep" ? "[0-9]{8}" : undefined}
                onChange={(event) => { setSucesso(""); if (campo === "cep") { void alterarCep(event.target.value); } else { const valor = event.target.value; setForm((anterior) => ({ ...anterior, [campo]: valor })); } }} className={classeInput} />}
          </label>)}
        </fieldset>
        {(buscando || consulta) && <p role="status" className="text-sm text-muted">{buscando ? "Consultando CEP..." : consulta}</p>}
        {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>}
        {sucesso && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{sucesso}</p>}
        <button disabled={salvando || buscando || disabled} className="min-h-11 rounded-xl bg-terracotta px-5 text-sm font-semibold text-white disabled:opacity-60">{salvando ? "Salvando..." : submitLabel}</button>
      </form>
  );
}

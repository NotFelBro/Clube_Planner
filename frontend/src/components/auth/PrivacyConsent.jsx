export default function PrivacyConsent({ checked, onChange, disabled }) {
  return <div className="mt-5 text-xs leading-5 text-muted">
    <label className="flex items-start gap-3">
      <input type="checkbox" name="aceitouPrivacidade" required checked={checked} onChange={onChange} disabled={disabled} className="mt-1 h-4 w-4 shrink-0 accent-terracotta" />
      <span>Li e aceito os termos de privacidade para criar e utilizar minha conta.</span>
    </label>
    <details className="mt-2">
      <summary className="w-fit cursor-pointer font-semibold text-terracotta">Ler os termos de privacidade</summary>
      <div className="mt-2 space-y-2 rounded-lg border border-line bg-white p-3">
        <p>Usamos nome e e-mail para identificar sua conta, enviar a verificação e permitir o acesso. A senha é armazenada como um hash, sem guardar seu texto original.</p>
        <p>Endereços e pedidos são salvos para acompanhar suas compras. Os dados necessários ao pagamento são enviados ao Mercado Pago. O aceite e a data ficam registrados na conta.</p>
        <p>Versão: 13/11/2026.</p>
      </div>
    </details>
  </div>;
}

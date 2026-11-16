import { useState } from "react";

export default function PasswordField({ id, value, onChange, disabled, autoComplete = "current-password", label = "Senha" }) {
  const [visivel, setVisivel] = useState(false);
  return <div>
    <label htmlFor={id} className="mb-2 block text-xs font-medium text-muted">{label}</label>
    <div className="relative">
      <input id={id} name="senha" type={visivel ? "text" : "password"} value={value} onChange={onChange} required disabled={disabled} autoComplete={autoComplete} placeholder="Digite sua senha"
        className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white pl-3 pr-12 text-sm text-slatebrand placeholder:text-muted disabled:opacity-60" />
      <button type="button" disabled={disabled} aria-label={visivel ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visivel} aria-controls={id} onClick={() => setVisivel(valor => !valor)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[10px] text-muted hover:text-terracotta disabled:opacity-60">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visivel && <path d="m3 3 18 18" />}</svg>
      </button>
    </div>
  </div>;
}

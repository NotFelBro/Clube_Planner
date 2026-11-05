
import { Link } from "react-router";

export default function AdminAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1df] px-5 py-12 text-[#3d415f]">
      <section className="w-full max-w-lg rounded-2xl border border-[#e5e1d5] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e6eee8] text-3xl">
          ♙
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold">
          Acesso administrativo protegido
        </h1>

        <p className="mt-4 text-sm leading-7 text-[#81849a]">
          O painel administrativo exige uma sessão
          autenticada e uma autorização de administrador
          validada pelo servidor.
        </p>

        <p className="mt-3 text-sm leading-7 text-[#81849a]">
          Essa verificação ainda não está integrada.
          Por segurança, o acesso operacional permanece
          indisponível.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/perfil"
            className="rounded-xl bg-[#e67e63] px-6 py-3 text-sm font-semibold text-white"
          >
            Voltar à minha conta
          </Link>

          <Link
            to="/loja"
            className="rounded-xl border border-[#e5e1d5] px-6 py-3 text-sm font-semibold"
          >
            Ir para a loja
          </Link>
        </div>
      </section>
    </main>
  );
}

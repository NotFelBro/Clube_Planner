
import { useState } from "react";
import { Link } from "react-router";

function PlannerIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[250px] w-[300px] max-w-full rounded-[22px] bg-[#e8f1e8]"
    >
      <div className="absolute left-10 top-[30px] h-[180px] w-[130px] rounded-xl bg-white shadow-sm">
        <div className="mx-[18px] mt-5 h-[6px] rounded bg-terracotta" />
        <div className="ml-[18px] mt-[14px] h-1 w-[70px] rounded bg-[#e6e2d4]" />
        <div className="ml-[18px] mt-3 h-1 w-[82px] rounded bg-[#e6e2d4]" />
        <div className="mx-[18px] mt-6 h-[60px] rounded-lg bg-[#fae7de]" />
      </div>
      <div className="absolute left-[190px] top-[60px] h-[145px] w-[65px] rounded-[10px] bg-terracotta shadow-sm" />
    </div>
  );
}

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setNotice(
      "A autenticação estará disponível após a integração com o backend. Por enquanto, você pode explorar a loja como visitante."
    );
  }

  return (
    <main className="grid min-h-screen bg-sand text-slatebrand lg:grid-cols-[43.0556%_56.9444%]">
      <aside className="flex flex-col bg-slatebrand px-6 py-8 text-sand sm:px-12 lg:min-h-screen lg:px-16">
        <Link
          to="/"
          aria-label="Clube Planner — início"
          className="inline-flex w-fit items-center gap-2 font-display text-xl font-semibold tracking-wide"
        >
          CLUBE <span className="text-sage">PLANNER</span>
        </Link>

        <div className="mx-auto flex w-full max-w-[490px] flex-1 flex-col justify-center py-12 lg:py-8">
          <span className="mb-8 w-fit rounded-full bg-sage px-4 py-2 text-[11px] font-semibold tracking-wide text-slatebrand">
            BEM-VINDA(O) DE VOLTA
          </span>

          <h1 className="font-display text-3xl font-semibold leading-[1.45] sm:text-4xl">
            Seu próximo capítulo
            <span className="block">começa por aqui.</span>
          </h1>

          <p className="mt-8 max-w-[450px] text-[15px] leading-7">
            Entre para acompanhar seus pedidos, salvar favoritos e organizar
            suas ideias.
          </p>

          <div className="mt-14 hidden sm:block">
            <PlannerIllustration />
          </div>
        </div>

        <p className="text-sm font-medium">
          Papelaria feita pra quem organiza a vida.
        </p>
      </aside>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-12">
        <div className="w-full max-w-[600px]">
          <h2 className="font-display text-[30px] font-semibold">
            Acesse sua conta
          </h2>

          <p className="mt-2 text-sm text-muted">
            Que bom ter você por aqui. Vamos continuar?
          </p>

          <div className="mt-12 flex gap-9 border-b border-[#e6e2d4]">
            <span className="border-b-[3px] border-terracotta pb-3 text-base font-semibold">
              Entrar
            </span>

            <Link
              to="/cadastro"
              className="pb-3 text-base font-medium text-muted transition hover:text-terracotta"
            >
              Criar conta
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <div>
              <label
                htmlFor="login-identifier"
                className="mb-2 block text-xs font-medium text-muted"
              >
                E-mail ou CPF
              </label>

              <input
                id="login-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Digite seu e-mail ou CPF"
                required
                className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand placeholder:text-muted"
              />
            </div>

            <div className="mt-3">
              <label
                htmlFor="login-password"
                className="mb-2 block text-xs font-medium text-muted"
              >
                Senha
              </label>

              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
                className="h-[46px] w-full rounded-[10px] border-[1.5px] border-[#b8b2a6] bg-white px-3 text-sm text-slatebrand placeholder:text-muted"
              />
            </div>

            <div className="mt-2 text-right">
              <span
                title="Recuperação de senha disponível após a integração do backend"
                className="text-xs font-semibold text-terracotta"
              >
                Esqueci minha senha
              </span>
            </div>

            <button
              type="submit"
              className="mt-6 h-[46px] w-full rounded-[11px] bg-terracotta px-4 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Entrar na minha conta
            </button>

            {notice && (
              <p
                role="status"
                className="mt-4 rounded-lg border border-sage bg-[#e8f1e8] p-3 text-sm text-slatebrand"
              >
                {notice}
              </p>
            )}
          </form>

          <p className="mt-6 text-xs text-muted">
            ou continue sua visita
          </p>

          <Link
            to="/loja"
            className="mt-3 flex h-[46px] w-full items-center justify-center rounded-[11px] border border-[#b8b2a6] bg-white px-4 text-center text-sm font-semibold text-slatebrand transition hover:bg-softsage"
          >
            Continuar explorando a loja
          </Link>

          <p className="mt-8 text-[13px] text-muted">
            Ainda não tem cadastro?{" "}
            <Link
              to="/cadastro"
              className="font-semibold text-terracotta hover:underline"
            >
              Criar minha conta
            </Link>
          </p>

          <div className="mt-11 rounded-xl bg-[#e8f1e8] px-5 py-4">
            <p className="text-[13px] font-semibold text-[#2d6a4f]">
              Compra segura
            </p>
            <p className="mt-2 text-xs text-[#2b2d3f]">
              Seus dados são tratados com cuidado e privacidade.
            </p>
          </div>

          <p className="mt-16 text-[11px] leading-5 text-muted">
            Ao continuar, você concorda com os Termos de Uso e a Política de
            Privacidade.
          </p>
        </div>
      </section>
    </main>
  );
}

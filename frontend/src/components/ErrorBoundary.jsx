import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return <main className={`flex ${this.props.compact ? "min-h-[55vh]" : "min-h-screen"} items-center justify-center bg-sand px-5 text-slatebrand`}>
      <section role="alert" className="max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">{this.props.compact ? "Não foi possível abrir esta seção" : "Não foi possível abrir esta página"}</h1>
        <p className="mt-4 text-sm text-muted">{this.props.compact ? "Use o menu para abrir outra seção ou recarregue a página. Se uma operação estava em andamento, confira o registro antes de repeti-la." : "Tente recarregar a página. Se você estava confirmando uma compra, consulte seus pedidos antes de tentar novamente."}</p>
        <button onClick={() => window.location.reload()} className="mt-6 min-h-11 rounded-xl bg-terracotta px-5 font-semibold text-white">Recarregar página</button>
        <a href="/loja" className="mt-4 block text-sm text-terracotta underline">Voltar para a loja</a>
      </section>
    </main>;
  }
}


import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../contexts/AuthContext.jsx";

export default function ProtectedRoute() {
  const { autenticado, carregando } = useAuth();
  const location = useLocation();

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sand px-5 text-slatebrand">
        <p role="status" className="text-sm text-muted">
          Verificando sua sessão...
        </p>
      </main>
    );
  }

  if (!autenticado) {
    return (
      <Navigate
        to="/"
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
        replace
      />
    );
  }

  return <Outlet />;
}

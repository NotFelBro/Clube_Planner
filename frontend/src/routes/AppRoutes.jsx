import {
  Navigate,
  Route,
  Routes,
  useSearchParams,
} from "react-router";

// Layout da loja
import StoreLayout from "../components/layout/StoreLayout.jsx";
import ProtectedRoute from "../components/auth/ProtectedRoute.jsx";

// Layout e proteção administrativa
import AdminLayout from "../components/admin/AdminLayout.jsx";
import AdminAccess from "../components/admin/AdminAccess.jsx";

// Páginas da loja
import Home from "../pages/store/Home.jsx";
import ProductDetail from "../pages/store/ProductDetail.jsx";
import ProductFeedbacks from "../pages/store/ProductFeedbacks.jsx";
import ShoppingCart from "../pages/store/ShoppingCart.jsx";
import Checkout from "../pages/store/Checkout.jsx";
import OrderDetails from "../pages/store/OrderDetails.jsx";
import Colecoes from "../pages/store/Colecoes.jsx";
import ComingSoon from "../pages/store/ComingSoon.jsx";

// Autenticação
import Login from "../pages/auth/Login.jsx";
import Cadastro from "../pages/auth/Cadastro.jsx";
import VerificarEmail from "../pages/auth/VerificarEmail.jsx";

// Perfil do cliente
import MyProfile, {
  FavoritesPage,
} from "../pages/account/MyProfile.jsx";

// Páginas administrativas
import AdminSection from "../pages/admin/AdminSection.jsx";

// Redirecionamento específico de Papelaria Criativa
function CollectionsRoute() {
  const [params] = useSearchParams();

  if (params.get("categoria") === "papelaria") {
    return (
      <Navigate
        to="/loja?categoria=papelaria"
        replace
      />
    );
  }

  return <Colecoes />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* =====================================
          AUTENTICAÇÃO
      ===================================== */}

      <Route
        path="/"
        element={<Login />}
      />

      <Route
        path="/login"
        element={<Navigate to="/" replace />}
      />

      <Route
        path="/cadastro"
        element={<Cadastro />}
      />

      <Route
        path="/verificar-email"
        element={<VerificarEmail />}
      />

      {/* =====================================
          PAINEL ADMINISTRATIVO - DEMONSTRAÇÃO
      ===================================== */}

      <Route
        path="/admin-demo"
        element={<AdminLayout preview />}
      >
        <Route
          index
          element={
            <AdminSection section="dashboard" />
          }
        />

        <Route
          path="produtos"
          element={
            <AdminSection section="produtos" />
          }
        />

        <Route
          path="categorias"
          element={
            <AdminSection section="categorias" />
          }
        />

        <Route
          path="pedidos"
          element={
            <AdminSection section="pedidos" />
          }
        />

        <Route
          path="vendas"
          element={
            <AdminSection section="vendas" />
          }
        />

        <Route
          path="clientes"
          element={
            <AdminSection section="clientes" />
          }
        />

        <Route
          path="relatorios"
          element={
            <AdminSection section="relatorios" />
          }
        />

        <Route
          path="configuracoes"
          element={
            <AdminSection section="configuracoes" />
          }
        />
      </Route>

      {/* =====================================
          ADMINISTRATIVO - ACESSO PROTEGIDO
      ===================================== */}

      <Route
        path="/admin"
        element={<AdminAccess />}
      />

      <Route
        path="/admin/*"
        element={<AdminAccess />}
      />

      {/* =====================================
          LOJA E PERFIL
      ===================================== */}

      <Route element={<StoreLayout />}>
        {/* Página principal */}

        <Route
          path="/loja"
          element={<Home />}
        />

        {/* Produtos */}

        <Route
          path="/produto/:id"
          element={<ProductDetail />}
        />

        <Route
          path="/produto/:id/feedbacks"
          element={<ProductFeedbacks />}
        />

        {/* Sacola e checkout */}

        <Route
          path="/sacola"
          element={<ShoppingCart />}
        />

        <Route
          path="/checkout"
          element={<Checkout />}
        />

        {/* Coleções */}

        <Route
          path="/colecoes"
          element={<CollectionsRoute />}
        />

        {/* Papelaria Criativa */}

        <Route
          path="/papelaria-criativa"
          element={
            <Navigate
              to="/loja?categoria=papelaria"
              replace
            />
          }
        />

        {/* Organização */}

        <Route
          path="/organizacao"
          element={
            <Navigate
              to="/colecoes?categoria=organizacao"
              replace
            />
          }
        />

        {/* Novidades */}

        <Route
          path="/novidades"
          element={<ComingSoon />}
        />

        {/* =====================================
            ROTAS PRIVADAS DO CLIENTE
        ===================================== */}

        <Route element={<ProtectedRoute />}>
          {/* Detalhes dos pedidos */}

          <Route
            path="/perfil/pedidos/:id"
            element={<OrderDetails />}
          />

          {/* Minha conta */}

          <Route
            path="/perfil"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/pedidos"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/andamento"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/enderecos"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/dados"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/cargo"
            element={<MyProfile />}
          />

          <Route
            path="/perfil/seguranca"
            element={<MyProfile />}
          />

          {/* Acesso ao painel administrativo */}

          <Route
            path="/perfil/administrativo"
            element={
              <Navigate
                to="/admin"
                replace
              />
            }
          />

          {/* Favoritos */}

          <Route
            path="/favoritos"
            element={<FavoritesPage />}
          />
        </Route>
      </Route>

      {/* =====================================
          ROTA NÃO ENCONTRADA
      ===================================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/loja"
            replace
          />
        }
      />
    </Routes>
  );
}
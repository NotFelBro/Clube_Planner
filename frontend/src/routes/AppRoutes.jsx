import {
  Navigate,
  Route,
  Routes,
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

// Autenticação
import RecuperarSenha from "../pages/auth/RecuperarSenha.jsx";
import ConfirmarAlteracaoEmail from "../pages/auth/ConfirmarAlteracaoEmail.jsx";
import Login from "../pages/auth/Login.jsx";
import VerificarEmail from "../pages/auth/VerificarEmail.jsx";
import ConfirmarEmail from "../pages/auth/ConfirmarEmail.jsx";

// Perfil do cliente
import MyProfile from "../pages/account/MyProfile.jsx";

// Páginas administrativas
import AdminSection from "../pages/admin/AdminSection.jsx";
import ProductCatalog from "../pages/admin/ProductCatalog.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/confirmar-alteracao-email" element={<ConfirmarAlteracaoEmail />} />
      <Route path="/recuperar-senha" element={<RecuperarSenha key="solicitar" />} />
      <Route path="/redefinir-senha" element={<RecuperarSenha key="redefinir" redefinir />} />
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
        element={<Login initialMode="cadastro" />}
      />

      <Route
        path="/verificar-email"
        element={<VerificarEmail />}
      />

      <Route
  path="/confirmar-email"
  element={<ConfirmarEmail />}
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

        <Route path="relatorios" element={<Navigate to="/admin-demo" replace />} />

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

      <Route path="/admin" element={<AdminAccess />}>
        <Route index element={<AdminSection section="dashboard" />} />
        <Route path="produtos" element={<ProductCatalog />} />
        <Route path="categorias" element={<ProductCatalog categoriesOnly />} />
        <Route path="relatorios" element={<Navigate to="/admin" replace />} />
        <Route path=":section" element={<AdminSection />} />
      </Route>

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
          element={<Colecoes />}
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
            path="/perfil/andamento"
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

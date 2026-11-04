
import { Navigate, Route, Routes } from "react-router";

import StoreLayout from "../components/layout/StoreLayout.jsx";

import Home from "../pages/store/Home.jsx";
import ProductDetail from "../pages/store/ProductDetail.jsx";
import ComingSoon from "../pages/store/ComingSoon.jsx";

import Login from "../pages/auth/Login.jsx";
import Cadastro from "../pages/auth/Cadastro.jsx";

import MyProfile from "../pages/account/MyProfile.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      <Route
        path="/login"
        element={<Navigate to="/" replace />}
      />

      <Route
        path="/cadastro"
        element={<Cadastro />}
      />

      <Route element={<StoreLayout />}>
        <Route
          path="/loja"
          element={<Home />}
        />

        <Route
          path="/produto/:id"
          element={<ProductDetail />}
        />

        <Route
          path="/perfil"
          element={<MyProfile />}
        />

        <Route
          path="/perfil/pedidos"
          element={<ComingSoon />}
        />

        <Route
          path="/perfil/enderecos"
          element={<ComingSoon />}
        />

        <Route
          path="/perfil/dados"
          element={<ComingSoon />}
        />

        <Route
          path="/perfil/cargo"
          element={<ComingSoon />}
        />

        <Route
          path="/perfil/seguranca"
          element={<ComingSoon />}
        />

        <Route
          path="/perfil/administrativo"
          element={<ComingSoon />}
        />

        <Route
          path="/colecoes"
          element={<ComingSoon />}
        />

        <Route
          path="/novidades"
          element={<ComingSoon />}
        />

        <Route
          path="/favoritos"
          element={<ComingSoon />}
        />

        <Route
          path="/sacola"
          element={<ComingSoon />}
        />
      </Route>

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

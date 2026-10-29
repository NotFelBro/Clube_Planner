
import { Routes, Route } from "react-router";

import Home from "../pages/store/Home.jsx";
import Login from "../pages/auth/Login.jsx";
import Cadastro from "../pages/auth/Cadastro.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />
    </Routes>
  );
}

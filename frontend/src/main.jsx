
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router";

import ErrorBoundary from "./components/ErrorBoundary.jsx";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

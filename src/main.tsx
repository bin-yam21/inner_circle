import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { EntitlementProvider } from "./lib/entitlement";
import "./styles/base.css";
import "./styles/app.css";
import "./styles/extra.css";
import "./styles/theme.css";
import "./styles/brand.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <EntitlementProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </EntitlementProvider>
    </AuthProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

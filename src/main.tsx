import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { preloadCriticalRoutes } from "@/lib/utils/deviceCompat";

if (import.meta.env.DEV) {
  void import("./lib/utils/verificarEstudiante");
}

/** Red lenta en tablet: aviso si falla un chunk lazy. */
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "");
  if (!/dynamically imported module|importing a module script failed/i.test(msg)) return;
  event.preventDefault();
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.style.cssText =
    "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.5rem;background:rgba(15,23,42,0.92);color:#f8fafc;font-family:system-ui,sans-serif;text-align:center";
  banner.innerHTML =
    '<div><p style="font-size:1.125rem;font-weight:600;margin:0 0 0.75rem">No se pudo cargar la pantalla</p>' +
    '<p style="margin:0 0 1rem;opacity:0.85;font-size:0.9rem">Compruebe la conexión WiFi del colegio y recargue.</p>' +
    '<button type="button" style="padding:0.5rem 1.25rem;border-radius:0.5rem;border:none;background:#2563eb;color:#fff;font-size:1rem">Recargar</button></div>';
  banner.querySelector("button")?.addEventListener("click", () => window.location.reload());
  document.body.appendChild(banner);
});

preloadCriticalRoutes();

createRoot(document.getElementById("root")!).render(<App />);

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import { I18nProvider } from "./i18n/I18nProvider"
import "./index.css"

// The service worker caches the app so it also works offline. Only in a real build: in development
// it would serve stale files.
if (import.meta.env.PROD&&"serviceWorker" in navigator) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}))
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)

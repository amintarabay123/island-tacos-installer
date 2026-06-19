import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth";
import App from "./App";
import "./index.css";

// Route all generated API hooks to cedar-api instead of the shared api-server
setBaseUrl("/cedar-api");

// Wire up localStorage token so all API hooks send Authorization: Bearer
setAuthTokenGetter(() => getAuthToken());

// Rewrite raw fetch() calls so they also go to cedar-api.
// Problem: every raw fetch uses BASE_URL (/cedar/) as prefix → /cedar/api/...
// or a bare /api/... — both route to Island Tacos api-server via the shared proxy.
// This interceptor rewrites them all to /cedar-api/api/... before they leave the browser.
const _origFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = function cedarFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof input === "string") {
    if (input.startsWith("/api/") || input === "/api") {
      input = "/cedar-api" + input;
    } else if (input.startsWith("/cedar/api/") || input === "/cedar/api") {
      input = "/cedar-api/api/" + input.slice("/cedar/api/".length);
    }
  }
  return _origFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

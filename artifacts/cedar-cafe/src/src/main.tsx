import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth";
import App from "./App";
import "./index.css";

// Redirect all generated API hooks from /api/... to /cedar-api/api/... so
// the shared Replit proxy routes them to cedar-api (port 8181) rather than
// the Island Tacos api-server.
setBaseUrl("/cedar-api");

// Wire up localStorage token so all API hooks send Authorization: Bearer
setAuthTokenGetter(() => getAuthToken());

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

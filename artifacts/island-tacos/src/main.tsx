import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getAuthToken } from "@/lib/auth";
import App from "./App";
import "./index.css";

// Wire up localStorage token so all API hooks send Authorization: Bearer
setAuthTokenGetter(() => getAuthToken());

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

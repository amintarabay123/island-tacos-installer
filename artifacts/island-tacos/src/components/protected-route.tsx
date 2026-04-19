import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { authHeaders } from "@/lib/auth";

type Props = { children: React.ReactNode };

export default function ProtectedRoute({ children }: Props) {
  const [status, setStatus] = useState<"loading" | "authed" | "unauthed">("loading");
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store", headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.authed) {
          setStatus("authed");
        } else {
          setStatus("unauthed");
          navigate(adminRoutes.login);
        }
      })
      .catch(() => {
        setStatus("unauthed");
        navigate(adminRoutes.login);
      });
  }, [navigate]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthed") return null;

  return <>{children}</>;
}

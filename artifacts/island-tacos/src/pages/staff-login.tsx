import { useState } from "react";
import { useLocation } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { saveAuthToken } from "@/lib/auth";

export default function StaffLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleKey = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
    setError("");
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.token) saveAuthToken(data.token);
        navigate(data.role === "staff" ? adminRoutes.kitchen : adminRoutes.dashboard);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Incorrect PIN");
        setPin("");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-1">
        <div className="text-2xl font-black text-white tracking-tight">Island Tacos</div>
        <div className="text-zinc-500 text-sm">Staff access</div>
      </div>

      {/* PIN dots */}
      <div className="flex gap-3">
        {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              i < pin.length ? "bg-white border-white" : "bg-transparent border-zinc-600"
            }`}
          />
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-sm font-medium text-center">{error}</div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {keys.map((key, i) => {
          if (key === "") return <div key={i} />;
          if (key === "⌫") {
            return (
              <button
                key={i}
                onPointerDown={handleDelete}
                className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-xl font-medium transition-colors flex items-center justify-center"
              >
                {key}
              </button>
            );
          }
          return (
            <button
              key={i}
              onPointerDown={() => handleKey(key)}
              className="h-16 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-white text-2xl font-semibold transition-colors"
            >
              {key}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pin.length === 0 || loading}
        className="w-full max-w-xs h-14 rounded-2xl bg-white text-zinc-950 text-base font-bold transition-all hover:bg-zinc-200 active:bg-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {loading ? "Verifying…" : "Enter"}
      </button>
    </div>
  );
}

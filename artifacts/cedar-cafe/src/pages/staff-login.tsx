import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { adminRoutes } from "@/lib/admin-path";
import { saveAuthToken } from "@/lib/auth";
import { useStoreSettings } from "@/lib/use-store-settings";

const CC = {
  bg:     "#0c0805",
  surface:"#171009",
  bord:   "#4a3020",
  chalk:  "#F5ECD7",
  muted:  "#9e8570",
  accent: "#C8A882",
  hunter: "#2d6a4f",
  hunterLt:"#3d8f6a",
  red:    "#d4614a",
};

export default function StaffLogin() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const search = useSearch();
  const redirectTo = new URLSearchParams(search).get("redirect");
  const { storeName } = useStoreSettings();

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
        const staffRoutes = [adminRoutes.kitchen, adminRoutes.pos];
        if (data.role === "staff") {
          navigate(redirectTo && staffRoutes.includes(redirectTo) ? redirectTo : adminRoutes.pos);
        } else {
          navigate(redirectTo ?? adminRoutes.dashboard);
        }
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
    <div style={{
      minHeight: "100dvh", background: CC.bg,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 24, padding: "32px 16px",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lato:wght@300;400;700&display=swap');`}</style>

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontStyle: "italic",
          fontSize: 26, color: CC.chalk, letterSpacing: "-0.01em", marginBottom: 4,
        }}>
          {storeName}
        </div>
        <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: CC.muted, letterSpacing: 1 }}>
          STAFF ACCESS
        </div>
      </div>

      {/* PIN dots */}
      <div style={{ display: "flex", gap: 12 }}>
        {Array.from({ length: Math.max(4, pin.length || 4) }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: "50%",
            border: `2px solid ${i < pin.length ? CC.accent : CC.bord}`,
            background: i < pin.length ? CC.accent : "transparent",
            transition: "all 0.15s",
            boxShadow: i < pin.length ? `0 0 8px ${CC.accent}88` : "none",
          }} />
        ))}
      </div>

      {error && (
        <div style={{ fontFamily: "'Lato', sans-serif", color: CC.red, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
          {error}
        </div>
      )}

      {/* Keypad */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, width: "100%", maxWidth: 280 }}>
        {keys.map((key, i) => {
          if (key === "") return <div key={i} />;
          return (
            <button
              key={i}
              onPointerDown={key === "⌫" ? handleDelete : () => handleKey(key)}
              style={{
                height: 64, borderRadius: 14,
                background: "linear-gradient(145deg, #2a1c12, #1c1008)",
                border: `1px solid ${CC.bord}`,
                color: CC.chalk,
                fontSize: key === "⌫" ? 20 : 22,
                fontWeight: 600,
                fontFamily: "'Lato', sans-serif",
                cursor: "pointer",
                transition: "transform 0.1s, background 0.1s",
                boxShadow: "0 4px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {key === "⌫" ? "⌫" : key}
            </button>
          );
        })}
      </div>

      <button
        onClick={handleSubmit}
        disabled={pin.length === 0 || loading}
        style={{
          width: "100%", maxWidth: 280, height: 52, borderRadius: 14,
          background: pin.length > 0 && !loading
            ? `linear-gradient(135deg, ${CC.hunter}, ${CC.hunterLt})`
            : "rgba(255,255,255,0.06)",
          border: "none",
          color: pin.length > 0 && !loading ? "#fff" : CC.muted,
          fontSize: 15, fontWeight: 700,
          fontFamily: "'Lato', sans-serif",
          cursor: pin.length > 0 && !loading ? "pointer" : "not-allowed",
          transition: "all 0.2s",
          boxShadow: pin.length > 0 && !loading ? `0 4px 18px rgba(45,106,79,0.4)` : "none",
        }}
      >
        {loading ? "Verifying…" : "Enter"}
      </button>

      <button
        onClick={() => navigate("/")}
        style={{
          fontFamily: "'Lato', sans-serif", fontSize: 13,
          color: CC.muted, background: "none", border: "none",
          cursor: "pointer", transition: "color 0.2s",
        }}
      >
        ← Back to menu
      </button>
    </div>
  );
}

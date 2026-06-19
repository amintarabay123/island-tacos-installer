import { useState, useMemo, useEffect } from "react";
import { useListMenuCategories, useListMenuItems } from "@workspace/api-client-react";
import { useCart, type ModifierSelection } from "@/lib/cart-context";
import { Layout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowRight, Clock, MapPin, Plus, Minus, Loader2 } from "lucide-react";
import heroCoffeeUrl from "@assets/image_1781895079381.png";

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  position: number;
  allowMultiple?: boolean;
  maxQuantity?: number;
}

interface ModifierGroup {
  id: number;
  loyverseId: string;
  name: string;
  options: ModifierOption[];
  required: boolean;
  minSelections: number;
  maxSelections: number | null;
}

// ─── Chalkboard palette (warm dark coffee-shop) ────────────────────────────────
const CC_BG     = "#0d1612";
const CC_CARD   = "linear-gradient(145deg, #1a2e22 0%, #0f1d15 100%)";
const CC_BORD   = "rgba(100,200,130,0.2)";
const CC_CHALK  = "#e8f5ed";
const CC_MUTED  = "#5a8a6a";
const CC_ACCENT = "#10b981";
const CC_HUNTER = "#2d6a4f";
const CC_HUNT_L = "#3d8f6a";

// Per-item accent colours (cedar green tones cycling)
const CARD_COLORS = [
  { accent: CC_ACCENT, glow: "rgba(16,185,129,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1a3828,#0f2218)" },
  { accent: CC_HUNT_L, glow: "rgba(61,143,106,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1f4d38,#0f2a1e)" },
  { accent: "#34d399",  glow: "rgba(52,211,153,0.25)", border: CC_BORD, grad: "linear-gradient(145deg,#163a28,#0a2018)" },
  { accent: CC_HUNT_L, glow: "rgba(61,143,106,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1f4d38,#0f2a1e)" },
  { accent: CC_ACCENT, glow: "rgba(16,185,129,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1a3828,#0f2218)" },
  { accent: "#34d399",  glow: "rgba(52,211,153,0.25)", border: CC_BORD, grad: "linear-gradient(145deg,#163a28,#0a2018)" },
  { accent: CC_HUNT_L, glow: "rgba(61,143,106,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1f4d38,#0f2a1e)" },
  { accent: CC_ACCENT, glow: "rgba(16,185,129,0.25)",  border: CC_BORD, grad: "linear-gradient(145deg,#1a3828,#0f2218)" },
];

function extractEmoji(name: string): string {
  const m = name.match(/\p{Extended_Pictographic}/u);
  return m ? m[0] : "";
}

export default function Home() {
  const { data: categories, isLoading: loadingCategories } = useListMenuCategories();
  const { data: items, isLoading: loadingItems } = useListMenuItems();

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, Record<string, number>>>({});
  const [loadingModifiers, setLoadingModifiers] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
  const handleImgError = (id: number) => setBrokenImages(prev => new Set(prev).add(id));

  const { addItem } = useCart();

  const filteredItems = useMemo(() => {
    if (!items) return [];
    const visible = items.filter(item => !(item as { openPrice?: boolean }).openPrice);
    if (activeCategory === null) return visible;
    return visible.filter(item => item.categoryId === activeCategory);
  }, [items, activeCategory]);

  const [storeOpen, setStoreOpen] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [storeOpenTime, setStoreOpenTime] = useState("11:00 AM");
  const [storeCloseOrdersAt, setStoreCloseOrdersAt] = useState("6:45 PM");
  const [closedTodayReason, setClosedTodayReason] = useState<string | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/settings`)
      .then(r => r.json())
      .then((d: Record<string, string>) => {
        setStoreOpen(d.is_open !== "false");
        setOpenToday(d.open_today !== "false");
        setClosedTodayReason(d.closed_today_reason ?? null);
        const fmt = (hhmm: string) => {
          const [h, m] = hhmm.split(":").map(Number);
          const ampm = h >= 12 ? "PM" : "AM";
          return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
        };
        setStoreOpenTime(fmt(d.open_time ?? "11:00"));
        setStoreCloseOrdersAt(fmt(d.closes_orders_at ?? "18:45"));
      })
      .catch(() => {});
  }, []);

  const [topSellers, setTopSellers] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/menu/popular?limit=5")
      .then((r) => r.ok ? r.json() : null)
      .then((data: any[] | null) => { if (data) setTopSellers(data); })
      .catch(() => {});
  }, []);

  const popularItems = useMemo(() => {
    const notOpenPrice = (it: { openPrice?: boolean }) => !it.openPrice;
    if (topSellers && topSellers.length > 0) return topSellers.filter(notOpenPrice);
    if (!items) return [];
    return items.filter(item => item.popular && item.available !== false && notOpenPrice(item as { openPrice?: boolean })).slice(0, 5);
  }, [topSellers, items]);

  const extraPrice = useMemo(() => {
    let extra = 0;
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.loyverseId];
      if (!selected) continue;
      for (const option of group.options) {
        const qty = selected[option.id] ?? 0;
        if (qty > 0) extra += option.price * qty;
      }
    }
    return extra;
  }, [modifierGroups, selectedModifiers]);

  const totalSelectionsForGroup = (groupId: string) => {
    const sel = selectedModifiers[groupId];
    if (!sel) return 0;
    return Object.values(sel).reduce((s, q) => s + q, 0);
  };

  const changeModifierQty = (group: ModifierGroup, optionId: string, delta: number) => {
    setSelectedModifiers(prev => {
      const current = { ...(prev[group.loyverseId] ?? {}) };
      const opt = group.options.find(o => o.id === optionId);
      const maxQty = (opt?.allowMultiple ? (opt?.maxQuantity ?? 1) : 1);
      const totalOther = Object.entries(current).filter(([k]) => k !== optionId).reduce((s, [, v]) => s + v, 0);
      const newQty = Math.max(0, Math.min(maxQty, (current[optionId] ?? 0) + delta));
      if (delta > 0 && group.maxSelections !== null && totalOther + newQty > group.maxSelections) return prev;
      if (newQty === 0) { delete current[optionId]; } else { current[optionId] = newQty; }
      return { ...prev, [group.loyverseId]: current };
    });
  };

  const modifierValidationError = useMemo(() => {
    for (const group of modifierGroups) {
      const total = totalSelectionsForGroup(group.loyverseId);
      if (group.required && total === 0) return `Please make a selection for "${group.name}"`;
      if (group.minSelections > 0 && total < group.minSelections)
        return `"${group.name}" requires at least ${group.minSelections} selection${group.minSelections > 1 ? "s" : ""}`;
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifierGroups, selectedModifiers]);

  const handleAddToCart = () => {
    if (!selectedItem) return;
    if (modifierValidationError) return;
    const modifierSelections: ModifierSelection[] = [];
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.loyverseId];
      if (!selected) continue;
      for (const option of group.options) {
        const qty = selected[option.id] ?? 0;
        if (qty <= 0) continue;
        for (let i = 0; i < qty; i++) {
          modifierSelections.push({ modifierId: group.loyverseId, optionId: option.id, name: option.name, price: option.price });
        }
      }
    }
    addItem(selectedItem, quantity, notes || undefined, modifierSelections.length > 0 ? modifierSelections : undefined);
    setSelectedItem(null);
    setQuantity(1);
    setNotes("");
    setModifierGroups([]);
    setSelectedModifiers({});
    setShowNotes(false);
  };

  const openItemModal = async (item: any) => {
    if (item.available === false) return;
    setBrokenImages(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    setSelectedItem(item);
    setQuantity(1);
    setNotes("");
    setModifierGroups([]);
    setSelectedModifiers({});
    setShowNotes(false);
    setLoadingModifiers(true);
    try {
      const res = await fetch(`/api/menu/items/${item.id}/modifiers`);
      if (res.ok) {
        const mods: ModifierGroup[] = await res.json();
        setModifierGroups(mods);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingModifiers(false);
    }
  };

  const visibleCategories = useMemo(() => {
    if (!categories) return [];
    if (!items) return categories;
    const catIdsWithItems = new Set(
      items
        .filter(i => i.available !== false && !(i as { openPrice?: boolean }).openPrice)
        .map(i => i.categoryId),
    );
    return categories.filter(c => catIdsWithItems.has(c.id));
  }, [categories, items]);

  const allCategories = [{ id: null, name: "All" }, ...visibleCategories.slice().sort((a, b) => a.sortOrder - b.sortOrder)];

  // ─── Shared card renderer ────────────────────────────────────────────────────
  const renderCard = (item: any, idx?: number) => {
    const soldOut = item.available === false;
    const colors = CARD_COLORS[item.id % CARD_COLORS.length];
    const emoji = extractEmoji(item.name);
    const hasImage = item.imageUrl && !brokenImages.has(item.id);

    return (
      <div key={item.id} style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* ── Card — gradient body with image floating inside ── */}
        <div
          style={{
            background: soldOut ? "rgba(30,31,56,0.8)" : colors.grad,
            borderRadius: 20,
            border: `1px solid ${soldOut ? "rgba(255,255,255,0.06)" : colors.border}`,
            boxShadow: soldOut ? "none" : `0 8px 28px ${colors.glow}`,
            cursor: soldOut ? "not-allowed" : "pointer",
            display: "flex", flexDirection: "column",
            flex: 1,
            opacity: soldOut ? 0.65 : 1,
            position: "relative",
            overflow: "hidden",
          }}
          onClick={() => { if (!soldOut) openItemModal(item); }}
        >
          {/* Shine overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(150deg, rgba(255,255,255,0.14) 0%, transparent 55%)",
            pointerEvents: "none",
            zIndex: 0,
          }} />

          {/* ── Image floats inside, top-right, with glow ── */}
          {(hasImage || emoji) && (
            <div style={{
              position: "absolute", top: 14, right: 14, zIndex: 2,
              pointerEvents: "none",
            }}>
              {hasImage ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  onError={() => handleImgError(item.id)}
                  style={{
                    width: 92, height: 92,
                    borderRadius: 18,
                    objectFit: "cover",
                    display: "block",
                    transform: "rotate(-10deg) scale(1.08)",
                    filter: [
                      "drop-shadow(0 20px 16px rgba(0,0,0,0.55))",
                      "drop-shadow(0 8px 10px rgba(0,0,0,0.35))",
                      `drop-shadow(0 0 20px ${colors.glow})`,
                    ].join(" "),
                  }}
                />
              ) : (
                <span style={{
                  fontSize: 64, lineHeight: 1, display: "block",
                  transform: "rotate(-10deg) scale(1.05)",
                  filter: [
                    "drop-shadow(0 16px 12px rgba(0,0,0,0.45))",
                    "drop-shadow(0 5px 6px rgba(0,0,0,0.28))",
                    `drop-shadow(0 0 18px ${colors.glow})`,
                  ].join(" "),
                }}>{emoji}</span>
              )}
            </div>
          )}

          {/* Card content — top padding clears the image; min-height ensures uniform size */}
          <div style={{
            padding: "116px 14px 14px",
            display: "flex", flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 240,
            flex: 1,
            position: "relative",
            zIndex: 1,
          }}>

            {/* Top section: badges + name + description */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                {idx !== undefined && (
                  <span style={{ background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>
                    {idx === 0 ? "🔥 #1" : `#${idx + 1}`}
                  </span>
                )}
                {idx === undefined && item.popular && !soldOut && (
                  <span style={{ background: "rgba(0,0,0,0.22)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>POPULAR</span>
                )}
                {item.spicy && !soldOut && (
                  <span style={{ background: "rgba(0,0,0,0.22)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#fff", letterSpacing: "0.05em" }}>SPICY 🌶</span>
                )}
                {item.vegetarian && !soldOut && (
                  <span style={{ background: "rgba(0,0,0,0.22)", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, color: "#4ade80", letterSpacing: "0.05em" }}>VEG 🌿</span>
                )}
              </div>

              {/* Name */}
              <p className="chalk-font" style={{
                fontSize: 15, lineHeight: 1.25,
                color: soldOut ? CC_MUTED : CC_CHALK,
                textDecoration: soldOut ? "line-through" : "none",
              }}>{item.name}</p>

              {/* Description — always reserves 2-line height so cards without desc stay aligned */}
              <div style={{ minHeight: 36 }}>
                {item.description && (
                  <p className="body-font" style={{
                    fontSize: 11, color: CC_MUTED,
                    lineHeight: 1.5, margin: 0,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}>{item.description}</p>
                )}
              </div>
            </div>

            {/* Price + button — always pinned to bottom */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
              <span className="chalk-font" style={{
                fontSize: 20,
                color: soldOut ? CC_MUTED : CC_ACCENT,
                textShadow: soldOut ? "none" : "0 0 12px rgba(16,185,129,0.4)",
                textDecoration: soldOut ? "line-through" : "none",
              }}>
                ${item.price.toFixed(2)}
              </span>
              {!soldOut && (
                <button
                  className="body-font"
                  style={{
                    background: "transparent",
                    border: `1px solid #a07850`,
                    borderRadius: 20,
                    padding: "6px 14px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                    color: CC_ACCENT,
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                    flexShrink: 0,
                    transition: "all 0.18s",
                  }}
                  onClick={(e) => { e.stopPropagation(); openItemModal(item); }}
                >
                  Add
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Mobile layout overrides ──────────────────────────────────────────── */}
      <style>{`
        /* 2-column card grid on phones (< 640 px).
           Desktop keeps repeat(auto-fill, minmax(190px, 1fr)) from the inline style.
           640px matches Tailwind's sm breakpoint so tablets/desktops are unaffected. */
        @media (max-width: 639px) {
          .home-menu-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
        }
      `}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 480, backgroundColor: "#130e09" }}>
        {/* Coffee cup photo */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${heroCoffeeUrl as string})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "65% center",
          backgroundSize: "cover",
        }} />
        {/* Left fade so text is readable */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, #130e09 26%, rgba(19,14,9,0.65) 42%, rgba(19,14,9,0.08) 58%, transparent 68%)",
        }} />
        {/* Bottom fade to page bg */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
          background: "linear-gradient(to top, #130e09, transparent)",
        }} />
        <div className="relative z-10 flex flex-col max-w-6xl mx-auto px-6" style={{ paddingTop: 80, paddingBottom: 64 }}>
          {/* Open / closed badge */}
          {storeOpen ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${CC_HUNTER}22`, border: `1px solid ${CC_HUNTER}`,
              borderRadius: 20, padding: "5px 14px", marginBottom: 18, alignSelf: "flex-start",
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: CC_HUNT_L, boxShadow: `0 0 8px ${CC_HUNT_L}`, display: "inline-block" }} />
              <span className="body-font" style={{ fontSize: 11, color: CC_HUNT_L, fontWeight: 700, letterSpacing: "0.08em" }}>
                OPEN NOW · CLOSES {storeCloseOrdersAt}
              </span>
            </div>
          ) : (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(16,185,129,0.08)", border: `1px solid ${CC_BORD}`,
              borderRadius: 20, padding: "5px 14px", marginBottom: 18, alignSelf: "flex-start",
            }}>
              <span className="body-font" style={{ fontSize: 11, color: CC_MUTED, fontWeight: 700, letterSpacing: "0.08em" }}>CLOSED</span>
            </div>
          )}

          <p className="body-font flex items-center gap-1.5 mb-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: CC_MUTED, textTransform: "uppercase" }}>
            <MapPin className="w-3 h-3" /> Road Town, BVI · Pickup Only
          </p>

          <h1 className="chalk-font" style={{ fontSize: "clamp(36px,5vw,60px)", fontStyle: "italic", fontWeight: 700, lineHeight: 1.05, margin: "0 0 20px", color: CC_CHALK, textShadow: "0 2px 20px rgba(16,185,129,0.25)" }}>
            Good coffee,<br />
            <span style={{ color: CC_ACCENT }}>every visit.</span>
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
            <button
              className="body-font"
              style={{
                background: `linear-gradient(135deg, ${CC_HUNTER} 0%, #1f4d38 100%)`,
                color: "#d4f5e2", border: `1px solid ${CC_HUNT_L}`, borderRadius: 6,
                padding: "13px 32px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 6px 20px rgba(45,106,79,0.45)`,
                display: "flex", alignItems: "center", gap: 8,
                letterSpacing: 1.5, textTransform: "uppercase",
              }}
              onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}
            >
              View Menu <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Closed banner ─────────────────────────────────────────────────────── */}
      {!storeOpen && (
        <div style={{ background: "rgba(16,185,129,0.06)", borderBottom: `1px solid ${CC_BORD}` }} className="px-6 py-3 text-center">
          <p className="body-font text-sm font-semibold" style={{ color: CC_ACCENT }}>
            {!openToday ? (closedTodayReason ?? "We're closed today") : "Online ordering is currently closed"}
          </p>
          <p className="body-font text-xs mt-0.5" style={{ color: CC_MUTED }}>
            {!openToday
              ? "You can still browse the menu and order on an open day"
              : `We're open ${storeOpenTime} – ${storeCloseOrdersAt} · You can still browse the menu`}
          </p>
        </div>
      )}

      {/* ── Best Sellers ──────────────────────────────────────────────────────── */}
      {!loadingItems && popularItems.length > 0 && (
        /* overflow:hidden must be on a full-width block, NOT on the maxWidth container —
           otherwise the inner scroll strip can widen the layout and cause page horizontal scroll */
        <div style={{ overflow: "hidden", paddingTop: 48 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
              <h2 className="chalk-font" style={{ fontSize: 20, fontStyle: "italic", color: CC_CHALK }}>Popular Items</h2>
              {topSellers && topSellers.length > 0 && (
                <span className="body-font" style={{ fontSize: 11, color: CC_MUTED }}>Based on your orders</span>
              )}
            </div>
          </div>
          {/* Scroll strip is full-width with side padding — clipped by the outer overflow:hidden wrapper */}
          <div style={{
            display: "flex",
            gap: 20,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            /* stop the horizontal scroll from chaining up to the page on iOS/Android */
            overscrollBehaviorX: "contain",
            paddingLeft: 24,
            paddingRight: 24,
            paddingBottom: 12,
          }}>
            {popularItems.map((item, idx) => (
              <div key={item.id} style={{ flex: "0 0 210px" }}>
                {renderCard(item, idx)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Full Menu ─────────────────────────────────────────────────────────── */}
      <section id="menu" style={{ flex: 1, borderTop: `1px solid ${CC_BORD}`, marginTop: 32 }}>
        {/* Category tab bar — only shown when there are actual categories */}
        {(loadingCategories || visibleCategories.length > 0) && (
        <div style={{
          position: "sticky", top: 72, zIndex: 10,
          background: "#1a1109",
          borderBottom: `1px solid ${CC_BORD}`,
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
              {loadingCategories ? (
                <div style={{ display: "flex", gap: 8, padding: "12px 0" }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
                </div>
              ) : (
                allCategories.map((cat) => (
                  <button
                    key={cat.id ?? "all"}
                    className="body-font"
                    style={{
                      background: "transparent",
                      color: activeCategory === cat.id ? CC_ACCENT : CC_MUTED,
                      border: "none",
                      borderBottom: activeCategory === cat.id ? `2px solid ${CC_ACCENT}` : "2px solid transparent",
                      padding: "14px 20px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s",
                    }}
                    onClick={() => setActiveCategory(cat.id ?? null)}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        )}

        {/* Grid */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 64px" }}>
          {loadingItems ? (
            <div className="home-menu-grid" style={{ paddingTop: 44, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gridAutoRows: "1fr", gap: 20 }}>
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i}>
                  <Skeleton className="w-full rounded-2xl" style={{ height: 240 }} />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <p className="chalk-font" style={{ fontSize: 20, fontStyle: "italic", color: CC_CHALK, marginBottom: 8 }}>Menu coming soon</p>
              <p className="body-font" style={{ fontSize: 13, color: CC_MUTED }}>Check back shortly — we're getting the menu ready.</p>
            </div>
          ) : activeCategory === null ? (
            /* ── "All" view: grouped by category ─────────────────────────────── */
            <div style={{ display: "flex", flexDirection: "column", gap: 52 }}>
              {visibleCategories
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(cat => {
                  const catItems = filteredItems.filter(item => item.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat.id}>
                      {/* Category section header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 12,
                        marginBottom: 24, paddingTop: 4,
                      }}>
                        {/* Gold accent bar */}
                        <div style={{
                          width: 3, height: 22, borderRadius: 2,
                          background: `linear-gradient(180deg,${CC_ACCENT},#a07850)`,
                          flexShrink: 0,
                        }} />
                        <h3 className="chalk-font" style={{
                          fontSize: 18, fontStyle: "italic",
                          color: CC_CHALK, margin: 0,
                        }}>{cat.name}</h3>
                        <span className="body-font" style={{
                          fontSize: 11, color: CC_MUTED, marginLeft: 2,
                        }}>{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
                        {/* Dashed divider */}
                        <div style={{
                          flex: 1, height: 1,
                          background: `linear-gradient(90deg, ${CC_BORD} 0%, transparent 100%)`,
                        }} />
                      </div>
                      {/* Cards */}
                      <div className="home-menu-grid" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                        gap: 20,
                      }}>
                        {catItems.map(item => renderCard(item))}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            /* ── Single-category view: flat grid ──────────────────────────────── */
            <div className="home-menu-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
              gap: 20,
            }}>
              {filteredItems.map(item => renderCard(item))}
            </div>
          )}
        </div>
      </section>

      {/* ── Item dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem && (
          <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
            {/* Image */}
            <div className="w-full bg-muted overflow-hidden shrink-0 flex items-center justify-center" style={{ maxHeight: "260px", minHeight: "160px" }}>
              {selectedItem.imageUrl && !brokenImages.has(selectedItem.id) ? (
                <img src={selectedItem.imageUrl} alt={selectedItem.name} onError={() => handleImgError(selectedItem.id)} className="w-full h-full object-contain" style={{ maxHeight: "260px" }} />
              ) : (
                <div
                  className="w-full flex items-center justify-center"
                  style={{
                    minHeight: "160px",
                    background: CARD_COLORS[selectedItem.id % CARD_COLORS.length].grad,
                    position: "relative",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg, rgba(255,255,255,0.12) 0%, transparent 50%)" }} />
                  <span style={{ fontSize: 64, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))" }}>
                    {extractEmoji(selectedItem.name) || selectedItem.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              <div className="p-6 space-y-5">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <DialogTitle className="text-xl font-bold leading-tight">{selectedItem.name}</DialogTitle>
                    <span className="text-xl font-bold shrink-0">${(selectedItem.price + extraPrice).toFixed(2)}</span>
                  </div>
                  <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                    {selectedItem.description}
                  </DialogDescription>
                </div>

                {/* Modifiers */}
                {loadingModifiers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading options...
                  </div>
                ) : modifierGroups.length > 0 && (
                  <div className="space-y-5">
                    {modifierGroups.map((group) => {
                      const totalSel = totalSelectionsForGroup(group.loyverseId);
                      const atMax = group.maxSelections !== null && totalSel >= group.maxSelections;
                      return (
                        <div key={group.loyverseId}>
                          <Separator className="mb-4" />
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">{group.name}</p>
                            <div className="flex items-center gap-1.5">
                              {group.required && totalSel === 0 && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 px-1.5 py-0.5 rounded">Required</span>
                              )}
                              {group.minSelections > 0 && (
                                <span className="text-[11px] text-muted-foreground">
                                  {group.maxSelections === group.minSelections
                                    ? `Choose ${group.minSelections}`
                                    : group.maxSelections
                                    ? `${group.minSelections}–${group.maxSelections}`
                                    : `Min ${group.minSelections}`}
                                </span>
                              )}
                              {group.maxSelections !== null && group.minSelections === 0 && (
                                <span className="text-[11px] text-muted-foreground">Up to {group.maxSelections}</span>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            {group.options.map((option) => {
                              const qty = selectedModifiers[group.loyverseId]?.[option.id] ?? 0;
                              const isSelected = qty > 0;
                              const canIncrease = !atMax || isSelected;
                              if (option.allowMultiple) {
                                return (
                                  <div key={option.id} className="flex items-center justify-between gap-3">
                                    <span className={`text-sm ${isSelected ? "text-foreground font-medium" : "text-muted-foreground"}`}>{option.name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {option.price > 0 && (
                                        <span className="text-sm text-muted-foreground">+${option.price.toFixed(2)}</span>
                                      )}
                                      <div className="flex items-center gap-1 border rounded-full px-1 py-0.5">
                                        <button
                                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
                                          onClick={() => changeModifierQty(group, option.id, -1)}
                                          disabled={qty === 0}
                                        ><Minus className="h-3 w-3" /></button>
                                        <span className="w-4 text-center text-sm font-medium">{qty}</span>
                                        <button
                                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 transition-colors"
                                          onClick={() => changeModifierQty(group, option.id, 1)}
                                          disabled={!canIncrease || qty >= (option.maxQuantity ?? 1)}
                                        ><Plus className="h-3 w-3" /></button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <label key={option.id} className="flex items-center justify-between gap-3 cursor-pointer group/opt">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      id={`home-${option.id}`}
                                      checked={isSelected}
                                      disabled={!isSelected && atMax}
                                      onCheckedChange={() => changeModifierQty(group, option.id, isSelected ? -1 : 1)}
                                    />
                                    <span className="text-sm group-hover/opt:text-foreground transition-colors">{option.name}</span>
                                  </div>
                                  {option.price > 0 && (
                                    <span className="text-sm text-muted-foreground shrink-0">+${option.price.toFixed(2)}</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <Separator />
                  </div>
                )}

                {/* Notes */}
                {!showNotes ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors text-left"
                    onClick={() => setShowNotes(true)}
                  >
                    + Add special instructions
                  </button>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Special instructions</Label>
                    <Textarea
                      id="notes"
                      placeholder="No onions, extra sauce..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="resize-none h-20 text-sm"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 border-t border-border px-6 py-4">
              {modifierValidationError && (
                <p className="text-xs text-red-500 mb-3 text-center">{modifierValidationError}</p>
              )}
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-border rounded-full h-11 shrink-0">
                  <button
                    className="w-10 h-full flex items-center justify-center hover:bg-muted rounded-l-full transition-colors"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    className="w-10 h-full flex items-center justify-center hover:bg-muted rounded-r-full transition-colors"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Button
                  className="flex-1 h-11 font-semibold rounded-full"
                  onClick={handleAddToCart}
                  disabled={!!modifierValidationError}
                  title={modifierValidationError ?? undefined}
                >
                  Add {quantity > 1 && `${quantity} × `}— ${((selectedItem.price + extraPrice) * quantity).toFixed(2)}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Layout>
  );
}

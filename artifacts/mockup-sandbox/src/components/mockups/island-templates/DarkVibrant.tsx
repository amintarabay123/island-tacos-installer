import { ShoppingCart, MapPin, Clock, Flame, Plus, Star } from "lucide-react";

const MENU = [
  { name: "Pernil Taco", desc: "Slow-roasted pork shoulder, pickled onion, cilantro", price: 4.5, hot: true },
  { name: "Pollo Guisado Taco", desc: "Braised chicken, sofrito, sweet plantains", price: 4.25, hot: true },
  { name: "Camarones al Mojo", desc: "Garlic shrimp, avocado crema, lime", price: 5.5, hot: false },
  { name: "Picadillo Bowl", desc: "Seasoned ground beef, rice, black beans", price: 9.5, hot: false },
  { name: "Coquito Horchata", desc: "House coconut horchata, cinnamon, vanilla", price: 4.0, hot: false },
  { name: "Tostones", desc: "Double-fried green plantains, garlic dipping sauce", price: 4.0, hot: false },
];

const CATS = ["All", "Tacos", "Bowls", "Sides", "Drinks", "Desserts"];

export function DarkVibrant() {
  return (
    <div className="min-h-screen bg-[#0F0F0F] font-sans text-white">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#FF6B1A] to-[#FF3D6B] rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-lg tracking-tight">Island Tacos</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
          <span className="text-white font-semibold">Menu</span>
          <span>Track Order</span>
        </div>
        <button className="relative flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm font-medium hover:bg-white/20 transition">
          <ShoppingCart className="w-4 h-4" />
          Cart
          <span className="bg-gradient-to-r from-[#FF6B1A] to-[#FF3D6B] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
        </button>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF6B1A]/20 via-transparent to-[#0F0F0F]" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1400')] bg-cover bg-center opacity-20" />
        <div className="relative px-8 py-16 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur rounded-full px-4 py-1.5 text-xs font-semibold mb-5">
            <MapPin className="w-3 h-3 text-[#FF6B1A]" />
            <span className="text-white/70">Puerto Rico</span>
            <span className="w-1 h-1 bg-white/30 rounded-full" />
            <span className="text-[#FF6B1A]">Open now</span>
          </div>
          <h1 className="text-5xl font-black leading-none mb-4">
            The Island<br />
            <span className="bg-gradient-to-r from-[#FF6B1A] to-[#FFB800] bg-clip-text text-transparent">
              on a Plate.
            </span>
          </h1>
          <p className="text-white/50 text-base mb-8 max-w-sm leading-relaxed">
            Fire-kissed flavors. Puerto Rican soul. Order ahead for pickup or delivery.
          </p>
          <div className="flex items-center gap-4">
            <button className="bg-gradient-to-r from-[#FF6B1A] to-[#FF3D6B] text-white font-bold px-7 py-3 rounded-full hover:opacity-90 transition">
              Order Now
            </button>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Clock className="w-4 h-4 text-[#FF6B1A]" />
              20–30 min
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-white/10 px-6 bg-[#0F0F0F] sticky top-0 z-10">
        <div className="flex gap-1 overflow-x-auto py-2">
          {CATS.map((c, i) => (
            <button
              key={c}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                i === 0
                  ? "bg-gradient-to-r from-[#FF6B1A] to-[#FF3D6B] text-white"
                  : "text-white/40 hover:text-white hover:bg-white/10"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold">Crowd Favorites</h2>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {MENU.map((item) => (
            <div
              key={item.name}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#FF6B1A]/50 transition group"
            >
              <div className="h-32 bg-gradient-to-br from-[#FF6B1A]/20 to-[#FF3D6B]/10 relative flex items-center justify-center">
                <div className="text-4xl opacity-40">🌮</div>
                {item.hot && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#FF3D6B]/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Flame className="w-2.5 h-2.5" /> Hot Pick
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-sm text-white/90">{item.name}</h3>
                  <span className="font-bold text-[#FF6B1A] text-sm shrink-0">${item.price.toFixed(2)}</span>
                </div>
                <p className="text-xs text-white/40 mb-3 leading-relaxed">{item.desc}</p>
                <button className="w-full bg-white/10 hover:bg-gradient-to-r hover:from-[#FF6B1A] hover:to-[#FF3D6B] text-white text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1.5 border border-white/10 hover:border-transparent">
                  <Plus className="w-3.5 h-3.5" /> Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-8 py-6 mt-4 flex flex-wrap gap-4 items-center justify-between text-sm text-white/40">
        <div className="flex items-center gap-2 font-black text-white">
          <Flame className="w-4 h-4 text-[#FF6B1A]" />
          Island Tacos
        </div>
        <div className="flex items-center gap-1 text-[#FFB800]">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
          <span className="text-white/40 ml-1 text-xs">4.9 rating</span>
        </div>
        <span>Caguas, Puerto Rico · Open 11am–10pm</span>
      </div>
    </div>
  );
}

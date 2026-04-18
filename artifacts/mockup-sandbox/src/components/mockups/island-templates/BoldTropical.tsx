import { ShoppingCart, MapPin, Clock, Star, ChevronRight, Leaf } from "lucide-react";

const MENU = [
  { name: "Pernil Taco", desc: "Slow-roasted pork shoulder, pickled onion, cilantro", price: 4.5, tag: "Popular" },
  { name: "Pollo Guisado Taco", desc: "Braised chicken, sofrito, sweet plantains", price: 4.25, tag: "Popular" },
  { name: "Camarones al Mojo", desc: "Garlic shrimp, avocado crema, lime", price: 5.5, tag: "New" },
  { name: "Picadillo Bowl", desc: "Seasoned ground beef, rice, black beans", price: 9.5, tag: "" },
  { name: "Coquito Horchata", desc: "House coconut horchata, cinnamon, vanilla", price: 4.0, tag: "" },
  { name: "Tostones", desc: "Double-fried green plantains, garlic dipping sauce", price: 4.0, tag: "" },
];

const CATS = ["All", "Tacos", "Bowls", "Sides", "Drinks", "Desserts"];

export function BoldTropical() {
  return (
    <div className="min-h-screen bg-[#FFF9F0] font-sans">
      {/* Nav */}
      <nav className="bg-[#E8521A] text-white px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-[#F5C842]" />
          <span className="font-black text-xl tracking-tight">ISLAND TACOS</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <span className="text-[#F5C842] border-b-2 border-[#F5C842] pb-0.5">Menu</span>
          <span>Track Order</span>
        </div>
        <button className="relative bg-[#F5C842] text-[#1A1A1A] rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Cart
          <span className="absolute -top-2 -right-2 bg-white text-[#E8521A] text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">3</span>
        </button>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden bg-[#E8521A] text-white">
        <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200')] bg-cover bg-center" />
        <div className="relative px-8 py-14 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#F5C842] text-[#1A1A1A] rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest mb-4">
            <MapPin className="w-3 h-3" /> Puerto Rico
          </div>
          <h1 className="text-5xl font-black leading-none mb-3">
            Bite into the<br /><span className="text-[#F5C842]">Island.</span>
          </h1>
          <p className="text-base text-white/80 mb-6 max-w-sm">
            Bold, colorful, and wildly fresh. Order ahead for pickup or delivery.
          </p>
          <div className="flex items-center gap-4">
            <button className="bg-[#F5C842] text-[#1A1A1A] font-black px-7 py-3 rounded-full text-base hover:bg-yellow-300 transition">
              Order Now
            </button>
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-[#F5C842]" />
              <span>Ready in 20–30 min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-[#E8521A]/20 bg-white sticky top-[52px] z-10">
        <div className="flex gap-1 px-6 overflow-x-auto py-2">
          {CATS.map((c, i) => (
            <button
              key={c}
              className={`px-5 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition ${
                i === 0
                  ? "bg-[#E8521A] text-white"
                  : "text-[#666] hover:bg-[#FFF3E0]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Menu grid */}
      <div className="px-6 py-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-black mb-4 text-[#1A1A1A]">Crowd Favorites</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MENU.map((item) => (
            <div key={item.name} className="bg-white rounded-2xl overflow-hidden border border-[#F0E4D0] hover:shadow-lg transition group">
              <div className="h-36 bg-gradient-to-br from-[#F5C842]/30 to-[#E8521A]/20 relative">
                {item.tag && (
                  <span className={`absolute top-3 left-3 text-xs font-bold px-2.5 py-1 rounded-full ${
                    item.tag === "Popular" ? "bg-[#E8521A] text-white" : "bg-[#2D7A3A] text-white"
                  }`}>
                    {item.tag}
                  </span>
                )}
                <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">🌮</div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-[#1A1A1A] text-sm leading-tight">{item.name}</h3>
                  <span className="font-black text-[#E8521A] text-base shrink-0">${item.price.toFixed(2)}</span>
                </div>
                <p className="text-xs text-[#888] mb-3 leading-relaxed">{item.desc}</p>
                <button className="w-full bg-[#E8521A] hover:bg-[#cf4514] text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer strip */}
      <div className="bg-[#1A1A1A] text-white px-8 py-6 mt-4 flex flex-wrap gap-4 items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-black">
          <Leaf className="w-4 h-4 text-[#F5C842]" />
          ISLAND TACOS
        </div>
        <div className="flex items-center gap-1 text-[#F5C842]">
          <Star className="w-3.5 h-3.5 fill-current" />
          <Star className="w-3.5 h-3.5 fill-current" />
          <Star className="w-3.5 h-3.5 fill-current" />
          <Star className="w-3.5 h-3.5 fill-current" />
          <Star className="w-3.5 h-3.5 fill-current" />
          <span className="text-white ml-1">4.9 on Google</span>
        </div>
        <span className="text-[#888]">Caguas, Puerto Rico · Open 11am–10pm</span>
      </div>
    </div>
  );
}

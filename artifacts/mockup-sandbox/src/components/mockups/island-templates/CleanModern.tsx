import { ShoppingCart, MapPin, Clock, ArrowRight, Plus } from "lucide-react";

const MENU = [
  { name: "Pernil Taco", desc: "Slow-roasted pork shoulder, pickled onion, cilantro", price: 4.5, tag: "Best Seller" },
  { name: "Pollo Guisado Taco", desc: "Braised chicken, sofrito, sweet plantains", price: 4.25, tag: "Best Seller" },
  { name: "Camarones al Mojo", desc: "Garlic shrimp, avocado crema, lime", price: 5.5, tag: "New" },
  { name: "Picadillo Bowl", desc: "Seasoned ground beef, rice, black beans", price: 9.5, tag: "" },
  { name: "Coquito Horchata", desc: "House coconut horchata, cinnamon, vanilla", price: 4.0, tag: "" },
  { name: "Tostones", desc: "Double-fried green plantains, garlic dipping sauce", price: 4.0, tag: "" },
];

const CATS = ["All", "Tacos", "Bowls", "Sides", "Drinks", "Desserts"];

export function CleanModern() {
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Nav */}
      <nav className="px-8 py-4 flex items-center justify-between border-b border-neutral-100">
        <div>
          <div className="text-xs font-semibold tracking-widest text-neutral-400 uppercase mb-0.5">Restaurant</div>
          <div className="text-lg font-bold tracking-tight text-neutral-900">Island Tacos</div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-neutral-500">
          <span className="text-neutral-900 font-semibold">Menu</span>
          <span>Track Order</span>
          <span>Contact</span>
        </div>
        <button className="relative flex items-center gap-2 border border-neutral-200 rounded-full px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition">
          <ShoppingCart className="w-4 h-4" />
          <span>3 items</span>
          <span className="bg-neutral-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
        </button>
      </nav>

      {/* Hero */}
      <div className="relative h-[340px] overflow-hidden bg-neutral-100">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1400')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/20" />
        <div className="relative h-full flex flex-col justify-end px-10 pb-10">
          <p className="text-xs font-semibold tracking-widest text-white/60 uppercase mb-2 flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Authentic Puerto Rican Flavor
          </p>
          <h1 className="text-4xl font-bold text-white mb-3 leading-tight">
            Fresh. Bold.<br />Unforgettable.
          </h1>
          <div className="flex items-center gap-4">
            <button className="bg-white text-neutral-900 font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-neutral-100 transition flex items-center gap-1.5">
              Order Now <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <Clock className="w-4 h-4" />
              Ready in 20–30 min
            </div>
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="border-b border-neutral-100 px-8">
        <div className="flex gap-6 overflow-x-auto">
          {CATS.map((c, i) => (
            <button
              key={c}
              className={`py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                i === 0
                  ? "border-neutral-900 text-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Menu */}
      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MENU.map((item) => (
            <div key={item.name} className="flex items-start gap-4 p-4 rounded-xl hover:bg-neutral-50 transition group border border-transparent hover:border-neutral-100">
              <div className="w-20 h-20 rounded-xl bg-neutral-100 shrink-0 flex items-center justify-center text-3xl overflow-hidden">
                🌮
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    {item.tag && (
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mr-2 ${
                        item.tag === "New" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {item.tag}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-neutral-900">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-neutral-900 shrink-0">${item.price.toFixed(2)}</span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">{item.desc}</p>
                <button className="text-xs font-semibold text-neutral-900 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition border border-neutral-200 rounded-full px-3 py-1 hover:bg-neutral-900 hover:text-white hover:border-neutral-900">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-100 px-8 py-6 flex flex-wrap gap-4 items-center justify-between text-sm text-neutral-400 mt-4">
        <span className="font-semibold text-neutral-900">Island Tacos</span>
        <span>Caguas, Puerto Rico</span>
        <span>Open 11am–10pm daily</span>
        <span>ATH Movil · Card · Apple Pay</span>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Plus, MapPin, Clock, Flame, Star, ChevronRight, Search, ShoppingBag } from 'lucide-react';

export function DarkPremium() {
  const [activeCategory, setActiveCategory] = useState('All');

  const signatureDishes = [
    { name: 'Al Pastor', price: '$14', image: '/__mockup/images/al-pastor.png', tag: 'Chef Choice' },
    { name: 'Fish Taco', price: '$16', image: '/__mockup/images/fish-taco.png', tag: 'Fresh Catch' },
    { name: 'Carne Asada', price: '$15', image: '/__mockup/images/carne-asada.png', tag: 'Premium' },
    { name: 'Veggie Bliss', price: '$13', image: '/__mockup/images/veggie-taco.png', tag: 'Organic' },
  ];

  const categories = ['All', 'Tacos', 'Burritos', 'Sides', 'Drinks'];

  const menuItems = [
    { name: 'Tuna Aguachile', description: 'Fresh Ahi tuna, lime, cilantro, red onion, and cucumber.', price: '$18', isPopular: true },
    { name: 'Barbacoa Taco', description: 'Slow-braised beef with pickled onion and salsa verde.', price: '$14', isSpicy: true },
    { name: 'Shrimp Tempura Taco', description: 'Crispy shrimp, chipotle slaw, and avocado crema.', price: '$16', isPopular: true },
    { name: 'Truffle Mushroom Quesadilla', description: 'Wild mushrooms, truffle oil, and melted Oaxaca cheese.', price: '$17' },
    { name: 'Chipotle Chicken Bowl', description: 'Grilled chicken, quinoa, black beans, and roasted corn.', price: '$15' },
    { name: 'Hand-Cut Yuca Fries', description: 'Served with garlic mojo dipping sauce.', price: '$8' },
    { name: 'Mexican Street Corn (Esquites)', description: 'Corn off the cob, lime, cotija, and ancho chili.', price: '$9', isPopular: true },
    { name: 'Housemade Churros', description: 'Warm Mexican chocolate and cinnamon sugar.', price: '$10' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#D4AF37] selection:text-black" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="text-xl font-light tracking-[0.3em] text-[#D4AF37]">ISLAND TACOS</div>
          <div className="flex items-center gap-8">
            <button className="text-zinc-400 hover:text-white transition-colors"><Search size={20} /></button>
            <button className="relative text-zinc-400 hover:text-white transition-colors">
              <ShoppingBag size={20} />
              <span className="absolute -top-2 -right-2 bg-[#D4AF37] text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">2</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[560px] h-[80vh] flex items-center justify-center overflow-hidden pt-20">
        <img 
          src="/__mockup/images/hero.png" 
          alt="Island Tacos Hero" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/75"></div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <span className="block text-[#D4AF37] tracking-[0.5em] text-sm md:text-base font-medium mb-8 animate-fade-in">
            ISLAND TACOS
          </span>
          <h1 className="text-5xl md:text-8xl font-thin tracking-tight leading-[1.1] mb-8">
            Crafted with Passion,<br />
            <span className="italic">Served Fresh.</span>
          </h1>
          
          <div className="w-24 h-px bg-[#D4AF37] mx-auto mb-8"></div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-[#D4AF37] tracking-[0.3em] text-xs md:text-sm uppercase">
              <MapPin size={14} />
              Road Town, BVI
            </div>
            
            <button className="px-10 py-4 border-2 border-[#D4AF37] text-[#D4AF37] text-sm uppercase tracking-widest hover:bg-[#D4AF37] hover:text-black transition-all duration-500 font-medium">
              Start Your Order
            </button>
            
            <div className="flex items-center gap-2 text-zinc-500 text-sm font-light">
              <Clock size={14} />
              <span>Pickup Only · Ready in 20–30 min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Dishes */}
      <section className="py-24 pl-6 md:pl-12 bg-[#0A0A0A]">
        <div className="max-w-7xl mx-auto mb-12 flex items-end justify-between pr-6 md:pr-12">
          <div>
            <h2 className="text-[#D4AF37] tracking-[0.3em] text-xs uppercase font-semibold mb-2">Signature Dishes</h2>
            <p className="text-3xl font-light">Chef's Masterpieces</p>
          </div>
          <div className="hidden md:flex gap-2">
            <div className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 cursor-not-allowed">
              <ChevronRight size={20} className="rotate-180" />
            </div>
            <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-white hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer transition-colors">
              <ChevronRight size={20} />
            </div>
          </div>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
          {signatureDishes.map((dish, i) => (
            <div key={i} className="min-w-[300px] md:min-w-[480px] snap-start group cursor-pointer">
              <div className="aspect-[16/9] relative overflow-hidden rounded-sm bg-[#141414] border border-zinc-800/50">
                <img 
                  src={dish.image} 
                  alt={dish.name} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 border border-[#D4AF37]/30 bg-black/40 backdrop-blur-md text-[#D4AF37] text-[10px] uppercase tracking-widest font-medium">
                    {dish.tag}
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                  <div>
                    <h3 className="text-2xl font-light text-white mb-1">{dish.name}</h3>
                    <p className="text-[#D4AF37] font-medium">{dish.price}</p>
                  </div>
                  <button className="text-zinc-300 text-sm uppercase tracking-widest border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all pb-1">
                    Add to Order
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Category Tabs */}
      <section className="sticky top-20 z-40 bg-[#0A0A0A]/95 backdrop-blur-sm border-y border-zinc-900 px-6 py-6">
        <div className="max-w-4xl mx-auto flex gap-4 overflow-x-auto no-scrollbar justify-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-8 py-2 text-xs uppercase tracking-widest transition-all duration-300 border ${
                activeCategory === cat
                  ? 'border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/5'
                  : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Menu List */}
      <section className="max-w-4xl mx-auto px-6 py-12 md:py-24">
        <div className="space-y-0">
          {menuItems.map((item, i) => (
            <div 
              key={i} 
              className="group flex items-center justify-between py-10 px-4 -mx-4 border-b border-zinc-900 hover:bg-zinc-900/40 transition-all duration-300"
            >
              <div className="flex-1 pr-8">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-medium text-white tracking-wide">{item.name}</h3>
                  {item.isPopular && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-tighter text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-full">
                      <Star size={10} fill="#D4AF37" /> Popular
                    </span>
                  )}
                  {item.isSpicy && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-tighter text-red-500 border border-red-500/30 px-2 py-0.5 rounded-full">
                      <Flame size={10} fill="currentColor" /> Spicy
                    </span>
                  )}
                </div>
                <p className="text-zinc-500 text-sm font-light leading-relaxed max-w-lg">
                  {item.description}
                </p>
              </div>
              
              <div className="flex items-center gap-8">
                <span className="text-[#D4AF37] font-medium text-lg italic">{item.price}</span>
                <button className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-500 hover:border-[#D4AF37] hover:text-[#D4AF37] hover:scale-110 transition-all">
                  <Plus size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 text-center">
          <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase mb-4 italic">Prices inclusive of local taxes</p>
          <div className="w-12 h-px bg-zinc-800 mx-auto"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050505] border-t border-zinc-900 py-16 px-6">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          <div className="text-2xl font-light tracking-[0.4em] text-[#D4AF37] mb-8">ISLAND TACOS</div>
          <div className="flex gap-8 text-zinc-500 text-xs uppercase tracking-widest mb-12">
            <a href="#" className="hover:text-white transition-colors">Menu</a>
            <a href="#" className="hover:text-white transition-colors">About</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
          <p className="text-zinc-700 text-[10px] uppercase tracking-[0.3em]">
            © {new Date().getFullYear()} Island Tacos Road Town. All Rights Reserved.
          </p>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}} />
    </div>
  );
}

import React from 'react';
import { ShoppingBag, Clock, MapPin, Star, Plus, Flame, ChevronRight, Search, Menu as MenuIcon, X } from 'lucide-react';

export function TropicalFiesta() {
  const [activeCategory, setActiveCategory] = React.useState('All');

  const bestSellers = [
    { name: 'Al Pastor Tacos', price: 12.99, image: '/__mockup/images/al-pastor.png' },
    { name: 'Fish Tacos', price: 13.99, image: '/__mockup/images/fish-taco.png' },
    { name: 'Carne Asada', price: 14.99, image: '/__mockup/images/carne-asada.png' },
    { name: 'Veggie Bowl', price: 11.99, image: '/__mockup/images/veggie-taco.png' },
  ];

  const menuItems = [
    { name: 'Al Pastor Tacos', price: 12.99, description: 'Traditional marinated pork with pineapple and cilantro.', image: '/__mockup/images/al-pastor.png' },
    { name: 'Fish Tacos', price: 13.99, description: 'Fresh local catch, grilled or fried with mango slaw.', image: '/__mockup/images/fish-taco.png' },
    { name: 'Carne Asada', price: 14.99, description: 'Grilled steak with charred onions and fresh salsa.', image: '/__mockup/images/carne-asada.png' },
    { name: 'Veggie Bowl', price: 11.99, description: 'Seasonal roasted vegetables over cilantro-lime rice.', image: '/__mockup/images/veggie-taco.png' },
    { name: 'Chicken Burrito', price: 13.99, description: 'Shredded pollo asado with black beans and cheese.', image: '/__mockup/images/al-pastor.png' },
    { name: 'Steak Burrito', price: 15.99, description: 'Hearty steak burrito with rice, beans, and crema.', image: '/__mockup/images/carne-asada.png' },
    { name: 'Rice & Beans', price: 4.99, description: 'Classic Caribbean style rice and seasoned black beans.', image: '/__mockup/images/veggie-taco.png' },
    { name: 'Guacamole', price: 6.99, description: 'Made fresh daily with local avocados and chips.', image: '/__mockup/images/fish-taco.png' },
  ];

  const categories = ['All', 'Tacos', 'Burritos', 'Bowls', 'Sides', 'Drinks'];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDF6EC', fontFamily: 'system-ui, sans-serif' }}>
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F5ECD7] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center">
            <span className="text-white font-black text-xl">IT</span>
          </div>
          <span className="text-[#1C0A00] font-black text-xl tracking-tight">ISLAND TACOS</span>
        </div>
        <div className="flex items-center gap-4 text-[#1C0A00]">
          <Search className="w-5 h-5 cursor-pointer" />
          <div className="relative cursor-pointer">
            <ShoppingBag className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 bg-[#16A34A] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">2</span>
          </div>
          <MenuIcon className="w-6 h-6 md:hidden" />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[480px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img 
            src="/__mockup/images/hero.png" 
            className="w-full h-full object-cover brightness-[0.65]" 
            alt="Island Tacos Hero" 
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#F97316]/60 via-transparent to-[#16A34A]/30" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-4 py-1.5 text-white text-sm font-medium mb-6">
            <MapPin className="w-4 h-4 text-[#F97316]" />
            Road Town, BVI · Pickup Only
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-xl leading-none">
            CARIBBEAN <br/>
            <span className="text-[#F97316]">SOUL</span> IN EVERY BITE
          </h1>
          
          <p className="text-xl text-white/90 mb-8 font-medium max-w-xl mx-auto">
            Authentic Mexican flavors infused with the vibrant energy of the British Virgin Islands.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button className="bg-[#F97316] hover:bg-[#EA580C] text-white px-10 py-4 rounded-2xl font-black text-lg transition-all transform hover:scale-105 shadow-2xl flex items-center gap-2">
              Order Now <ChevronRight className="w-5 h-5" />
            </button>
            <div className="bg-white/90 backdrop-blur px-6 py-4 rounded-2xl flex items-center gap-3 shadow-lg">
              <Clock className="w-5 h-5 text-[#16A34A]" />
              <div className="text-left">
                <p className="text-[#1C0A00] text-xs font-bold uppercase tracking-wider">Ready in</p>
                <p className="text-[#1C0A00] font-black">20–30 min</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        
        {/* Best Sellers */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-[#1C0A00] flex items-center gap-3">
              <Flame className="w-8 h-8 text-[#F97316] fill-[#F97316]" />
              Fan Favorites
            </h2>
          </div>
          
          <div className="flex overflow-x-auto pb-4 gap-6 no-scrollbar md:grid md:grid-cols-4 md:overflow-visible">
            {bestSellers.map((item, idx) => (
              <div 
                key={idx} 
                className="flex-shrink-0 w-64 md:w-full group cursor-pointer"
              >
                <div className="bg-white rounded-3xl p-3 shadow-sm hover:shadow-2xl hover:shadow-[#F97316]/10 transition-all duration-300 transform group-hover:-translate-y-2">
                  <div className="aspect-square rounded-2xl overflow-hidden mb-4 relative">
                    <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur p-1.5 rounded-xl text-[#F97316]">
                      <Star className="w-4 h-4 fill-[#F97316]" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between px-2 pb-2">
                    <div>
                      <h3 className="font-bold text-[#1C0A00] mb-1">{item.name}</h3>
                      <p className="text-[#F97316] font-black text-lg">${item.price}</p>
                    </div>
                    <button className="bg-[#F97316] text-white p-2.5 rounded-xl hover:bg-[#EA580C] transition-colors shadow-lg shadow-[#F97316]/20">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Categories and Menu */}
        <section className="space-y-8">
          <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-8 py-3 rounded-full font-bold transition-all whitespace-nowrap border-2 ${
                  activeCategory === cat 
                  ? 'bg-[#F97316] border-[#F97316] text-white shadow-lg shadow-[#F97316]/30 scale-105' 
                  : 'bg-white border-transparent text-[#1C0A00] hover:border-[#F97316]/30'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all border border-[#F5ECD7] group"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img 
                    src={item.image} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    alt={item.name} 
                  />
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-[#1C0A00] leading-tight">{item.name}</h3>
                    <span className="text-[#F97316] font-black text-xl">${item.price}</span>
                  </div>
                  <p className="text-[#1C0A00]/60 text-sm mb-6 line-clamp-2">
                    {item.description}
                  </p>
                  <button className="w-full py-4 rounded-2xl border-2 border-[#16A34A] text-[#16A34A] font-bold hover:bg-[#16A34A] hover:text-white transition-all flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> Add to Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1C0A00] text-white py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div className="space-y-6">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center">
                <span className="text-white font-black text-xl">IT</span>
              </div>
              <span className="font-black text-2xl tracking-tight">ISLAND TACOS</span>
            </div>
            <p className="text-white/60">
              The freshest ingredients, the boldest spices, and the warmest island hospitality.
            </p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-bold text-[#F97316] uppercase tracking-widest text-sm">Location</h4>
            <p className="text-lg">Road Town, Tortola<br/>British Virgin Islands</p>
            <p className="text-white/60">Across from the ferry terminal</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-bold text-[#F97316] uppercase tracking-widest text-sm">Hours</h4>
            <p className="text-lg">Mon - Sat: 11am - 9pm</p>
            <p className="text-lg text-white/40">Sunday: Closed</p>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-white/10 text-center text-white/40 text-sm">
          © 2024 Island Tacos BVI. Handcrafted flavors from the Caribbean.
        </div>
      </footer>

      {/* Mobile Floating Cart */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[90%]">
        <button className="w-full bg-[#F97316] text-white py-4 rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span>View Order (2 items)</span>
          </div>
          <span>$26.98</span>
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

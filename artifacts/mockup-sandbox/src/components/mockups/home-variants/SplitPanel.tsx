import React from 'react';
import { Search, ShoppingCart, MapPin, Clock, Plus, Flame } from 'lucide-react';

const categories = [
  { id: 'all', name: 'All' },
  { id: 'tacos', name: 'Tacos' },
  { id: 'burritos', name: 'Burritos' },
  { id: 'bowls', name: 'Bowls' },
  { id: 'sides', name: 'Sides' },
  { id: 'drinks', name: 'Drinks' },
];

const popularItems = [
  {
    id: 1,
    name: 'Al Pastor Tacos',
    price: '$12.00',
    image: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: 2,
    name: 'Carne Asada Burrito',
    price: '$14.50',
    image: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&q=80&w=200&h=200',
  },
  {
    id: 3,
    name: 'Grilled Fish Tacos',
    price: '$13.00',
    image: 'https://images.unsplash.com/photo-1512838243191-e81e8f66f1fd?auto=format&fit=crop&q=80&w=200&h=200',
  },
];

const menuItems = [
  {
    id: 4,
    name: 'Carnitas Taco',
    description: 'Slow-cooked pork with cilantro, onion, and lime.',
    price: '$4.50',
    image: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 5,
    name: 'Veggie Bowl',
    description: 'Brown rice, black beans, roasted corn, and avocado salsa.',
    price: '$11.00',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 6,
    name: 'Shrimp Burrito',
    description: 'Sautéed shrimp, cilantro rice, and chipotle crema.',
    price: '$15.00',
    image: 'https://images.unsplash.com/photo-1624300629298-e9de39c13be5?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 7,
    name: 'Guacamole & Chips',
    description: 'Freshly made guacamole with crispy corn chips.',
    price: '$7.00',
    image: 'https://images.unsplash.com/photo-1571162242324-f1607b1eca8a?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 8,
    name: 'Mexican Street Corn',
    description: 'Grilled corn with mayo, cotija cheese, and chili powder.',
    price: '$5.50',
    image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 9,
    name: 'Churros',
    description: 'Fried dough pastry with cinnamon sugar and chocolate dip.',
    price: '$6.00',
    image: 'https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 10,
    name: 'Horchata',
    description: 'Traditional rice milk with cinnamon and vanilla.',
    price: '$4.00',
    image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&q=80&w=150&h=150',
  },
  {
    id: 11,
    name: 'Margarita',
    description: 'Classic lime margarita on the rocks.',
    price: '$9.00',
    image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=150&h=150',
  },
];

export function SplitPanel() {
  const [activeCategory, setActiveCategory] = React.useState('all');

  return (
    <div className="flex min-h-screen bg-[#F9F9F9] text-gray-900 font-sans">
      {/* Sidebar - Desktop */}
      <aside className="w-72 bg-white border-r border-gray-200 fixed h-full overflow-y-auto hidden md:flex flex-col z-20">
        <div className="p-6">
          <div className="text-orange-600 font-bold text-2xl tracking-tight mb-1">
            Island Tacos
          </div>
          <div className="flex flex-col space-y-1 text-sm text-gray-500 mb-6">
            <div className="flex items-center">
              <MapPin className="w-3 h-3 mr-1" />
              <span>Road Town, BVI</span>
            </div>
            <div className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              <span>20–30 min pickup</span>
            </div>
          </div>

          <div className="h-px bg-gray-100 w-full mb-6" />

          <div className="mb-4">
            <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
              Menu
            </span>
          </div>

          <nav className="space-y-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center px-4 py-3 text-sm transition-colors rounded-lg ${
                  activeCategory === cat.id
                    ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-600 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-gray-100">
          <div className="bg-gray-100 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors">
            <div className="flex items-center">
              <ShoppingCart className="w-5 h-5 mr-3 text-gray-600" />
              <div>
                <p className="text-sm font-semibold">0 items</p>
                <p className="text-xs text-gray-500">$0.00</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-1">
              <Plus className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-72 flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 bg-white border-b border-gray-200 z-30">
          <div className="p-4 flex items-center justify-between">
            <div className="text-orange-600 font-bold text-xl">Island Tacos</div>
            <div className="bg-orange-50 p-2 rounded-full relative">
              <ShoppingCart className="w-5 h-5 text-orange-600" />
              <span className="absolute -top-1 -right-1 bg-orange-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                0
              </span>
            </div>
          </div>
          <div className="flex overflow-x-auto no-scrollbar px-4 pb-2 space-x-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </header>

        {/* Desktop Sticky Search */}
        <div className="hidden md:block sticky top-0 z-10 bg-[#F9F9F9]/80 backdrop-blur-md px-6 py-4">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search menu..."
              className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600 transition-all text-sm shadow-sm"
            />
          </div>
        </div>

        <div className="p-6 md:pt-0 max-w-5xl">
          {/* Popular Section */}
          <section className="mb-10">
            <div className="flex items-center mb-4">
              <Flame className="w-5 h-5 text-orange-600 mr-2" />
              <h2 className="text-lg font-bold">Popular Right Now</h2>
            </div>
            <div className="flex overflow-x-auto space-x-4 pb-4 no-scrollbar">
              {popularItems.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-72 bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex items-center space-x-3 group cursor-pointer hover:shadow-md transition-shadow"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{item.name}</p>
                    <p className="text-orange-600 font-bold mt-1">{item.price}</p>
                  </div>
                  <button className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Full Menu */}
          <section>
            <h2 className="text-lg font-bold mb-4">Full Menu</h2>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              {menuItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`group p-4 flex items-center space-x-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                    index !== menuItems.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                        {item.name}
                      </h3>
                      <span className="font-bold text-gray-900">{item.price}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <button className="bg-gray-100 group-hover:bg-orange-600 group-hover:text-white text-gray-600 p-2 rounded-lg transition-colors ml-2">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer info for mobile */}
        <footer className="md:hidden p-8 text-center text-gray-400 text-sm mt-8 border-t border-gray-100">
          <p>© 2024 Island Tacos · Road Town, BVI</p>
        </footer>
      </main>

      {/* Floating Action Button - Mobile Cart */}
      <div className="md:hidden fixed bottom-6 right-6 z-40">
        <button className="bg-orange-600 text-white flex items-center space-x-2 px-6 py-4 rounded-full shadow-2xl hover:bg-orange-700 active:scale-95 transition-all">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold">View Cart ($0.00)</span>
        </button>
      </div>
    </div>
  );
}

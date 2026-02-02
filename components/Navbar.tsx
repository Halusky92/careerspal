
import React, { useState, useEffect } from 'react';

interface NavbarProps {
  onNavigate: (view: string) => void;
  currentView: string;
  user?: any;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentView, user, onLogout }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  const navItems = [
    { label: 'Find Roles', view: 'find' },
    { label: 'Salaries', view: 'salaries' }, // New Item
    { label: 'Our Mission', view: 'about' },
    { label: 'For Companies', view: 'pricing' },
  ];

  const handleMobileNav = (view: string) => {
    setIsMenuOpen(false);
    onNavigate(view);
  };

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo */}
            <div className="flex items-center space-x-3 cursor-pointer group relative z-[102]" onClick={() => handleMobileNav('home')}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6 shadow-xl shadow-indigo-100">
                <span className="text-white font-black text-lg">C</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-extrabold tracking-tighter text-indigo-600 leading-none">CareersPal</span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-900 mt-1">Elite Ecosystem</span>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map(item => (
                <button key={item.view} onClick={() => onNavigate(item.view)} className={`text-sm font-bold tracking-tight transition-colors ${currentView === item.view ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}>
                  {item.label}
                </button>
              ))}
              
              {user ? (
                <div className="flex items-center gap-6 pl-6 border-l border-slate-100">
                  <button onClick={() => onNavigate('manage')} className="text-sm font-black text-slate-900 hover:text-indigo-600 transition-colors">
                    {user.role === 'employer' ? 'Dashboard' : 'My Applications'}
                  </button>
                  <button onClick={onLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">Logout</button>
                </div>
              ) : (
                <button onClick={() => onNavigate('auth')} className="text-sm font-black text-slate-500 hover:text-indigo-600 transition-colors">Login</button>
              )}
              
              <button onClick={() => onNavigate('post')} className="bg-indigo-600 text-white px-7 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                Post a Role
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden relative z-[102]">
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="p-2 text-slate-800 focus:outline-none"
                aria-label="Toggle menu"
              >
                <div className="w-6 h-5 relative flex flex-col justify-between">
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 origin-left ${isMenuOpen ? 'rotate-45 translate-x-1' : ''}`}></span>
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}></span>
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 origin-left ${isMenuOpen ? '-rotate-45 translate-x-1' : ''}`}></span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 z-[101] bg-white md:hidden transition-all duration-500 flex flex-col ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}>
        <div className="flex-1 flex flex-col pt-28 px-6 pb-8 overflow-y-auto">
          <div className="space-y-2 mb-10">
            {navItems.map(item => (
              <button 
                key={item.view} 
                onClick={() => handleMobileNav(item.view)} 
                className={`w-full text-left text-3xl font-black tracking-tight py-4 border-b border-slate-50 transition-colors ${currentView === item.view ? 'text-indigo-600' : 'text-slate-900'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-4">
             {user ? (
               <div className="bg-slate-50 p-6 rounded-[2rem] mb-4">
                 <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Signed in as</p>
                 <p className="text-lg font-bold text-slate-900 truncate mb-4">{user.email}</p>
                 <button onClick={() => handleMobileNav('manage')} className="w-full bg-white text-slate-900 border border-slate-200 py-4 rounded-2xl font-black mb-3 shadow-sm active:scale-95 transition-transform">
                   {user.role === 'employer' ? 'Go to Dashboard' : 'My Applications'}
                 </button>
                 <button onClick={() => { onLogout(); setIsMenuOpen(false); }} className="w-full text-red-500 text-sm font-black py-2 active:opacity-70">
                   Sign Out
                 </button>
               </div>
             ) : (
                <button onClick={() => handleMobileNav('auth')} className="w-full py-5 rounded-[2rem] bg-slate-50 text-slate-900 font-black text-lg border border-slate-100 active:scale-95 transition-transform">
                  Log In / Sign Up
                </button>
             )}
             
             <button 
                onClick={() => handleMobileNav('post')} 
                className="w-full py-6 rounded-[2rem] bg-indigo-600 text-white font-black text-xl shadow-2xl shadow-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-3"
             >
                <span>Post a Role</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
             </button>
             
             <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-6">
                CareersPal Elite Mobile
             </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;

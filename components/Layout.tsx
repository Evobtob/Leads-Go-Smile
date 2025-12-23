
import React from 'react';
import { NAVIGATION_ITEMS } from '../constants';
import { AppView } from '../types';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  title: string;
  subtitle?: string;
  currentMonthLabel: string;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeView, 
  setActiveView, 
  title, 
  subtitle, 
  currentMonthLabel,
  onPrevMonth,
  onNextMonth,
  onSync,
  isSyncing
}) => {
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white overflow-hidden relative shadow-2xl border-x border-gray-100">
      {/* iOS Header */}
      <header className="px-6 pt-12 pb-4 bg-white/80 ios-blur sticky top-0 z-50">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#2C3E50]">{title}</h1>
            {subtitle && <p className="text-[10px] font-bold tracking-widest text-[#A0AEC0] mt-1 uppercase">{subtitle}</p>}
          </div>
          <button 
            onClick={onSync}
            disabled={isSyncing}
            className="p-3 bg-white rounded-2xl shadow-lg border border-gray-100 text-[#4A5568] active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw 
              size={24} 
              className={`text-blue-500 ${isSyncing ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
        
        {activeView !== 'admin' && (
          <div className="mt-4 flex items-center justify-between bg-[#F1F4F8] px-2 py-1.5 rounded-2xl">
            <button onClick={onPrevMonth} className="p-1.5 hover:bg-white rounded-xl transition-colors">
              <ChevronLeft size={18} className="text-slate-500" />
            </button>
            <span className="text-[12px] font-bold text-[#718096] uppercase">
              {currentMonthLabel}
            </span>
            <button onClick={onNextMonth} className="p-1.5 hover:bg-white rounded-xl transition-colors">
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-6 pb-32 hide-scrollbar bg-[#F8F9FB]">
        {children}
      </main>

      {/* iOS Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 ios-blur bg-white/90 border-t border-gray-100 px-4 py-3 pb-8 z-20">
        <div className="flex justify-between items-center max-w-md mx-auto">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`flex flex-col items-center gap-1.5 transition-all duration-200 ${
                activeView === item.id ? 'text-[#2C3E50]' : 'text-[#A0AEC0]'
              }`}
            >
              <div className={`p-1 ${activeView === item.id ? 'scale-110 text-black' : 'scale-100'}`}>
                {item.icon}
              </div>
              <span className="text-[9px] font-bold tracking-wider">{item.label}</span>
              {activeView === item.id && (
                <div className="w-1 h-1 bg-black rounded-full"></div>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;

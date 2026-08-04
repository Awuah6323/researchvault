import React from 'react';
import { Home, Search, Library, Sparkles, Menu } from 'lucide-react';

export default function BottomNav({ activeTab, onNavigate, onOpenMenu }) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Library },
    { id: 'synthesis', label: 'AI Review', icon: Sparkles },
    { id: 'menu', label: 'Menu', icon: Menu, isMenuTrigger: true },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.isMenuTrigger) {
                onOpenMenu();
              } else {
                onNavigate(item.id);
              }
            }}
            className={`mobile-bottom-nav-btn ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

import React from 'react';
import { LayoutDashboard, Radio, Mic2, Sparkles, CheckSquare, Settings2 } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingSyncCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  pendingSyncCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'device', label: 'Device', icon: Radio },
    { id: 'sessions', label: 'Recordings', icon: Mic2, badge: pendingSyncCount > 0 ? pendingSyncCount : null },
    { id: 'insights', label: 'Insights', icon: Sparkles },
    { id: 'actions', label: 'Tasks', icon: CheckSquare },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <>
      {/* Tablet Sub-Nav (visible only between 640px and 900px where desktop header nav is hidden) */}
      <nav 
        className="tablet-subnav"
        style={{
          display: 'none',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '6px 16px',
        }}
      >
        <div style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 16px',
                  background: isActive ? 'var(--accent-forest)' : 'transparent',
                  border: 'none',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.84rem',
                  fontWeight: isActive ? 700 : 600,
                  borderRadius: 'var(--radius-full)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={15} color={isActive ? '#34d399' : 'currentColor'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar (< 640px) */}
      <nav 
        className="mobile-nav"
        style={{
          display: 'flex',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)',
          zIndex: 90,
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -4px 20px rgba(5, 41, 30, 0.05)',
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--accent-forest)' : 'var(--text-muted)',
                cursor: 'pointer',
                position: 'relative',
                flex: 1,
                padding: '6px 0',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? 'var(--accent-forest)' : 'currentColor'} />
                {tab.badge && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    background: '#f59e0b',
                    color: '#ffffff',
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: isActive ? 800 : 500 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 640px) and (max-width: 899px) {
          .tablet-subnav {
            display: block !important;
          }
        }
        @media (min-width: 640px) {
          .mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

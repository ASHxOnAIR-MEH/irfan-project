import React from 'react';
import { LayoutDashboard, Mic2, Sparkles, CheckSquare, Settings2 } from 'lucide-react';

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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'sessions', label: 'Sessions', icon: Mic2, badge: pendingSyncCount > 0 ? pendingSyncCount : null },
    { id: 'insights', label: 'Insights & Tasks', icon: Sparkles },
    { id: 'actions', label: 'Action Items', icon: CheckSquare },
    { id: 'settings', label: 'Settings & Privacy', icon: Settings2 },
  ];

  return (
    <>
      {/* Desktop Top Sub-Nav */}
      <nav 
        className="desktop-nav"
        style={{
          display: 'none',
          background: 'rgba(11, 15, 25, 0.7)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '4px 16px',
        }}
      >
        <div style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
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
                  padding: '8px 16px',
                  background: isActive ? 'rgba(0, 242, 254, 0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? 'var(--accent-cyan)' : 'transparent'}`,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease',
                  borderRadius: '6px 6px 0 0',
                }}
              >
                <Icon size={16} color={isActive ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    background: 'var(--accent-amber)',
                    color: '#06080d',
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

      {/* Mobile Bottom Navigation Bar */}
      <nav 
        className="mobile-nav"
        style={{
          display: 'flex',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '62px',
          background: 'rgba(6, 8, 13, 0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--border-subtle)',
          zIndex: 90,
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom)',
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
                gap: 4,
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                cursor: 'pointer',
                position: 'relative',
                flex: 1,
                padding: '6px 0',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
                {tab.badge && (
                  <span style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    background: 'var(--accent-amber)',
                    color: '#06080d',
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
              <span style={{ fontSize: '0.68rem', fontWeight: isActive ? 700 : 500 }}>
                {tab.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: block !important;
          }
          .mobile-nav {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

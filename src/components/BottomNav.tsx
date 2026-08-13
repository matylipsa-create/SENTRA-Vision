import { Chrome as Home, BookOpen, Activity, Settings as SettingsIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  active: string;
  onNavigate: (page: string) => void;
  onOpenSettings: () => void;
}

export default function BottomNav({ active, onNavigate, onOpenSettings }: Props) {
  const { state } = useApp();
  const activeEvents = state.events.filter(e => e.type === 'PERIMETER_BREACH' || e.type === 'CAMERA_OFFLINE').length;
  const pendingEvents = state.events.length;
  const cogState = state.cognitiveLoad > 70 ? 'ALTA' : state.cognitiveLoad > 50 ? 'MED' : 'BAJA';

  const items = [
    { key: 'dashboard', icon: Home, label: 'Inicio', badge: activeEvents > 0 ? String(activeEvents) : null, badgeColor: '#EF4444' },
    { key: 'regulation', icon: BookOpen, label: 'Regulacion', badge: cogState, badgeColor: cogState === 'ALTA' ? '#EF4444' : cogState === 'MED' ? '#FBBF24' : '#22C55E' },
    { key: 'operations', icon: Activity, label: 'Operaciones', badge: pendingEvents > 0 ? String(pendingEvents) : null, badgeColor: '#FBBF24' },
    { key: 'settings', icon: SettingsIcon, label: 'Config', badge: state.mode === 'technical' ? 'TEC' : 'NOR', badgeColor: '#9CA3AF' },
  ];

  return (
    <nav role="navigation" aria-label="Navegación principal" className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-1.5"
      style={{ background: 'rgba(10,12,26,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = active === item.key;
        const isSettings = item.key === 'settings';
        return (
          <button key={item.key}
            onClick={() => isSettings ? onOpenSettings() : onNavigate(item.key)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className="press-feedback relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-90"
            style={{ background: isActive ? 'rgba(251,191,36,0.1)' : 'transparent' }}>
            <Icon size={20} style={{ color: isActive ? '#FBBF24' : '#9CA3AF', transition: 'color 0.25s ease' }} aria-hidden="true" />
            <span className="text-sm font-medium" style={{ color: isActive ? '#FBBF24' : '#9CA3AF', transition: 'color 0.25s ease' }}>{item.label}</span>
            {isActive && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: '#FBBF24', animation: 'fade-in 0.2s ease-out' }} aria-hidden="true" />
            )}
            {item.badge && (
              <span className="nav-badge" style={{ background: item.badgeColor, color: '#fff' }} aria-label={`Badge: ${item.badge}`}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

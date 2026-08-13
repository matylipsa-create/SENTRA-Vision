import { Shield, ChevronDown, ChevronUp, Settings as SettingsIcon, BatteryLow } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { AlertLevel } from '../types';

const ALERT_STYLES: Record<AlertLevel, { color: string; cls: string }> = {
  SEGURO: { color: '#22C55E', cls: 'badge-safe' },
  ALERTA: { color: '#FBBF24', cls: 'badge-alert' },
  CRITICO: { color: '#EF4444', cls: 'badge-critical' },
};

interface Props {
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onOpenMetrics: () => void;
}

export default function TopBar({ onToggleMode, onOpenSettings, onOpenMetrics }: Props) {
  const { state } = useApp();
  const alert = ALERT_STYLES[state.alertLevel];
  const isTechnical = state.mode === 'technical';
  const isPowerSaving = state.settings.powerSavingMode;

  return (
    <header role="banner" className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-3 py-2.5"
      style={{ background: 'rgba(10,12,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', height: 52 }}>
      <button onClick={onOpenMetrics} aria-label="Abrir métricas del sistema" className="press-feedback flex items-center gap-2 active:scale-95 transition-all">
        <div className="relative" role="img" aria-label={`Nivel de alerta: ${state.alertLevel}`}>
          <Shield size={22} style={{ color: '#FBBF24', filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' }} aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{
            background: alert.color,
            boxShadow: `0 0 6px ${alert.color}`,
            animation: state.alertLevel === 'CRITICO' ? 'blink 0.8s ease-in-out infinite' : 'breathe 2s ease-in-out infinite',
          }} />
        </div>
        <span className="font-display font-bold text-white text-sm tracking-wide">AEGIS</span>
      </button>

      <div className="flex items-center gap-2">
        {isPowerSaving && (
          <span className="power-saving-indicator flex items-center gap-1" role="status" aria-label="Modo ahorro de energía activo">
            <BatteryLow size={14} aria-hidden="true" />
            AHORRO
          </span>
        )}

        <span className={`badge-status ${alert.cls}`} role="status" aria-label={`Estado: ${state.alertLevel}`}>
          {state.alertLevel}
        </span>

        <button onClick={onToggleMode} aria-label={`Cambiar a modo ${isTechnical ? 'normal' : 'técnico'}`}
          className="press-feedback mode-transition flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all active:scale-95"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: isTechnical ? '#FBBF24' : '#9CA3AF' }}>
            {isTechnical ? 'TECNICO' : 'NORMAL'}
          </span>
          {isTechnical ? <ChevronUp size={16} style={{ color: '#FBBF24' }} aria-hidden="true" /> : <ChevronDown size={16} style={{ color: '#9CA3AF' }} aria-hidden="true" />}
        </button>

        <button onClick={onOpenSettings} aria-label="Abrir configuración"
          className="press-feedback p-1.5 rounded-lg transition-all active:scale-90"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <SettingsIcon size={16} style={{ color: '#9CA3AF' }} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

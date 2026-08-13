import { useState } from 'react';
import { Phone, TriangleAlert as AlertTriangle, Siren } from 'lucide-react';

interface Props {
  variant: 'panic' | '911' | '107' | '103';
  onPress?: () => void;
}

const CONFIG = {
  panic: { label: 'PANICO', icon: Siren, cls: 'btn-panic', color: '#EF4444', tel: null, badge: null, ariaLabel: 'Activar botón de pánico' },
  '911': { label: 'EMERGENCIA 911', icon: Phone, cls: 'btn-emergency', color: '#F59E0B', tel: 'tel:911', badge: 'URGENTE', ariaLabel: 'Llamar al 911' },
  '107': { label: 'EMERGENCIA 107', icon: Phone, cls: 'btn-emergency-secondary', color: '#F59E0B', tel: 'tel:107', badge: null, ariaLabel: 'Llamar al 107' },
  '103': { label: 'EMERGENCIA 103', icon: Phone, cls: 'btn-emergency-secondary', color: '#F59E0B', tel: 'tel:103', badge: null, ariaLabel: 'Llamar al 103' },
} as const;

export default function EmergencyCallButtons({ variant, onPress }: Props) {
  const cfg = CONFIG[variant];
  const Icon = cfg.icon;
  const isPrimary = variant === 'panic' || variant === '911';
  const [showConfirm, setShowConfirm] = useState(false);
  const [calling, setCalling] = useState(false);

  const handleButtonClick = () => {
    if (navigator.vibrate) navigator.vibrate(30);
    if (variant === 'panic') {
      onPress?.();
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirmCall = () => {
    setCalling(true);
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    setTimeout(() => {
      setShowConfirm(false);
      setCalling(false);
      if (cfg.tel) {
        window.location.href = cfg.tel;
      }
    }, 400);
  };

  return (
    <>
      <button
        onClick={handleButtonClick}
        aria-label={cfg.ariaLabel}
        className={`press-feedback ${cfg.cls} relative flex items-center justify-center gap-2 w-full rounded-2xl py-3.5 font-semibold active:scale-95 transition-all`}
        style={{
          background: variant === 'panic' ? '#EF4444' : 'rgba(255,255,255,0.04)',
          color: variant === 'panic' ? '#fff' : cfg.color,
          fontSize: 14,
        }}
      >
        <Icon size={isPrimary ? 22 : 18} aria-hidden="true" />
        <span>{cfg.label}</span>
        {cfg.badge && (
          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-sm font-bold animate-pulse"
            style={{ background: '#DC2626', color: '#fff', border: '1px solid #FCD34D' }} role="img" aria-label={cfg.badge}>
            {cfg.badge}
          </span>
        )}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowConfirm(false)} role="presentation">
          <div role="dialog" aria-modal="true" aria-label={`Confirmar llamada al ${variant === '911' ? '911' : variant === '107' ? '107' : '103'}`}
            className="animate-scale-in w-full max-w-xs mx-4 rounded-2xl p-6 text-center"
            style={{ background: 'linear-gradient(180deg, #1A1209 0%, #0A0C12 100%)', border: '1px solid rgba(245,158,11,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '2px solid rgba(245,158,11,0.4)' }}>
              <AlertTriangle size={28} style={{ color: '#F59E0B' }} aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-white mb-1">Confirmar Llamada</h3>
            <p className="text-sm mb-1" style={{ color: '#CBD5E1' }}>
              Vas a llamar al numero de emergencia:
            </p>
            <p className="text-2xl font-bold font-mono mb-5" style={{ color: '#F59E0B' }}>
              {variant === '911' ? '911' : variant === '107' ? '107' : '103'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} aria-label="Cancelar llamada"
                className="press-feedback flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1' }}>
                Cancelar
              </button>
              <button onClick={handleConfirmCall} aria-label="Confirmar llamada"
                disabled={calling}
                className="press-feedback btn-emergency flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                {calling ? (
                  <>
                    <div className="connecting-dots" aria-hidden="true"><span /><span /><span /></div>
                    Llamando...
                  </>
                ) : (
                  <>
                    <Phone size={14} aria-hidden="true" />
                    Llamar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

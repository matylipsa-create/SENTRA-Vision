import { FlaskConical, X } from 'lucide-react';

interface Props {
  onHide: () => void;
}

export default function DemoModeBanner({ onHide }: Props) {
  return (
    <div role="status" aria-label="Modo demostración activo"
      className="fixed left-0 right-0 z-30 flex items-center justify-between px-4 py-2 animate-slide-up"
      style={{
        top: 52,
        background: 'linear-gradient(90deg, rgba(252,211,77,0.95) 0%, rgba(245,196,72,0.90) 100%)',
        borderBottom: '1px solid rgba(146,109,20,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 12px rgba(146,109,20,0.15)',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical size={16} style={{ color: '#3D2B00', flexShrink: 0 }} aria-hidden="true" />
        <span className="font-semibold truncate" style={{ color: '#3D2B00', fontSize: 14, letterSpacing: '0.02em' }}>
          MODO DEMO — Datos simulados para presentacion
        </span>
      </div>
      <button
        onClick={onHide}
        aria-label="Ocultar banner de modo demo"
        className="press-feedback flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all active:scale-95 flex-shrink-0"
        style={{ background: 'rgba(61,43,0,0.10)', border: '1px solid rgba(61,43,0,0.25)', color: '#3D2B00' }}
      >
        <X size={14} aria-hidden="true" />
        <span className="font-medium" style={{ fontSize: 14 }}>Ocultar</span>
      </button>
    </div>
  );
}

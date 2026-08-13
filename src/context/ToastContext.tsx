import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'critical';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  dismissing?: boolean;
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const PRIORITY: Record<ToastVariant, number> = {
  critical: 4,
  warning: 3,
  success: 2,
  info: 1,
};

// Fix 10: adjusted magenta to deep pink (#FF1493) for clear distinction from red (#FF2020)
const VARIANT_CONFIG: Record<ToastVariant, { color: string; icon: React.ElementType; bg: string }> = {
  info:     { color: '#6B8AD4', icon: Info,          bg: 'rgba(107, 138, 212, 0.08)' },
  success:   { color: '#4CAF50', icon: CheckCircle,   bg: 'rgba(76, 175, 80, 0.08)' },
  warning:   { color: '#D4A853', icon: AlertTriangle, bg: 'rgba(212, 168, 83, 0.08)' },
  critical:  { color: '#D94A4A', icon: XCircle,       bg: 'rgba(217, 74, 74, 0.10)' },
};

const MAX_VISIBLE = 2;
const DISPLAY_MS = 4500;
const FADE_MS = 300;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => {
      const next = [...prev, { ...t, id }];
      next.sort((a, b) => PRIORITY[b.variant] - PRIORITY[a.variant]);
      return next.slice(0, MAX_VISIBLE);
    });
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, dismissing: true } : t));
      setTimeout(() => dismiss(id), FADE_MS);
    }, DISPLAY_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="fixed top-14 right-2 left-2 sm:left-auto z-50 flex flex-col gap-2 pointer-events-none sm:max-w-sm sm:right-3"
        role="region"
        aria-live="polite"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => {
          const cfg = VARIANT_CONFIG[t.variant];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-3 rounded-warm backdrop-blur-xl transition-warm ${t.dismissing ? 'animate-toast-out' : 'animate-toast-in'}`}
              style={{
                background: `linear-gradient(145deg, ${cfg.bg}, rgba(5, 5, 16, 0.95))`,
                border: `1px solid ${cfg.color}40`,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px ${cfg.color}20`,
              }}
            >
              <div
                className="flex-shrink-0 mt-0.5"
                style={{ color: cfg.color, filter: `drop-shadow(0 0 4px ${cfg.color}80)` }}
              >
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold" style={{ color: cfg.color, fontSize: '13px' }}>{t.title}</p>
                {t.message && (
                  <p className="font-body mt-0.5 leading-relaxed" style={{ color: 'rgba(200,200,212,0.7)', fontSize: '12px' }}>{t.message}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar notificación"
                className="flex-shrink-0 transition-warm"
                style={{ color: 'rgba(200,200,212,0.4)' }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

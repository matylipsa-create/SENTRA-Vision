// src/context/ToastContext.tsx
// Sistema de notificaciones toast para Sentra Core
// Feedback visual y accesible para eventos del sistema

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'ethics' | 'tracing';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // ms
  timestamp: number;
  actions?: ToastAction[];
  persistent?: boolean;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}

export interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  showToastWithActions: (message: string, type: ToastType, actions: ToastAction[], duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  showInfo: (message: string, duration?: number) => string;
  showSuccess: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showEthics: (message: string, duration?: number) => string;
  showTracing: (message: string, duration?: number) => string;
}

// ============================================================
// 2. CONTEXTO
// ============================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================
// 3. PROPS
// ============================================================

interface ToastProviderProps {
  children: React.ReactNode;
  defaultDuration?: number;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

// ============================================================
// 4. COMPONENTE PROVIDER
// ============================================================

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 4000,
  maxToasts = 5,
  position = 'bottom-center'
}) => {
  // ============================================================
  // 5. ESTADO
  // ============================================================

  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ============================================================
  // 6. FUNCIONES
  // ============================================================

  const generateId = (): string => {
    return `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  };

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => {
      const filtered = prev.filter((toast) => toast.id !== id);
      // Limpiar el timer si existe
      if (timersRef.current.has(id)) {
        clearTimeout(timersRef.current.get(id));
        timersRef.current.delete(id);
      }
      return filtered;
    });
  }, []);

  const showToastWithActions = useCallback((
    message: string,
    type: ToastType = 'info',
    actions: ToastAction[] = [],
    duration: number = defaultDuration
  ): string => {
    const id = generateId();

    // Limitar el número de toasts
    setToasts((prev) => {
      const newToasts = [{ id, message, type, duration, timestamp: Date.now(), actions }, ...prev];
      return newToasts.slice(0, maxToasts);
    });

    // Auto-remover después de la duración
    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [defaultDuration, maxToasts, removeToast]);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = defaultDuration
  ): string => {
    return showToastWithActions(message, type, [], duration);
  }, [defaultDuration, showToastWithActions]);

  const clearToasts = useCallback(() => {
    // Limpiar todos los timers
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  // ============================================================
  // 7. FUNCIONES DE TIPO
  // ============================================================

  const showInfo = useCallback((message: string, duration?: number) => {
    return showToast(message, 'info', duration);
  }, [showToast]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    return showToast(message, 'success', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    return showToast(message, 'warning', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    return showToast(message, 'error', duration);
  }, [showToast]);

  const showEthics = useCallback((message: string, duration?: number) => {
    return showToast(message, 'ethics', duration || 5000);
  }, [showToast]);

  const showTracing = useCallback((message: string, duration?: number) => {
    return showToast(message, 'tracing', duration || 3000);
  }, [showToast]);

  // ============================================================
  // 8. LIMPIEZA
  // ============================================================

  useEffect(() => {
    return () => {
      clearToasts();
    };
  }, [clearToasts]);

  // ============================================================
  // 9. VALOR DEL CONTEXTO
  // ============================================================

  const contextValue: ToastContextValue = {
    toasts,
    showToast,
    showToastWithActions,
    removeToast,
    clearToasts,
    showInfo,
    showSuccess,
    showWarning,
    showError,
    showEthics,
    showTracing,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Renderizar toasts */}
      <div className={`toast-container ${position}`}>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============================================================
// 10. COMPONENTE TOAST ITEM
// ============================================================

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 10);

    // Animación de salida antes de remover
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onRemove(toast.id);
        }, 300);
      }, toast.duration - 300);
      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getIcon = (type: ToastType): string => {
    switch (type) {
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'ethics': return '🛡️';
      case 'tracing': return '🔗';
      default: return 'ℹ️';
    }
  };

  const getClassName = (type: ToastType): string => {
    return `toast-item ${type} ${isVisible ? 'visible' : 'hidden'}`;
  };

  return (
    <div
      className={getClassName(toast.type)}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="toast-content">
        <span className="toast-icon">{getIcon(toast.type)}</span>
        <span className="toast-message">{toast.message}</span>
      </div>
      
      {toast.actions && toast.actions.length > 0 && (
        <div className="toast-actions">
          {toast.actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              aria-label={action.ariaLabel || action.label}
              className="toast-action"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      
      <button
        className="toast-close"
        onClick={handleClose}
        aria-label="Cerrar notificación"
      >
        ✕
      </button>
    </div>
  );
};

// ============================================================
// 11. HOOK PERSONALIZADO
// ============================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return context;
}

// ============================================================
// 12. EXPORTACIÓN POR DEFECTO
// ============================================================

export default ToastContext;

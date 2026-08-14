import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useRealModeSensors } from '../hooks/useRealModeSensors';

/**
 * AccessibleMinimalUI
 *
 * - Single big toggle button: Activar / Desactivar
 * - Status indicator: Audio Activo / Inactivo
 * - TalkBack friendly: aria-live regions, aria-pressed, role="main"
 * - Minimal dark, high-contrast styling
 *
 * Assumptions:
 * - useRealModeSensors() reads state.settings.realMode and starts/stops sensors/voice accordingly.
 * - updateSettings is used to toggle realMode.
 */
export default function AccessibleMinimalUI(): JSX.Element {
  const { state, updateSettings } = useApp();
  // Ensure the real-mode sensors hook is mounted so it responds to realMode changes.
  // We don't need setVideo here, but calling the hook makes the side effects active.
  useRealModeSensors();

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const realMode = !!state.settings.realMode;
  const audioStatus = realMode ? 'Activo' : 'Inactivo';
  const ariaStatus = `Audio ${audioStatus}`;

  // toggle function
  const toggle = () => {
    updateSettings({ realMode: !realMode });
    // immediate audio feedback using SpeechSynthesis (short confirmation)
    try {
      if ('speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(realMode ? 'Desactivando' : 'Activando');
        utter.lang = 'es-ES';
        utter.rate = 1;
        window.speechSynthesis.cancel(); // avoid overlap
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // no-op fallback
    }
    // focus back to button for screen reader users
    setTimeout(() => btnRef.current?.focus(), 200);
  };

  // focus button on mount to help keyboard / screen reader users
  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <main
      role="main"
      aria-label="Interfaz de accesibilidad mínima de SENTRA Vision"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: '#FFFFFF',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 20,
        }}
      >
        {/* Status region */}
        <div
          aria-live="polite"
          aria-atomic="true"
          style={{
            textAlign: 'center',
            fontSize: 20,
            fontWeight: 700,
            color: '#FDE047', // yellow for high contrast
          }}
        >
          {ariaStatus}
        </div>

        {/* Big toggle button */}
        <button
          ref={btnRef}
          onClick={toggle}
          aria-pressed={realMode}
          aria-label={realMode ? 'Desactivar describir entorno' : 'Activar describir entorno'}
          style={{
            all: 'unset',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: realMode ? '#DC2626' : '#FBBF24', // red when active, yellow when inactive
            color: '#000',
            borderRadius: 16,
            height: 160,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.6)',
            userSelect: 'none',
          }}
        >
          <span
            style={{
              fontSize: 36,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {realMode ? 'Desactivar' : 'Activar'}
          </span>
        </button>

        {/* Help / hint for screen reader users, visible to everyone */}
        <div
          aria-hidden="false"
          style={{
            textAlign: 'center',
            fontSize: 16,
            color: '#E5E7EB',
            opacity: 0.9,
          }}
        >
          Presione el botón para {realMode ? 'detener la descripción' : 'comenzar a describir el entorno'}.
        </div>

        {/* Hidden but live region for assertive announcements (e.g., long messages) */}
        <div
          id="a11y-announcer"
          aria-live="assertive"
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden',
          }}
        />
      </div>
    </main>
  );
}

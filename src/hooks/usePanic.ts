import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { sendEvent } from '../lib/pipedream';
import type { SecurityEvent } from '../types';

export function usePanic() {
  const { state, addEvent, signAndChain, setAlertLevel, setStatus, incrementTelegramCount, markEventTelegramSent } = useApp();
  const [panicActive, setPanicActive] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const triggerPanic = useCallback(async () => {
    setPanicActive(true);
    setStatus('ARMADO');
    setAlertLevel('CRITICO');

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }

    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch { /* noop */ }

    const lat = state.sensors.gpsLat ?? -34.6037;
    const lng = state.sensors.gpsLng ?? -58.3816;

    const baseEvent = {
      id: `panic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'PANIC_ALERT',
      timestamp: Date.now(),
      lat,
      lng,
      metadata: {
        source: state.settings.realMode ? 'real-panic' : 'demo-panic',
        trigger: 'manual',
        gpsAccuracy: state.sensors.gpsActive ? 'high' : 'fallback',
      },
      demo: !state.settings.realMode,
    };

    const event: SecurityEvent = await signAndChain(baseEvent);
    addEvent(event);

    if (!event.cryptoVerified) {
      setAlertLevel('CRITICO');
    }

    if (state.settings.sendDemoToTelegram) {
      const ok = await sendEvent(event);
      if (ok) {
        incrementTelegramCount();
        markEventTelegramSent(event.id);
      }
    }

    setTimeout(() => setPanicActive(false), 3000);
  }, [state.settings, state.sensors, addEvent, signAndChain, setAlertLevel, setStatus, incrementTelegramCount, markEventTelegramSent]);

  return { panicActive, triggerPanic };
}

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { AppState, AppSettings, SensorState, DetectedObject, SecurityEvent, AlertLevel, SystemStatus, AppMode } from '../types';
import { signAndChain as cryptoSignAndChain, initDilithium, getGenesisHash } from '../lib/crypto';

const SETTINGS_KEY = 'sentra-vision-settings';

const defaults: AppSettings = {
  realMode: false,
  powerSavingMode: false,
  pipedreamWebhookUrl: '',
  sendDemoToTelegram: false,
};

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* noop */ }
  return defaults;
}

function saveSettings(s: AppSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

const initialSensors: SensorState = {
  cameraActive: false,
  audioActive: false,
  gpsActive: false,
  gpsLat: null,
  gpsLng: null,
  cameraError: null,
  audioError: null,
  gpsError: null,
  audioLevel: 0,
};

const initialModules = [
  { key: 'CAM', label: 'Vision', active: true, loaded: true },
  { key: 'AUDIO', label: 'Audio', active: true, loaded: true },
  { key: 'GPS', label: 'GPS', active: true, loaded: true },
  { key: 'IA', label: 'Crypto', active: true, loaded: true },
  { key: 'IDB', label: 'IndexedDB', active: true, loaded: true },
  { key: 'FIFO', label: 'FIFO', active: true, loaded: true },
];

const initialCameras = [
  { id: 'cam-1', label: 'Camara 1', type: 'CAM' as const, status: 'active' as const },
  { id: 'ip-1', label: 'IP Cam', type: 'IP' as const, status: 'standby' as const },
  { id: 'ptz-1', label: 'PTZ', type: 'PTZ' as const, status: 'standby' as const },
  { id: 'vision-1', label: 'Vision AI', type: 'VISION' as const, status: 'active' as const },
];

const initialState: AppState = {
  mode: 'normal',
  status: 'STANDBY',
  alertLevel: 'SEGURO',
  confidence: 92,
  cognitiveLoad: 35,
  events: [],
  modules: initialModules,
  cameras: initialCameras,
  settings: loadSettings(),
  telegramSentCount: 0,
  demoMode: false,
  sensors: initialSensors,
  detectedObjects: [],
  audioAlerts: [],
  tfjsLoaded: false,
  tfjsError: false,
};

interface AppContextValue {
  state: AppState;
  updateSettings: (s: Partial<AppSettings>) => void;
  setSensors: (patch: Partial<SensorState>) => void;
  setDetectedObjects: (objects: DetectedObject[]) => void;
  setTfjsStatus: (loaded: boolean, error: boolean) => void;
  setMode: (mode: AppMode) => void;
  setDemoMode: (demo: boolean) => void;
  setStatus: (status: SystemStatus) => void;
  setAlertLevel: (level: AlertLevel) => void;
  setConfidence: (v: number) => void;
  setCognitiveLoad: (v: number) => void;
  addEvent: (event: SecurityEvent) => void;
  signAndChain: (baseEvent: Omit<SecurityEvent, 'hash' | 'previousHash' | 'signature' | 'cryptoVerified'>) => Promise<SecurityEvent>;
  incrementTelegramCount: () => void;
  markEventTelegramSent: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    ...initialState,
    settings: loadSettings(),
  }));

  const lastHashRef = useRef<string>(getGenesisHash());

  useEffect(() => {
    initDilithium().catch(() => { /* noop */ });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => setState(s => {
    const settings = { ...s.settings, ...patch };
    saveSettings(settings);
    return { ...s, settings };
  }), []);

  const setSensors = useCallback((patch: Partial<SensorState>) => setState(s => ({ ...s, sensors: { ...s.sensors, ...patch } })), []);
  const setDetectedObjects = useCallback((detectedObjects: DetectedObject[]) => setState(s => ({ ...s, detectedObjects })), []);
  const setTfjsStatus = useCallback((loaded: boolean, error: boolean) => setState(s => ({ ...s, tfjsLoaded: loaded, tfjsError: error })), []);
  const setMode = useCallback((mode: AppMode) => setState(s => ({ ...s, mode })), []);
  const setDemoMode = useCallback((demoMode: boolean) => setState(s => ({ ...s, demoMode })), []);
  const setStatus = useCallback((status: SystemStatus) => setState(s => ({ ...s, status })), []);
  const setAlertLevel = useCallback((alertLevel: AlertLevel) => setState(s => ({ ...s, alertLevel })), []);
  const setConfidence = useCallback((confidence: number) => setState(s => ({ ...s, confidence })), []);
  const setCognitiveLoad = useCallback((cognitiveLoad: number) => setState(s => ({ ...s, cognitiveLoad })), []);

  const addEvent = useCallback((event: SecurityEvent) => setState(s => ({ ...s, events: [event, ...s.events].slice(0, 100) })), []);

  const signAndChain = useCallback(async (baseEvent: Omit<SecurityEvent, 'hash' | 'previousHash' | 'signature' | 'cryptoVerified'>): Promise<SecurityEvent> => {
    const previousHash = lastHashRef.current;
    const result = await cryptoSignAndChain(baseEvent, previousHash);
    lastHashRef.current = result.hash;
    return { ...baseEvent, ...result };
  }, []);

  const incrementTelegramCount = useCallback(() => setState(s => ({ ...s, telegramSentCount: s.telegramSentCount + 1 })), []);

  const markEventTelegramSent = useCallback((id: string) => setState(s => ({
    ...s,
    events: s.events.map(e => e.id === id ? { ...e, telegramSent: true } : e),
  })), []);

  return (
    <AppContext.Provider value={{
      state,
      updateSettings,
      setSensors,
      setDetectedObjects,
      setTfjsStatus,
      setMode,
      setDemoMode,
      setStatus,
      setAlertLevel,
      setConfidence,
      setCognitiveLoad,
      addEvent,
      signAndChain,
      incrementTelegramCount,
      markEventTelegramSent,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

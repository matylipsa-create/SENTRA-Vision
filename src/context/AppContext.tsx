import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { AppState, AppSettings, SensorState, DetectedObject } from '../types';

const SETTINGS_KEY = 'sentra-vision-settings';

const defaults: AppSettings = {
  realMode: false,
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

const initialState: AppState = {
  mode: 'normal',
  status: 'STANDBY',
  alertLevel: 'SEGURO',
  confidence: 92,
  cognitiveLoad: 35,
  events: [],
  modules: [],
  cameras: [],
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
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    ...initialState,
    settings: loadSettings(),
  }));

  const updateSettings = useCallback((patch: Partial<AppSettings>) => setState(s => {
    const settings = { ...s.settings, ...patch };
    saveSettings(settings);
    return { ...s, settings };
  }), []);

  const setSensors = useCallback((patch: Partial<SensorState>) => setState(s => ({ ...s, sensors: { ...s.sensors, ...patch } })), []);
  const setDetectedObjects = useCallback((detectedObjects: DetectedObject[]) => setState(s => ({ ...s, detectedObjects })), []);
  const setTfjsStatus = useCallback((loaded: boolean, error: boolean) => setState(s => ({ ...s, tfjsLoaded: loaded, tfjsError: error })), []);

  return (
    <AppContext.Provider value={{ state, updateSettings, setSensors, setDetectedObjects, setTfjsStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

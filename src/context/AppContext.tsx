import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import type { AppState, AppMode, SystemStatus, AlertLevel, SecurityEvent, AppSettings, ModuleState, CameraState, SensorState, PageKey, DetectedObject, AudioAlert } from '../types';
import { getGenesisHash, initDilithium, signAndChain as cryptoSignAndChain, type CryptoResult } from '../lib/crypto';
import { setWebhookUrl } from '../lib/pipedream';

const DEMO_KEY = 'aegis-demo-mode';
const SETTINGS_KEY = 'aegis-settings';

const defaults: AppSettings = {
  pipedreamWebhookUrl: '',
  sendDemoToTelegram: true,
  powerSavingMode: false,
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

function checkDemoMode(): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('demo') === 'true') {
      localStorage.setItem(DEMO_KEY, 'true');
      return true;
    }
    return localStorage.getItem(DEMO_KEY) === 'true';
  } catch {
    return false;
  }
}

function buildModules(mode: AppMode, powerSaving: boolean): ModuleState[] {
  if (powerSaving) {
    return [
      { key: 'CAM', label: 'Camaras', active: false, loaded: false },
      { key: 'AUDIO', label: 'Audio', active: false, loaded: false },
      { key: 'GPS', label: 'GPS', active: true, loaded: true },
      { key: 'IA', label: 'IA', active: false, loaded: false },
      { key: 'IDB', label: 'IndexedDB', active: true, loaded: true },
      { key: 'FIFO', label: 'FIFO Queue', active: true, loaded: true },
    ];
  }
  if (mode === 'normal') {
    return [
      { key: 'CAM', label: 'Camaras', active: true, loaded: true },
      { key: 'AUDIO', label: 'Audio (pasivo)', active: true, loaded: true },
      { key: 'GPS', label: 'GPS', active: true, loaded: true },
      { key: 'IA', label: 'IA', active: false, loaded: false },
      { key: 'IDB', label: 'IndexedDB', active: true, loaded: true },
      { key: 'FIFO', label: 'FIFO Queue', active: true, loaded: true },
    ];
  }
  return [
    { key: 'CAM', label: 'Camaras', active: true, loaded: true },
    { key: 'AUDIO', label: 'Audio', active: true, loaded: true },
    { key: 'GPS', label: 'GPS', active: true, loaded: true },
    { key: 'IA', label: 'IA', active: true, loaded: true },
    { key: 'IDB', label: 'IndexedDB', active: true, loaded: true },
    { key: 'FIFO', label: 'FIFO Queue', active: true, loaded: true },
  ];
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
  modules: buildModules('normal', false),
  cameras: [
    { id: 'cam-01', label: 'Camara Frontal', type: 'CAM', status: 'active' },
    { id: 'cam-02', label: 'Camara Trasera', type: 'CAM', status: 'active' },
    { id: 'ip-01', label: 'IP Perimetro', type: 'IP', status: 'active' },
    { id: 'ptz-01', label: 'PTZ Patio', type: 'PTZ', status: 'standby' },
    { id: 'vis-01', label: 'Vision IA', type: 'VISION', status: 'standby' },
  ],
  settings: loadSettings(),
  telegramSentCount: 0,
  demoMode: false,
  sensors: initialSensors,
  detectedObjects: [],
  audioAlerts: [],
  tfjsLoaded: false,
  tfjsError: false,
};

export type CameraStateStatus = 'active' | 'fail' | 'connecting' | 'standby' | 'unavailable';

interface AppContextValue {
  state: AppState;
  setMode: (m: AppMode) => void;
  setStatus: (s: SystemStatus) => void;
  setAlertLevel: (a: AlertLevel) => void;
  addEvent: (e: SecurityEvent) => void;
  signAndChain: (event: Omit<SecurityEvent, 'hash' | 'previousHash' | 'signature' | 'cryptoVerified' | 'telegramSent'>) => Promise<SecurityEvent>;
  updateModule: (key: string, patch: Partial<Pick<ModuleState, 'active' | 'loaded'>>) => void;
  updateCamera: (id: string, patch: Partial<Pick<CameraState, 'status'>>) => void;
  updateSettings: (s: Partial<AppSettings>) => void;
  incrementTelegramCount: () => void;
  markEventTelegramSent: (id: string) => void;
  setConfidence: (n: number) => void;
  setCognitiveLoad: (n: number) => void;
  setDemoMode: (v: boolean) => void;
  setSensors: (patch: Partial<SensorState>) => void;
  setDetectedObjects: (objects: DetectedObject[]) => void;
  addAudioAlert: (alert: AudioAlert) => void;
  setTfjsStatus: (loaded: boolean, error: boolean) => void;
  currentPage: PageKey;
  setCurrentPage: (p: PageKey) => void;
  isWorkerActive: (workerType: 'ia' | 'vision') => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({
    ...initialState,
    demoMode: checkDemoMode(),
    modules: buildModules(initialState.mode, loadSettings().powerSavingMode),
  }));
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');
  const lastHashRef = useRef<string>(getGenesisHash());

  useEffect(() => { initDilithium(); }, []);

  const setMode = useCallback((mode: AppMode) => setState(s => ({
    ...s,
    mode,
    modules: buildModules(mode, s.settings.powerSavingMode),
  })), []);

  const setStatus = useCallback((status: SystemStatus) => setState(s => ({ ...s, status })), []);
  const setAlertLevel = useCallback((alertLevel: AlertLevel) => setState(s => ({ ...s, alertLevel })), []);
  const setConfidence = useCallback((confidence: number) => setState(s => ({ ...s, confidence })), []);
  const setCognitiveLoad = useCallback((cognitiveLoad: number) => setState(s => ({ ...s, cognitiveLoad })), []);
  const setDemoMode = useCallback((demoMode: boolean) => setState(s => ({ ...s, demoMode })), []);
  const setSensors = useCallback((patch: Partial<SensorState>) => setState(s => ({ ...s, sensors: { ...s.sensors, ...patch } })), []);
  const setDetectedObjects = useCallback((detectedObjects: DetectedObject[]) => setState(s => ({ ...s, detectedObjects })), []);
  const addAudioAlert = useCallback((alert: AudioAlert) => setState(s => ({ ...s, audioAlerts: [alert, ...s.audioAlerts].slice(0, 20) })), []);
  const setTfjsStatus = useCallback((loaded: boolean, error: boolean) => setState(s => ({ ...s, tfjsLoaded: loaded, tfjsError: error })), []);

  const addEvent = useCallback((e: SecurityEvent) => setState(s => {
    lastHashRef.current = e.hash;
    return { ...s, events: [e, ...s.events].slice(0, 50) };
  }), []);

  const signAndChain = useCallback(async (
    event: Omit<SecurityEvent, 'hash' | 'previousHash' | 'signature' | 'cryptoVerified' | 'telegramSent'>,
  ): Promise<SecurityEvent> => {
    const previousHash = lastHashRef.current || getGenesisHash();
    const result: CryptoResult = await cryptoSignAndChain(event, previousHash);
    return {
      ...event,
      hash: result.hash,
      previousHash: result.previousHash,
      signature: result.signature,
      cryptoVerified: result.cryptoVerified,
    };
  }, []);

  const updateModule = useCallback((key: string, patch: Partial<{ active: boolean; loaded: boolean }>) =>
    setState(s => ({ ...s, modules: s.modules.map(m => m.key === key ? { ...m, ...patch } : m) })), []);

  const updateCamera = useCallback((id: string, patch: Partial<{ status: CameraStateStatus }>) =>
    setState(s => ({ ...s, cameras: s.cameras.map(c => c.id === id ? { ...c, ...patch } : c) })), []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => setState(s => {
    if (patch.pipedreamWebhookUrl !== undefined) setWebhookUrl(patch.pipedreamWebhookUrl);
    const settings = { ...s.settings, ...patch };
    saveSettings(settings);
    const modules = patch.powerSavingMode !== undefined
      ? buildModules(s.mode, patch.powerSavingMode)
      : s.modules;
    return { ...s, settings, modules };
  }), []);

  const incrementTelegramCount = useCallback(() => setState(s => ({ ...s, telegramSentCount: s.telegramSentCount + 1 })), []);

  const markEventTelegramSent = useCallback((id: string) => setState(s => ({
    ...s,
    events: s.events.map(e => e.id === id ? { ...e, telegramSent: true } : e),
  })), []);

  const isWorkerActive = useCallback((workerType: 'ia' | 'vision'): boolean => {
    if (state.settings.powerSavingMode) return false;
    if (state.mode === 'normal') return false;
    if (currentPage !== 'operations') return false;
    if (workerType === 'ia') return state.modules.some(m => m.key === 'IA' && m.active);
    if (workerType === 'vision') return state.modules.some(m => m.key === 'CAM' && m.active);
    return false;
  }, [state.settings.powerSavingMode, state.mode, currentPage, state.modules]);

  return (
    <AppContext.Provider value={{
      state, setMode, setStatus, setAlertLevel, addEvent, signAndChain, updateModule,
      updateCamera, updateSettings, incrementTelegramCount, markEventTelegramSent, setConfidence, setCognitiveLoad, setDemoMode, setSensors, setDetectedObjects, addAudioAlert, setTfjsStatus,
      currentPage, setCurrentPage, isWorkerActive,
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

export { DEMO_KEY, getGenesisHash };

// src/context/AppContext.tsx
// Contexto global para Sentra Core — Estado compartido entre componentes
// Provee acceso a EVOLIS, MoralNode, percepción y configuración del sistema

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { evolis, EVOLISStats } from '../core/EVOLIS';
import { moralNode, MoralDecision } from '../core/MoralNode';
import { geminiService } from '../services/GeminiService';
import { tcreiBridge } from '../core/TCREIBridge';

// ============================================================
// 1. TIPOS E INTERFACES
// ============================================================

export interface AppState {
  // Estado del sistema
  isActive: boolean;
  isInitialized: boolean;
  isModelLoading: boolean;
  isModelLoaded: boolean;
  
  // Percepción
  detections: Array<{ class: string; confidence: number; bbox: number[] }>;
  filteredDetections: Array<{ class: string; confidence: number; bbox: number[] }>;
  detectionCount: number;
  fps: number;
  
  // Ética (MoralNode)
  ethicalFilterActive: boolean;
  isVetoRequired: boolean;
  lastVetoDecision: string | null;
  moralLog: MoralDecision[];
  
  // Trazabilidad (EVOLIS)
  chainVerified: boolean;
  eventCount: number;
  evolisStats: EVOLISStats | null;
  
  // Voz y accesibilidad
  voiceEnabled: boolean;
  hapticEnabled: boolean;
  isSpeaking: boolean;
  
  // Estado de cámara
  cameraStatus: 'INACTIVA' | 'ACTIVA' | 'ERROR' | 'INICIANDO';
  cameraError: string | null;
  
  // Gemini
  geminiStatus: {
    useMock: boolean;
    hasApiKey: boolean;
    model: string;
  };
  
  // Sistema
  networkStatus: 'online' | 'offline' | 'unknown';
  lastUpdated: number;
}

// ============================================================
// 2. ACCIONES
// ============================================================

type AppAction =
  | { type: 'SET_ACTIVE'; payload: boolean }
  | { type: 'SET_INITIALIZED' }
  | { type: 'SET_MODEL_LOADING'; payload: boolean }
  | { type: 'SET_MODEL_LOADED'; payload: boolean }
  | { type: 'SET_DETECTIONS'; payload: { detections: any[]; filteredDetections: any[]; count: number } }
  | { type: 'SET_FPS'; payload: number }
  | { type: 'SET_ETHICAL_FILTER'; payload: boolean }
  | { type: 'SET_VETO_REQUIRED'; payload: { required: boolean; reason: string | null } }
  | { type: 'SET_MORAL_LOG'; payload: MoralDecision[] }
  | { type: 'SET_CHAIN_VERIFIED'; payload: boolean }
  | { type: 'SET_EVENT_COUNT'; payload: number }
  | { type: 'SET_EVOLIS_STATS'; payload: EVOLISStats | null }
  | { type: 'SET_VOICE_ENABLED'; payload: boolean }
  | { type: 'SET_HAPTIC_ENABLED'; payload: boolean }
  | { type: 'SET_IS_SPEAKING'; payload: boolean }
  | { type: 'SET_CAMERA_STATUS'; payload: 'INACTIVA' | 'ACTIVA' | 'ERROR' | 'INICIANDO' }
  | { type: 'SET_CAMERA_ERROR'; payload: string | null }
  | { type: 'SET_GEMINI_STATUS'; payload: { useMock: boolean; hasApiKey: boolean; model: string } }
  | { type: 'SET_NETWORK_STATUS'; payload: 'online' | 'offline' | 'unknown' }
  | { type: 'UPDATE_TIMESTAMP' };

// ============================================================
// 3. ESTADO INICIAL
// ============================================================

const initialState: AppState = {
  isActive: false,
  isInitialized: false,
  isModelLoading: false,
  isModelLoaded: false,
  detections: [],
  filteredDetections: [],
  detectionCount: 0,
  fps: 0,
  ethicalFilterActive: true,
  isVetoRequired: false,
  lastVetoDecision: null,
  moralLog: [],
  chainVerified: true,
  eventCount: 0,
  evolisStats: null,
  voiceEnabled: true,
  hapticEnabled: true,
  isSpeaking: false,
  cameraStatus: 'INACTIVA',
  cameraError: null,
  geminiStatus: {
    useMock: true,
    hasApiKey: false,
    model: 'gemini-1.5-flash'
  },
  networkStatus: navigator.onLine ? 'online' : 'offline',
  lastUpdated: Date.now()
};

// ============================================================
// 4. REDUCTOR
// ============================================================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, isActive: action.payload, lastUpdated: Date.now() };
      
    case 'SET_INITIALIZED':
      return { ...state, isInitialized: true };
      
    case 'SET_MODEL_LOADING':
      return { ...state, isModelLoading: action.payload };
      
    case 'SET_MODEL_LOADED':
      return { ...state, isModelLoaded: action.payload, isModelLoading: false };
      
    case 'SET_DETECTIONS':
      return {
        ...state,
        detections: action.payload.detections,
        filteredDetections: action.payload.filteredDetections,
        detectionCount: action.payload.count,
        lastUpdated: Date.now()
      };
      
    case 'SET_FPS':
      return { ...state, fps: action.payload };
      
    case 'SET_ETHICAL_FILTER':
      return { ...state, ethicalFilterActive: action.payload };
      
    case 'SET_VETO_REQUIRED':
      return {
        ...state,
        isVetoRequired: action.payload.required,
        lastVetoDecision: action.payload.reason
      };
      
    case 'SET_MORAL_LOG':
      return { ...state, moralLog: action.payload };
      
    case 'SET_CHAIN_VERIFIED':
      return { ...state, chainVerified: action.payload };
      
    case 'SET_EVENT_COUNT':
      return { ...state, eventCount: action.payload };
      
    case 'SET_EVOLIS_STATS':
      return { ...state, evolisStats: action.payload };
      
    case 'SET_VOICE_ENABLED':
      return { ...state, voiceEnabled: action.payload };
      
    case 'SET_HAPTIC_ENABLED':
      return { ...state, hapticEnabled: action.payload };
      
    case 'SET_IS_SPEAKING':
      return { ...state, isSpeaking: action.payload };
      
    case 'SET_CAMERA_STATUS':
      return { ...state, cameraStatus: action.payload };
      
    case 'SET_CAMERA_ERROR':
      return { ...state, cameraError: action.payload };
      
    case 'SET_GEMINI_STATUS':
      return { ...state, geminiStatus: action.payload };
      
    case 'SET_NETWORK_STATUS':
      return { ...state, networkStatus: action.payload };
      
    case 'UPDATE_TIMESTAMP':
      return { ...state, lastUpdated: Date.now() };
      
    default:
      return state;
  }
}

// ============================================================
// 5. CONTEXTO
// ============================================================

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  
  // Acciones de conveniencia
  activate: () => void;
  deactivate: () => void;
  toggle: () => void;
  toggleVoice: () => void;
  toggleHaptic: () => void;
  toggleEthics: () => void;
  updateDetections: (detections: any[], filtered: any[]) => void;
  updateFPS: (fps: number) => void;
  refreshStats: () => void;
  reset: () => void;
  
  // Acceso directo a servicios
  evolis: typeof evolis;
  moralNode: typeof moralNode;
  geminiService: typeof geminiService;
  tcreiBridge: typeof tcreiBridge;
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================
// 6. PROVEEDOR
// ============================================================

interface AppProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<AppState>;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children, initialConfig = {} }) => {
  const [state, dispatch] = useReducer(
    appReducer,
    { ...initialState, ...initialConfig }
  );

  const isInitializedRef = useRef(false);

  // ============================================================
  // 7. ACCIONES DE CONVENIENCIA
  // ============================================================

  const activate = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE', payload: true });
  }, []);

  const deactivate = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE', payload: false });
  }, []);

  const toggle = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE', payload: !state.isActive });
  }, [state.isActive]);

  const toggleVoice = useCallback(() => {
    dispatch({ type: 'SET_VOICE_ENABLED', payload: !state.voiceEnabled });
  }, [state.voiceEnabled]);

  const toggleHaptic = useCallback(() => {
    dispatch({ type: 'SET_HAPTIC_ENABLED', payload: !state.hapticEnabled });
  }, [state.hapticEnabled]);

  const toggleEthics = useCallback(() => {
    dispatch({ type: 'SET_ETHICAL_FILTER', payload: !state.ethicalFilterActive });
  }, [state.ethicalFilterActive]);

  const updateDetections = useCallback((detections: any[], filtered: any[]) => {
    dispatch({
      type: 'SET_DETECTIONS',
      payload: {
        detections,
        filteredDetections: filtered,
        count: filtered.length
      }
    });
  }, []);

  const updateFPS = useCallback((fps: number) => {
    dispatch({ type: 'SET_FPS', payload: fps });
  }, []);

  const refreshStats = useCallback(() => {
    const stats = evolis.getStats();
    dispatch({ type: 'SET_EVOLIS_STATS', payload: stats });
    dispatch({ type: 'SET_EVENT_COUNT', payload: stats.totalEvents });
    dispatch({ type: 'SET_CHAIN_VERIFIED', payload: stats.chainVerified });

    const moralLog = moralNode.getLog();
    dispatch({ type: 'SET_MORAL_LOG', payload: moralLog });

    const geminiStatus = geminiService.getStatus();
    dispatch({ type: 'SET_GEMINI_STATUS', payload: geminiStatus });
  }, []);

  const reset = useCallback(() => {
    evolis.clearChain();
    moralNode.clearLog();
    dispatch({ type: 'SET_ACTIVE', payload: false });
    dispatch({ type: 'SET_DETECTIONS', payload: { detections: [], filteredDetections: [], count: 0 } });
    dispatch({ type: 'SET_EVENT_COUNT', payload: 0 });
    dispatch({ type: 'SET_EVOLIS_STATS', payload: null });
    dispatch({ type: 'SET_MORAL_LOG', payload: [] });
  }, []);

  // ============================================================
  // 8. INICIALIZACIÓN
  // ============================================================

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      dispatch({ type: 'SET_INITIALIZED' });
      refreshStats();
    }
  }, [refreshStats]);

  // Escuchar cambios de red
  useEffect(() => {
    const handleOnline = () => {
      dispatch({ type: 'SET_NETWORK_STATUS', payload: 'online' });
    };
    const handleOffline = () => {
      dispatch({ type: 'SET_NETWORK_STATUS', payload: 'offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ============================================================
  // 9. VALOR DEL CONTEXTO
  // ============================================================

  const contextValue: AppContextValue = {
    state,
    dispatch,
    activate,
    deactivate,
    toggle,
    toggleVoice,
    toggleHaptic,
    toggleEthics,
    updateDetections,
    updateFPS,
    refreshStats,
    reset,
    evolis,
    moralNode,
    geminiService,
    tcreiBridge
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// ============================================================
// 10. HOOK PERSONALIZADO
// ============================================================

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext debe usarse dentro de AppProvider');
  }
  return context;
}

// ============================================================
// 11. EXPORTACIÓN POR DEFECTO
// ============================================================

export default AppContext;

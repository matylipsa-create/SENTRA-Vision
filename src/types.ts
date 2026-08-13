export type AppMode = 'normal' | 'technical';
export type SystemStatus = 'ARMADO' | 'DESARMADO' | 'STANDBY';
export type AlertLevel = 'SEGURO' | 'ALERTA' | 'CRITICO';

export interface SecurityEvent {
  id: string;
  type: string;
  timestamp: number;
  lat: number;
  lng: number;
  hash: string;
  previousHash: string;
  signature: string;
  cryptoVerified: boolean;
  metadata: Record<string, unknown>;
  demo: boolean;
  telegramSent?: boolean;
}

export interface ModuleState {
  key: string;
  label: string;
  active: boolean;
  loaded: boolean;
}

export interface CameraState {
  id: string;
  label: string;
  type: 'CAM' | 'IP' | 'PTZ' | 'VISION';
  status: 'active' | 'fail' | 'connecting' | 'standby' | 'unavailable';
}

export interface AppSettings {
  pipedreamWebhookUrl: string;
  sendDemoToTelegram: boolean;
  powerSavingMode: boolean;
  realMode: boolean;
}

export interface SensorState {
  cameraActive: boolean;
  audioActive: boolean;
  gpsActive: boolean;
  gpsLat: number | null;
  gpsLng: number | null;
  cameraError: string | null;
  audioError: string | null;
  gpsError: string | null;
  audioLevel: number;
}

export interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

export interface AudioAlert {
  id: string;
  timestamp: number;
  level: number;
  keyword: string | null;
  isSpike: boolean;
}

export type PageKey = 'dashboard' | 'regulation' | 'operations';

export interface AppState {
  mode: AppMode;
  status: SystemStatus;
  alertLevel: AlertLevel;
  confidence: number;
  cognitiveLoad: number;
  events: SecurityEvent[];
  modules: ModuleState[];
  cameras: CameraState[];
  settings: AppSettings;
  telegramSentCount: number;
  demoMode: boolean;
  sensors: SensorState;
  detectedObjects: DetectedObject[];
  audioAlerts: AudioAlert[];
  tfjsLoaded: boolean;
  tfjsError: boolean;
}

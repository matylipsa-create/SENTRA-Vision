import { Camera, Wifi, Crosshair, Eye, ShieldCheck, TriangleAlert as AlertTriangle, Zap, Activity, Radio, Send, BatteryLow, Mic, KeyRound, ScanEye, Volume2, Brain } from 'lucide-react';
import { useApp } from '../context/AppContext';
import EmergencyCallButtons from '../components/EmergencyCallButtons';
import CameraStream from '../components/CameraStream';
import { usePanic } from '../hooks/usePanic';
import type { CameraState, DetectedObject, AudioAlert } from '../types';

const CAM_ICONS: Record<string, typeof Camera> = {
  CAM: Camera, IP: Wifi, PTZ: Crosshair, VISION: Eye,
};

function cameraClass(cam: CameraState): string {
  if (cam.type === 'CAM') {
    if (cam.status === 'active') return 'icon-camera-active';
    if (cam.status === 'fail') return 'icon-camera-fail';
    if (cam.status === 'connecting') return 'icon-camera-connecting';
    return '';
  }
  if (cam.type === 'IP') {
    if (cam.status === 'active') return 'icon-ip-active';
    if (cam.status === 'fail') return 'icon-ip-fail';
    if (cam.status === 'connecting') return 'icon-ip-connecting';
    return '';
  }
  if (cam.type === 'PTZ') {
    return cam.status === 'active' || cam.status === 'standby' ? 'icon-ptz-available' : 'icon-ptz-unavailable';
  }
  if (cam.type === 'VISION') {
    return cam.status === 'active' ? 'icon-vision-detect' : 'icon-vision-standby';
  }
  return '';
}

const ALERT_CONFIG = {
  SEGURO: { icon: ShieldCheck, cls: 'badge-safe', color: '#22C55E' },
  ALERTA: { icon: AlertTriangle, cls: 'badge-alert', color: '#FBBF24' },
  CRITICO: { icon: Zap, cls: 'badge-critical', color: '#EF4444' },
} as const;

interface Props {
  isTechnical: boolean;
  onArm: () => void;
  setVideo: (el: HTMLVideoElement | null) => void;
}

export default function Dashboard({ isTechnical, onArm, setVideo }: Props) {
  const { state, setStatus } = useApp();
  const { panicActive, triggerPanic } = usePanic();
  const AlertIcon = ALERT_CONFIG[state.alertLevel].icon;
  const alertCfg = ALERT_CONFIG[state.alertLevel];
  const isPowerSaving = state.settings.powerSavingMode;
  const isRealMode = state.settings.realMode;
  const visibleCameras = isPowerSaving ? state.cameras.filter(c => c.type === 'CAM' || c.type === 'IP') : state.cameras;
  const audioLevel = state.sensors.audioLevel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-white">Centro de Control</h1>
          <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
            {isTechnical ? 'Modo Tecnico — Vista avanzada' : 'Modo Normal — Vista simplificada'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className={`badge-status ${alertCfg.cls}`}>
            <AlertIcon size={14} />
            {state.alertLevel}
          </div>
          {isPowerSaving && (
            <span className="power-saving-indicator flex items-center gap-1 ml-1">
              <BatteryLow size={10} />
              AHORRO
            </span>
          )}
        </div>
      </div>

      {isTechnical ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Confianza</div>
            <div className="text-xl font-bold font-mono" style={{ color: state.confidence > 80 ? '#22C55E' : state.confidence > 60 ? '#FBBF24' : '#EF4444' }}>
              {state.confidence}%
            </div>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(26,42,58,0.15)', border: '1px solid rgba(26,42,58,0.4)' }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Carga Cognitiva</div>
            <div className="text-xl font-bold font-mono" style={{ color: state.cognitiveLoad > 70 ? '#EF4444' : state.cognitiveLoad > 50 ? '#FBBF24' : '#22C55E' }}>
              {state.cognitiveLoad}%
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 flex items-center gap-3" style={{
          background: state.alertLevel === 'SEGURO' ? 'rgba(34,197,94,0.08)' : state.alertLevel === 'ALERTA' ? 'rgba(251,191,36,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${alertCfg.color}33`,
        }}>
          <ShieldCheck size={28} style={{ color: alertCfg.color, filter: `drop-shadow(0 0 6px ${alertCfg.color}66)` }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: alertCfg.color }}>
              {state.alertLevel === 'SEGURO' ? 'Sistema seguro' : state.alertLevel === 'ALERTA' ? 'Atencion requerida' : 'Alerta critica'}
            </div>
            <div className="text-xs" style={{ color: '#9CA3AF' }}>
              {state.alertLevel === 'SEGURO' ? 'Todo funciona con normalidad' : state.alertLevel === 'ALERTA' ? 'Revisar eventos recientes' : 'Responder de inmediato'}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => { onArm(); setStatus(state.status === 'ARMADO' ? 'DESARMADO' : 'ARMADO'); }}
        className="btn-critical w-full rounded-2xl py-4 font-semibold text-base active:scale-95 transition-all"
        style={{ background: 'rgba(251,191,36,0.08)', color: '#FBBF24' }}>
        {state.status === 'ARMADO' ? 'DESARMAR SISTEMA' : 'ARMAR SISTEMA'}
      </button>

      <button
        onClick={triggerPanic}
        className="w-full rounded-2xl py-5 font-bold text-base active:scale-95 transition-all relative overflow-hidden"
        style={{
          background: panicActive ? '#EF4444' : 'rgba(239,68,68,0.12)',
          color: panicActive ? '#fff' : '#EF4444',
          border: `2px solid ${panicActive ? '#EF4444' : 'rgba(239,68,68,0.4)'}`,
          boxShadow: panicActive ? '0 0 30px rgba(239,68,68,0.6)' : 'none',
        }}>
        {panicActive ? (
          <span className="flex items-center justify-center gap-2 animate-pulse">
            <Zap size={20} />
            PANICO ACTIVADO
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Zap size={20} />
            ACTIVAR PANICO
          </span>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <EmergencyCallButtons variant="911" />
        <EmergencyCallButtons variant="107" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <EmergencyCallButtons variant="103" />
      </div>

      <CameraStream setVideo={setVideo} />

      {isRealMode && state.tfjsLoaded && state.detectedObjects.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <ScanEye size={12} style={{ color: '#22C55E' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Objetos Detectados (COCO-SSD)</span>
            <span className="text-[9px] font-mono ml-auto px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
              {state.detectedObjects.length}
            </span>
          </div>
          <div className="space-y-1">
            {state.detectedObjects.slice(0, 5).map((obj, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{obj.class}</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${obj.score * 100}%`, background: obj.score > 0.7 ? '#22C55E' : '#FBBF24' }} />
                  </div>
                  <span className="text-[9px] font-mono" style={{ color: obj.score > 0.7 ? '#22C55E' : '#FBBF24' }}>
                    {Math.round(obj.score * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isRealMode && state.tfjsError && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-1.5">
            <Brain size={12} style={{ color: '#EF4444' }} />
            <span className="text-[10px]" style={{ color: '#EF4444' }}>No se pudo cargar TensorFlow.js</span>
          </div>
        </div>
      )}

      {isRealMode && state.audioAlerts.length > 0 && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Volume2 size={12} style={{ color: '#FBBF24' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Alertas de Audio</span>
            <span className="text-[9px] font-mono ml-auto px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D' }}>
              {state.audioAlerts.length}
            </span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {state.audioAlerts.slice(0, 5).map(a => (
              <div key={a.id} className="flex items-center justify-between py-1 px-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-1.5">
                  {a.keyword ? (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                      {a.keyword.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full font-mono" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
                      SPIKE
                    </span>
                  )}
                  <span className="text-[9px] font-mono" style={{ color: '#9CA3AF' }}>{a.level}%</span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: '#4B5563' }}>
                  {new Date(a.timestamp).toLocaleTimeString('es-AR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isRealMode && !isPowerSaving && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Mic size={12} style={{ color: state.sensors.audioActive ? '#22C55E' : '#6B7280' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Nivel de Audio</span>
            <span className="text-[9px] font-mono ml-auto" style={{ color: state.sensors.audioActive ? '#22C55E' : '#6B7280' }}>
              {state.sensors.audioActive ? `${audioLevel}%` : 'OFF'}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${audioLevel}%`,
                background: audioLevel > 70 ? '#EF4444' : audioLevel > 40 ? '#FBBF24' : '#22C55E',
              }}
            />
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Camaras y Sensores</div>
        <div className="grid grid-cols-3 gap-2">
          {visibleCameras.map(cam => {
            const Icon = CAM_ICONS[cam.type] || Camera;
            return (
              <div key={cam.id} className={`flex flex-col items-center gap-1 p-3 rounded-xl ${cameraClass(cam)}`}
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Icon size={20} style={{ color: cam.status === 'active' ? '#22C55E' : cam.status === 'fail' ? '#EF4444' : cam.status === 'standby' ? '#6B7280' : '#FBBF24' }} />
                <span className="text-[9px] font-medium text-center" style={{ color: '#9CA3AF' }}>{cam.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isTechnical && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity size={12} style={{ color: '#FBBF24' }} />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Eventos en Tiempo Real</span>
            </div>
            <div className="flex items-center gap-1">
              <Send size={10} style={{ color: '#FBBF24' }} />
              <span className="text-[10px] font-mono" style={{ color: '#FBBF24' }}>TG: {state.telegramSentCount}</span>
            </div>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {state.events.length === 0 ? (
              <div className="text-xs text-center py-4" style={{ color: '#4B5563' }}>Sin eventos</div>
            ) : state.events.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg animate-fade-in"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                  <Radio size={12} style={{ color: e.type.includes('BREACH') || e.type.includes('OFFLINE') || e.type.includes('PANIC') ? '#EF4444' : '#FBBF24' }} />
                  <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{e.type}</span>
                  {e.cryptoVerified && (
                    <KeyRound size={10} style={{ color: '#22C55E' }} />
                  )}
                  {e.telegramSent && (
                    <span className="text-[8px] px-1 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D' }}>
                      TG
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] font-mono truncate max-w-[60px]" style={{ color: '#4B5563' }}>{e.hash.slice(0, 12)}</span>
                  <span className="text-[9px] font-mono" style={{ color: '#4B5563' }}>
                    {new Date(e.timestamp).toLocaleTimeString('es-AR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

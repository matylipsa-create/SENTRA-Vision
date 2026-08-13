import { X, Webhook, Send, BatteryLow, Camera, Mic, MapPin, FlaskConical, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Settings({ open, onClose }: Props) {
  const { state, updateSettings, setMode, setDemoMode } = useApp();
  if (!open) return null;

  const sensors = state.sensors;
  const realMode = state.settings.realMode;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="animate-slide-up w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        style={{ background: 'linear-gradient(180deg, #1A2A3A 0%, #0A0C12 100%)', border: '1px solid rgba(251,191,36,0.2)' }}
        onClick={e => e.stopPropagation()}>

        <div className="sticky top-0 flex items-center justify-between px-5 py-4" style={{ background: 'rgba(10,12,18,0.95)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
          <span className="font-display font-semibold text-white">Configuracion</span>
          <button onClick={onClose} className="p-1.5 rounded-lg active:scale-90" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <X size={18} style={{ color: '#9CA3AF' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Modo de Datos: Demo / Real */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Modo de Datos</div>
            <div className="flex gap-2">
              <button onClick={() => { setDemoMode(true); updateSettings({ realMode: false }); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: state.demoMode && !realMode ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${state.demoMode && !realMode ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: state.demoMode && !realMode ? '#FBBF24' : '#6B7280',
                }}>
                <FlaskConical size={14} /> Demo
              </button>
              <button onClick={() => { setDemoMode(false); updateSettings({ realMode: true }); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5"
                style={{
                  background: realMode ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${realMode ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: realMode ? '#FBBF24' : '#6B7280',
                }}>
                <Wifi size={14} /> Real
              </button>
            </div>
            {state.demoMode && !realMode && (
              <p className="text-[10px] mt-1.5" style={{ color: '#6B7280' }}>Eventos simulados para presentacion. Sin usar sensores reales.</p>
            )}
            {realMode && (
              <p className="text-[10px] mt-1.5" style={{ color: '#FBBF24' }}>Sensores del dispositivo activos: camara, audio y GPS.</p>
            )}
          </div>

          {/* Modo Normal / Tecnico */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Modo de Interfaz</div>
            <div className="flex gap-2">
              <button onClick={() => setMode('normal')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                style={{
                  background: state.mode === 'normal' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${state.mode === 'normal' ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: state.mode === 'normal' ? '#FBBF24' : '#6B7280',
                }}>
                Normal
              </button>
              <button onClick={() => setMode('technical')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
                style={{
                  background: state.mode === 'technical' ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${state.mode === 'technical' ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  color: state.mode === 'technical' ? '#FBBF24' : '#6B7280',
                }}>
                Tecnico
              </button>
            </div>
          </div>

          {/* Sensores en Modo Real */}
          {realMode && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(26,42,58,0.3)', border: '1px solid rgba(251,191,36,0.2)' }}>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Estado de Sensores</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera size={14} style={{ color: sensors.cameraActive ? '#22C55E' : sensors.cameraError ? '#EF4444' : '#6B7280' }} />
                  <span className="text-sm" style={{ color: '#E5E7EB' }}>Camara</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: sensors.cameraActive ? '#22C55E' : sensors.cameraError ? '#EF4444' : '#6B7280' }}>
                  {sensors.cameraActive ? 'ACTIVA' : sensors.cameraError ? 'ERROR' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic size={14} style={{ color: sensors.audioActive ? '#22C55E' : sensors.audioError ? '#EF4444' : '#6B7280' }} />
                  <span className="text-sm" style={{ color: '#E5E7EB' }}>Audio</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: sensors.audioActive ? '#22C55E' : sensors.audioError ? '#EF4444' : '#6B7280' }}>
                  {sensors.audioActive ? 'ACTIVO' : sensors.audioError ? 'ERROR' : 'OFF'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: sensors.gpsActive ? '#22C55E' : sensors.gpsError ? '#EF4444' : '#6B7280' }} />
                  <span className="text-sm" style={{ color: '#E5E7EB' }}>GPS</span>
                </div>
                <span className="text-[10px] font-mono" style={{ color: sensors.gpsActive ? '#22C55E' : sensors.gpsError ? '#EF4444' : '#6B7280' }}>
                  {sensors.gpsActive && sensors.gpsLat !== null
                    ? `${sensors.gpsLat.toFixed(4)}, ${sensors.gpsLng?.toFixed(4)}`
                    : sensors.gpsError ? 'ERROR' : 'OFF'}
                </span>
              </div>
            </div>
          )}

          {/* Integracion Telegram */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Integracion Telegram (Pipedream)</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs flex items-center gap-1.5 mb-1.5" style={{ color: '#9CA3AF' }}>
                  <Webhook size={12} /> URL del Webhook
                </label>
                <input
                  type="url"
                  value={state.settings.pipedreamWebhookUrl}
                  onChange={e => updateSettings({ pipedreamWebhookUrl: e.target.value })}
                  placeholder="https://hooks.pipedream.com/..."
                  className="w-full px-3 py-2 rounded-xl text-sm font-mono outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#E5E7EB' }}
                />
              </div>
              <button
                onClick={() => updateSettings({ sendDemoToTelegram: !state.settings.sendDemoToTelegram })}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2">
                  <Send size={14} style={{ color: state.settings.sendDemoToTelegram ? '#FBBF24' : '#6B7280' }} />
                  <span className="text-sm" style={{ color: '#E5E7EB' }}>Enviar eventos demo a Telegram</span>
                </div>
                <div className="w-10 h-6 rounded-full transition-all relative" style={{
                  background: state.settings.sendDemoToTelegram ? '#FBBF24' : 'rgba(255,255,255,0.1)',
                }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{
                    left: state.settings.sendDemoToTelegram ? '18px' : '2px',
                  }} />
                </div>
              </button>
            </div>
          </div>

          {state.demoMode && !realMode && (
            <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)' }}>
              <span className="text-xs" style={{ color: '#FCD34D' }}>Modo Demo activo — los datos son simulados</span>
            </div>
          )}

          {/* Ahorro de Energia */}
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: '#6B7280' }}>Optimizacion de Recursos</div>
            <button
              onClick={() => updateSettings({ powerSavingMode: !state.settings.powerSavingMode })}
              className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all active:scale-95"
              style={{
                background: state.settings.powerSavingMode ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${state.settings.powerSavingMode ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <BatteryLow size={14} style={{ color: state.settings.powerSavingMode ? '#22C55E' : '#6B7280' }} />
                  <span className="text-sm" style={{ color: '#E5E7EB' }}>Modo Ahorro de Energia</span>
                </div>
                <span className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                  {state.settings.powerSavingMode
                    ? 'Solo GPS + panico. Sin animaciones. Actualizacion reducida.'
                    : 'Desactiva animaciones, reduce frecuencia y limita modulos a GPS + panico.'}
                </span>
              </div>
              <div className="w-10 h-6 rounded-full transition-all relative flex-shrink-0" style={{
                background: state.settings.powerSavingMode ? '#22C55E' : 'rgba(255,255,255,0.1)',
              }}>
                <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{
                  left: state.settings.powerSavingMode ? '18px' : '2px',
                }} />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

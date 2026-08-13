import { ShieldCheck, Camera, Mic, MapPin, Brain, Database, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const STEPS = [
  { icon: ShieldCheck, title: 'Bienvenido a AEGIS IV', desc: 'Sistema de seguridad cognitiva con deteccion multi-sensor, analisis de IA y respuesta en tiempo real.' },
  { icon: Camera, title: 'Camaras', desc: 'Monitoreo visual con deteccion de movimiento, reconocimiento facial y vision por computadora.' },
  { icon: Mic, title: 'Audio', desc: 'Analisis de audio para detectar anomalias: cristales, gritos, disparos u otros sonidos de alerta.' },
  { icon: MapPin, title: 'GPS', desc: 'Geolocalizacion y geocercas. Sabi siempre donde esta el activo protegido.' },
  { icon: Brain, title: 'Inteligencia Artificial', desc: 'Carga cognitiva bajo demanda. La IA se activa solo cuando se necesita, optimizando recursos.' },
  { icon: Database, title: 'Almacenamiento', desc: 'Eventos almacenados localmente en IndexedDB y sincronizados via FIFO cuando hay conexion.' },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingGuide({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const S = STEPS[step];
  const Icon = S.icon;
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) { onComplete(); return; }
    setStep(s => s + 1);
    setAnimKey(k => k + 1);
  };
  const prev = () => {
    setStep(s => s - 1);
    setAnimKey(k => k + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,5,16,0.85)', backdropFilter: 'blur(8px)' }} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={`Guía de bienvenida: paso ${step + 1} de ${STEPS.length}: ${S.title}`}
        className="animate-scale-in w-full max-w-sm mx-4 rounded-2xl p-6" style={{ background: 'linear-gradient(180deg, #1A2A3A 0%, #0A0C12 100%)', border: '1px solid rgba(251,191,36,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div key={animKey} className="flex flex-col items-center text-center animate-fade-in">
          <div className="mb-4 rounded-2xl p-4" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}>
            <Icon size={36} style={{ color: '#FBBF24' }} aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white mb-2">{S.title}</h2>
          <p className="text-sm leading-relaxed mb-6" style={{ color: '#CBD5E1' }}>{S.desc}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-6" role="presentation" aria-label={`Progreso: paso ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300" role="presentation"
              style={{ width: i === step ? 24 : 8, background: i <= step ? '#FBBF24' : 'rgba(255,255,255,0.15)' }} />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={prev} aria-label="Paso anterior"
              className="press-feedback flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1' }}>
              Atras
            </button>
          )}
          <button onClick={next}
            aria-label={isLast ? 'Comenzar a usar AEGIS' : 'Siguiente paso'}
            className="press-feedback flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1"
            style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#0A0C12', boxShadow: '0 4px 14px rgba(251,191,36,0.4)' }}>
            {isLast ? 'Comenzar' : 'Siguiente'} {!isLast && <ArrowRight size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}

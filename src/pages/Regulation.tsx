import { BookOpen, FileText, Shield, Scale } from 'lucide-react';

const REGULATIONS = [
  { icon: Shield, title: 'Ley 27.308', desc: 'Marco normativo para sistemas de seguridad privada.' },
  { icon: FileText, title: 'Ley 25.326 y modificatorias', desc: 'Protección de datos personales: tratamiento responsable, finalidad, seguridad y derechos de las personas sobre su información.' },
  { icon: Scale, title: 'Ley 25.506 de Firma Digital', desc: 'Marco para la validez jurídica de firmas digitales y documentos electrónicos; relevante para la cadena de hash y la firma Dilithium como controles técnicos de integridad y autenticidad.' },
  { icon: BookOpen, title: 'Marco para IA', desc: 'Aplicación de principios internacionales de IA confiable: supervisión humana, transparencia, trazabilidad, gestión de riesgos, privacidad y revisión continua.' },
  { icon: FileText, title: 'Resolución 1234/2020', desc: 'Protocolos de registración y operación.' },
  { icon: BookOpen, title: 'Guía Empretec', desc: 'Estándares de presentación para entidades financieras.' },
];

export default function Regulation() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold text-white">Regulacion</h1>
        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Marco normativo y cumplimiento</p>
      </div>
      <div className="space-y-2">
        {REGULATIONS.map(r => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="rounded-xl p-4 transition-all active:scale-[0.98]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 flex-shrink-0" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <Icon size={18} style={{ color: '#FBBF24' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-0.5">{r.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>{r.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Activity, Send, Radio, Database, CircleCheck as CheckCircle2, ShieldCheck, ShieldAlert, Link2, KeyRound, Download, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';

export default function Operations() {
  const { state } = useApp();
  const [exportSuccess, setExportSuccess] = useState(false);
  const verifiedCount = state.events.filter(e => e.cryptoVerified).length;
  const chainIntact = state.events.length > 0 && state.events.every((e, i, arr) => {
    if (i === arr.length - 1) return e.previousHash === '0'.repeat(64);
    return e.previousHash === arr[i + 1].hash;
  });

  const downloadEvidence = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      eventCount: state.events.length,
      events: state.events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aegis-evidencia-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold text-white">Operaciones</h1>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>Eventos, cola FIFO, firma Dilithium y hash chain</p>
          </div>
          <button onClick={downloadEvidence} disabled={state.events.length === 0}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: exportSuccess ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.12)',
              border: exportSuccess ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(251,191,36,0.3)',
              color: exportSuccess ? '#22C55E' : '#FBBF24',
            }}>
            {exportSuccess ? <CircleCheck size={13} /> : <Download size={13} />}
            {exportSuccess ? 'Exportado' : 'Descargar JSON'}
          </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Activity size={16} className="mx-auto mb-1" style={{ color: '#FBBF24' }} />
          <div className="text-lg font-bold font-mono" style={{ color: '#FBBF24' }}>{state.events.length}</div>
          <div className="text-[9px]" style={{ color: '#6B7280' }}>Eventos</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <Send size={16} className="mx-auto mb-1" style={{ color: '#22C55E' }} />
          <div className="text-lg font-bold font-mono" style={{ color: '#22C55E' }}>{state.telegramSentCount}</div>
          <div className="text-[9px]" style={{ color: '#6B7280' }}>Telegram</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Database size={16} className="mx-auto mb-1" style={{ color: '#FBBF24' }} />
          <div className="text-lg font-bold font-mono" style={{ color: '#FBBF24' }}>IDB</div>
          <div className="text-[9px]" style={{ color: '#6B7280' }}>Storage</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <KeyRound size={12} style={{ color: '#22C55E' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Dilithium</span>
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: '#22C55E' }}>
            {verifiedCount}/{state.events.length}
          </div>
          <div className="text-[9px]" style={{ color: '#6B7280' }}>Firmas verificadas</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: chainIntact && state.events.length > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: chainIntact && state.events.length > 0 ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Link2 size={12} style={{ color: chainIntact && state.events.length > 0 ? '#22C55E' : '#EF4444' }} />
            <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Hash Chain</span>
          </div>
          <div className="text-lg font-bold font-mono" style={{ color: chainIntact && state.events.length > 0 ? '#22C55E' : '#EF4444' }}>
            {chainIntact && state.events.length > 0 ? 'INTACTA' : '—'}
          </div>
          <div className="text-[9px]" style={{ color: '#6B7280' }}>Cadena de evidencia</div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Radio size={12} style={{ color: '#FBBF24' }} />
          <span className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>Cola de Eventos (FIFO) — Evidencia Inmutable</span>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {state.events.length === 0 ? (
            <div className="text-xs text-center py-8" style={{ color: '#4B5563' }}>Sin eventos en cola</div>
          ) : state.events.map((e, idx) => (
            <div key={e.id} className="rounded-lg py-2.5 px-3 animate-fade-in" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D' }}>#{state.events.length - idx}</span>
                  <span className="text-xs font-mono" style={{ color: '#9CA3AF' }}>{e.type}</span>
                </div>
                <span className="text-[9px] font-mono" style={{ color: '#4B5563' }}>{new Date(e.timestamp).toLocaleTimeString('es-AR')}</span>
              </div>

              <div className="space-y-1 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <Link2 size={9} style={{ color: '#6B7280' }} />
                  <span className="text-[9px] font-mono" style={{ color: '#6B7280' }}>prev:</span>
                  <span className="text-[9px] font-mono truncate" style={{ color: '#4B5563' }}>{e.previousHash.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={9} style={{ color: '#22C55E' }} />
                  <span className="text-[9px] font-mono" style={{ color: '#22C55E' }}>hash:</span>
                  <span className="text-[9px] font-mono truncate" style={{ color: '#22C55E' }}>{e.hash.slice(0, 24)}...</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <KeyRound size={9} style={{ color: '#FBBF24' }} />
                  <span className="text-[9px] font-mono" style={{ color: '#FBBF24' }}>dilithium:</span>
                  <span className="text-[9px] font-mono truncate" style={{ color: '#FBBF24' }}>{e.signature.slice(0, 24)}...</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  {e.cryptoVerified ? (
                    <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}>
                      <ShieldCheck size={8} /> Firma OK
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <ShieldAlert size={8} /> VETO ACTIVO
                    </span>
                  )}
                  {e.demo && <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(252,211,77,0.1)', color: '#FCD34D' }}>DEMO</span>}
                </div>
                {e.telegramSent && (
                  <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <CheckCircle2 size={8} /> Telegram
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

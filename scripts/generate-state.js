import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?|css)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(SRC).map(f => relative(ROOT, f).replace(/\\/g, '/')).sort();
const components = files
  .filter(f => /src\/components\/.+\.tsx$/.test(f))
  .map(f => f.split('/').pop().replace('.tsx', ''));
const pages = files
  .filter(f => /src\/pages\/.+\.tsx$/.test(f))
  .map(f => f.split('/').pop().replace('.tsx', ''));

const digest = {
  generatedAt: new Date().toISOString(),
  version: '3.0.0-PROT',
  buildStatus: 'OK',
  files: { total: files.length, list: files },
  keyComponents: [...components, ...pages],
  modules: {
    core: ['AppContext', 'useDemoEventGenerator', 'useMetricsUpdater', 'pipedream'],
    lazy: ['SentraIAPanel (lazy)', 'SentraVisionPanel (lazy)', 'AudioEngine (lazy)'],
  },
  features: [
    'Modo Normal / Tecnico',
    'Onboarding guiado',
    'Botones de emergencia (PANICO, 911, 107, 103)',
    'Banner DEMO transparente',
    'Panel de Metricas (Aegis button)',
    'Eventos demo → Telegram (Pipedream)',
    'Resaltado visual: botones criticos, camaras, badges',
    'Carga procedural (lazy loading)',
    'Modo Ahorro de Energia (animaciones off, modulos limitados)',
    'Optimizacion: GPS 10s, eventos 15s, metricas 5s',
    'Pausa de workers IA/vision fuera de Operaciones',
    'Calidad adaptativa: camara 480p, audio 16kHz en modo normal',
  ],
};

const outPath = join(ROOT, 'STATE_DIGEST.json');
writeFileSync(outPath, JSON.stringify(digest, null, 2));
console.log(`[STATE] Digest written to ${outPath}`);
console.log(`[STATE] buildStatus=${digest.buildStatus} · components=${components.length} · files=${files.length}`);

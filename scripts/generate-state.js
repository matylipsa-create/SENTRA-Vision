// scripts/generate-state.js
// Generador de estado para Sentra Core — EVOLIS, MoralNode y métricas del sistema
// Ejecutar: node scripts/generate-state.js

const fs = require('fs');
const path = require('path');

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================

const OUTPUT_DIR = path.join(__dirname, '../src/data');
const STATE_FILE = path.join(OUTPUT_DIR, 'system-state.json');
const CHAIN_FILE = path.join(OUTPUT_DIR, 'evolis-chain.json');

// Asegurar que el directorio existe
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ============================================================
// 2. FUNCIONES DE UTILIDAD
// ============================================================

function generateId() {
  return 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
}

function sha256(data) {
  let hash = 0;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `0x${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function getGenesisHash() {
  return 'GENESIS_BLOCK';
}

// ============================================================
// 3. GENERAR CADENA DE EJEMPLO (EVOLIS)
// ============================================================

function generateEvolisChain() {
  const chain = [];
  let currentHash = getGenesisHash();

  const events = [
    { type: 'DETECTION', data: { object: 'person', confidence: 0.95 } },
    { type: 'DETECTION', data: { object: 'dog', confidence: 0.87 } },
    { type: 'DECISION', data: { action: 'describe', target: 'person' } },
    { type: 'DETECTION', data: { object: 'car', confidence: 0.92 } },
    { type: 'ALERT', data: { level: 'MEDIUM', message: 'Vehículo detectado' } },
    { type: 'DETECTION', data: { object: 'person', confidence: 0.89 } },
    { type: 'DECISION', data: { action: 'warn', target: 'car' } },
    { type: 'DETECTION', data: { object: 'bicycle', confidence: 0.78 } },
    { type: 'ACTION', data: { action: 'speak', text: 'Cuidado con la bicicleta' } },
    { type: 'DETECTION', data: { object: 'knife', confidence: 0.73 } },
    { type: 'ALERT', data: { level: 'CRITICAL', message: 'Objeto peligroso detectado' } },
    { type: 'DECISION', data: { action: 'veto', reason: 'Veto humano requerido' } }
  ];

  let previousHash = getGenesisHash();

  events.forEach((event, index) => {
    const id = generateId();
    const timestamp = Date.now() - (events.length - index) * 60000; // 1 minuto entre eventos
    
    const record = {
      id,
      type: event.type,
      timestamp,
      data: event.data,
      previousHash,
      hash: sha256(JSON.stringify({ id, type: event.type, timestamp, data: event.data, previousHash }))
    };
    
    chain.push(record);
    previousHash = record.hash;
  });

  return chain;
}

// ============================================================
// 4. GENERAR ESTADO DEL SISTEMA
// ============================================================

function generateSystemState() {
  const chain = generateEvolisChain();
  const lastEvent = chain[chain.length - 1] || null;

  return {
    version: '3.1.2-PROT',
    timestamp: Date.now(),
    metadata: {
      generated: new Date().toISOString(),
      source: 'scripts/generate-state.js',
      environment: process.env.NODE_ENV || 'development'
    },
    evolis: {
      chainLength: chain.length,
      lastEvent: lastEvent,
      verified: true,
      genesisHash: getGenesisHash()
    },
    moral: {
      rules: [
        { id: 'NO_VIOLENCE', description: 'Bloquear contenido violento', priority: 'CRITICAL' },
        { id: 'PRIVACY_FIRST', description: 'Bloquear datos sensibles', priority: 'HIGH' },
        { id: 'OFFLINE_ONLY', description: 'No enviar datos externos sin consentimiento', priority: 'HIGH' },
        { id: 'HUMAN_VETO', description: 'Acciones críticas requieren confirmación humana', priority: 'CRITICAL' }
      ],
      active: true,
      vetoEnabled: true,
      log: chain
        .filter(e => e.type === 'DECISION' || e.type === 'ALERT')
        .slice(-10)
        .map(e => ({
          id: e.id,
          type: e.type,
          timestamp: e.timestamp,
          data: e.data,
          hash: e.hash
        }))
    },
    perception: {
      active: false,
      modelLoaded: false,
      detections: [],
      fps: 0
    },
    system: {
      online: true,
      battery: 85,
      memory: {
        used: 256,
        total: 4096,
        unit: 'MB'
      },
      uptime: 3600
    }
  };
}

// ============================================================
// 5. ESCRIBIR ARCHIVOS
// ============================================================

function writeStateFiles() {
  try {
    // Generar estado del sistema
    const state = generateSystemState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`✅ Estado del sistema guardado en ${STATE_FILE}`);

    // Guardar cadena de EVOLIS por separado
    const chain = state.evolis;
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
    console.log(`✅ Cadena de EVOLIS guardada en ${CHAIN_FILE}`);

    // Mostrar resumen
    console.log('\n📊 RESUMEN:');
    console.log(`   Versión: ${state.version}`);
    console.log(`   Eventos registrados: ${chain.chainLength}`);
    console.log(`   MoralNode: ${state.moral.active ? 'ACTIVO' : 'INACTIVO'}`);
    console.log(`   Veto humano: ${state.moral.vetoEnabled ? 'HABILITADO' : 'DESHABILITADO'}`);
    console.log(`   Último evento: ${chain.lastEvent ? chain.lastEvent.type : 'Ninguno'}`);
    console.log(`   Hash: ${chain.lastEvent ? chain.lastEvent.hash : 'N/A'}`);

  } catch (error) {
    console.error('❌ Error al generar archivos de estado:', error);
    process.exit(1);
  }
}

// ============================================================
// 6. EJECUTAR
// ============================================================

if (require.main === module) {
  writeStateFiles();
}

module.exports = {
  generateEvolisChain,
  generateSystemState,
  writeStateFiles
};

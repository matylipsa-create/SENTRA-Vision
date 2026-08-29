// sentinel-demo/app.js
// Aplicación demo de Sentinel — Sistema Soberano de Seguridad
// Basado en Sentra Core: percepción, ética, trazabilidad

// ============================================================
// 1. IMPORTS Y CONFIGURACIÓN
// ============================================================

// Importar módulos de Sentra Core (simulación para demo)
// En producción, estos vendrían de node_modules/@sentra/core

const SENTRA_CORE = {
  MoralNode: {
    evaluate: (input) => {
      const violent = ['arma', 'pistola', 'cuchillo', 'violencia'];
      const text = JSON.stringify(input).toLowerCase();
      if (violent.some(v => text.includes(v))) {
        return { allowed: false, reason: 'Contenido violento bloqueado', rulesApplied: ['NO_VIOLENCE'] };
      }
      return { allowed: true, rulesApplied: [] };
    }
  },
  EVOLIS: {
    chain: [],
    registerEvent: (type, data, moralDecision) => {
      const id = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const record = {
        id,
        type,
        timestamp: Date.now(),
        data,
        moralDecision,
        previousHash: EVOLIS.chain.length > 0 ? EVOLIS.chain[EVOLIS.chain.length - 1].hash : 'GENESIS_BLOCK',
        hash: `0x${Math.abs(Date.now() * Math.random()).toString(16).padStart(8, '0')}`
      };
      EVOLIS.chain.push(record);
      return record;
    },
    getChain: () => EVOLIS.chain,
    verifyChain: () => true
  }
};

// ============================================================
// 2. ESTADO DE LA APLICACIÓN
// ============================================================

const state = {
  isActive: false,
  cameraStatus: 'INACTIVA',
  detections: [],
  alertLevel: 'NORMAL', // NORMAL | MEDIUM | HIGH | CRITICAL
  events: [],
  sensors: {
    camera: false,
    motion: false,
    door: false,
    window: false
  }
};

// ============================================================
// 3. DOM ELEMENTOS
// ============================================================

const elements = {
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  detectionCount: document.getElementById('detection-count'),
  detectionList: document.getElementById('detection-list'),
  alertLevel: document.getElementById('alert-level'),
  eventLog: document.getElementById('event-log'),
  toggleBtn: document.getElementById('toggle-btn'),
  cameraStatus: document.getElementById('camera-status'),
  sensorStatus: document.getElementById('sensor-status')
};

// ============================================================
// 4. FUNCIONES DE VOZ (SpeechSynthesis)
// ============================================================

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}

// ============================================================
// 5. FUNCIONES DE VIBRACIÓN HÁPTICA
// ============================================================

function vibrate(duration = 50) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

// ============================================================
// 6. FUNCIONES DE PERCEPCIÓN (simulación)
// ============================================================

function simulateDetection() {
  if (!state.isActive) return;

  const objects = [
    { class: 'person', confidence: 0.92 },
    { class: 'car', confidence: 0.85 },
    { class: 'dog', confidence: 0.78 },
    { class: 'bicycle', confidence: 0.73 },
    { class: 'chair', confidence: 0.68 }
  ];

  const randomObject = objects[Math.floor(Math.random() * objects.length)];
  const detection = {
    ...randomObject,
    timestamp: Date.now()
  };

  // Evaluar con MoralNode
  const moralDecision = SENTRA_CORE.MoralNode.evaluate({ detections: [detection] });

  if (!moralDecision.allowed) {
    state.alertLevel = 'HIGH';
    speak(`⚠️ Alerta: ${moralDecision.reason}`);
    updateAlertLevel();
    return;
  }

  state.detections.push(detection);
  if (state.detections.length > 10) {
    state.detections.shift();
  }

  updateDetectionCount();
  updateDetectionList();

  // Registrar en EVOLIS
  SENTRA_CORE.EVOLIS.registerEvent('DETECTION', detection, moralDecision);

  // Anunciar por voz si hay detecciones
  if (state.detections.length > 0 && state.detections.length % 3 === 0) {
    const topObjects = state.detections.slice(-3).map(d => d.class).join(', ');
    speak(`Detectados: ${topObjects}`);
  }

  // Actualizar nivel de alerta
  if (state.detections.some(d => ['knife', 'gun', 'weapon'].includes(d.class))) {
    state.alertLevel = 'CRITICAL';
    speak('⚠️ ALERTA CRÍTICA: Objeto peligroso detectado');
  } else if (state.detections.length > 5) {
    state.alertLevel = 'MEDIUM';
  } else {
    state.alertLevel = 'NORMAL';
  }
  updateAlertLevel();
}

// ============================================================
// 7. FUNCIONES DE DOM
// ============================================================

function updateDetectionCount() {
  if (elements.detectionCount) {
    elements.detectionCount.textContent = state.detections.length;
  }
}

function updateDetectionList() {
  if (!elements.detectionList) return;
  const recentDetections = state.detections.slice(-5).reverse();
  elements.detectionList.innerHTML = recentDetections.map(d => 
    `<li>${d.class} (${Math.round(d.confidence * 100)}%) — ${new Date(d.timestamp).toLocaleTimeString()}</li>`
  ).join('');
}

function updateAlertLevel() {
  if (!elements.alertLevel) return;
  const levelColors = {
    'NORMAL': '#00ff88',
    'MEDIUM': '#ffaa00',
    'HIGH': '#ff6600',
    'CRITICAL': '#ff0000'
  };
  elements.alertLevel.textContent = state.alertLevel;
  elements.alertLevel.style.color = levelColors[state.alertLevel] || '#00ff88';
}

function updateEventLog() {
  if (!elements.eventLog) return;
  const chain = SENTRA_CORE.EVOLIS.getChain();
  const recentEvents = chain.slice(-10).reverse();
  elements.eventLog.innerHTML = recentEvents.map(e => 
    `<li>${e.type} — ${new Date(e.timestamp).toLocaleTimeString()} ${e.hash ? '🔗' : ''}</li>`
  ).join('');
}

function updateStatus() {
  if (elements.status) {
    elements.status.textContent = state.isActive ? 'ACTIVO' : 'INACTIVO';
    elements.status.style.color = state.isActive ? '#00ff88' : '#ff4444';
  }
  if (elements.statusText) {
    elements.statusText.textContent = state.isActive ? 'Sistema de seguridad activo' : 'Sistema inactivo';
  }
}

function updateCameraStatus() {
  if (elements.cameraStatus) {
    elements.cameraStatus.textContent = state.isActive ? '📷 Activa' : '📷 Inactiva';
    elements.cameraStatus.style.color = state.isActive ? '#00ff88' : '#ff4444';
  }
}

// ============================================================
// 8. ACCIONES PRINCIPALES
// ============================================================

function toggleSystem() {
  state.isActive = !state.isActive;
  vibrate(50);
  
  if (state.isActive) {
    speak('Activando sistema de seguridad');
    state.cameraStatus = 'ACTIVA';
    startSimulation();
  } else {
    speak('Desactivando sistema de seguridad');
    state.cameraStatus = 'INACTIVA';
    stopSimulation();
  }

  updateStatus();
  updateCameraStatus();
  updateEventLog();
}

function startSimulation() {
  if (state._simulationInterval) return;
  // Simular detección cada 3 segundos
  state._simulationInterval = setInterval(simulateDetection, 3000);
  
  // Simular eventos de sensores cada 5 segundos
  state._sensorInterval = setInterval(simulateSensorEvent, 5000);
}

function stopSimulation() {
  if (state._simulationInterval) {
    clearInterval(state._simulationInterval);
    state._simulationInterval = null;
  }
  if (state._sensorInterval) {
    clearInterval(state._sensorInterval);
    state._sensorInterval = null;
  }
}

function simulateSensorEvent() {
  if (!state.isActive) return;

  const sensors = ['motion', 'door', 'window'];
  const randomSensor = sensors[Math.floor(Math.random() * sensors.length)];
  
  // Estado aleatorio (true/false)
  const newState = Math.random() > 0.5;
  state.sensors[randomSensor] = newState;

  // Si se activa un sensor, registrarlo
  if (newState) {
    const eventData = { sensor: randomSensor, action: 'triggered', timestamp: Date.now() };
    SENTRA_CORE.EVOLIS.registerEvent('ALERT', eventData);
    speak(`⚠️ Sensor de ${randomSensor} activado`);
    updateEventLog();
  }

  updateSensorStatus();
}

function updateSensorStatus() {
  if (!elements.sensorStatus) return;
  const activeSensors = Object.entries(state.sensors).filter(([_, value]) => value).map(([key]) => key);
  elements.sensorStatus.textContent = activeSensors.length > 0 
    ? `🟢 Sensores activos: ${activeSensors.join(', ')}` 
    : '🟡 Todos los sensores en reposo';
}

// ============================================================
// 9. INICIALIZACIÓN
// ============================================================

function init() {
  updateStatus();
  updateCameraStatus();
  updateAlertLevel();
  updateDetectionCount();
  updateEventLog();
  updateSensorStatus();

  // Event listeners
  if (elements.toggleBtn) {
    elements.toggleBtn.addEventListener('click', toggleSystem);
  }

  console.log('🛡️ Sentinel Demo — Sistema Soberano de Seguridad');
  console.log('📡 Offline-first · Veto humano · Trazabilidad inalterable');
  console.log('🔗 Cuando todo lo demás se apaga, Sentra Core sigue ahí.');
}

// ============================================================
// 10. LIMPIEZA AL SALIR
// ============================================================

window.addEventListener('beforeunload', () => {
  stopSimulation();
});

// ============================================================
// 11. EJECUTAR
// ============================================================

document.addEventListener('DOMContentLoaded', init);

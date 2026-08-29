// src/index.js (o main.jsx si usas React)
// Punto de entrada para el navegador — carga la aplicación Sentra Visión

// ============================================================
// 1. IMPORTS PRINCIPALES
// ============================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ============================================================
// 2. REGISTRO DEL SERVICE WORKER (PWA)
// ============================================================

/**
 * Registra el Service Worker para la PWA (offline-first)
 * Solo en producción (no en desarrollo)
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registrado:', registration);
        })
        .catch((error) => {
          console.warn('[SW] Error al registrar Service Worker:', error);
        });
    });
  }
}

// ============================================================
// 3. RENDERIZADO DE LA APLICACIÓN
// ============================================================

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento #root en el DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ============================================================
// 4. INICIALIZAR SERVICE WORKER
// ============================================================

registerServiceWorker();

// ============================================================
// 5. LOG DE INICIO
// ============================================================

console.log('🛡️ Sentra Core v3.1.2-PROT — Motor de IA Soberana');
console.log('📡 Offline-first · Veto humano · Trazabilidad inalterable');
console.log('🔗 Cuando todo lo demás se apaga, Sentra Core sigue ahí.');

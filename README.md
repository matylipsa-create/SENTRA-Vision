# Sentra Visión — Seguridad Soberana

> **Escudo y Espada** — Sistema de asistencia visual cognitiva, offline-first, con veto humano.

**Versión:** 3.1.2-PROT

## Demo

La aplicación es accesible sin autenticación agregando `?demo=true` a la URL. Para diagnóstico completo, agregá `?debug=true`.

Aegis puede ser desplegado en Vercel, Netlify, Bolt, Base44 o cualquier plataforma que soporte PWA.

La filosofía de Aegis es la **soberanía sin fronteras**: cada persona y organización debe poder proteger sus datos, operar con autonomía y desplegar la herramienta donde resulte más conveniente, sin quedar atada a un proveedor único.

## Características

- **Offline-First**: funciona sin conexión a la nube, sincroniza cuando vuelve la red
- **Veto Humano**: ninguna acción crítica se ejecuta sin confirmación del operador
- **PWA Instalable**: instalable desde Chrome/Edge en Android y PC
- **Identidad Soberana**: nombre, ícono y colores propios — sin dependencias de marca externa
- **Detección por IA**: visión, audio y palabras clave con filtrado por confianza
- **Centro de Evidencia**: captura y registro automático de eventos detectados
- **Regulación Cognitiva**: asistente de voz con consolidación de mensajes repetidos
- **Capa Perceptiva (EVOLIS)**: detección de patrones ambiguos, análisis de ruido estructurado y derivación al veto humano ante incertidumbre alta

## Perception Layer

La capa perceptiva es el núcleo cognitivo de Aegis que permite al sistema pasar de un sistema de alertas a un analizador de estados complejos en tiempo real. Está implementada en `src/core/` y se compone de tres pilares:

### 1. Detección de Patrones Ambiguos (`detectAmbiguousPattern`)
Analiza cada evento entrante y determina si las señales del sensor admiten múltiples interpretaciones contradictorias. Evalúa el tipo de evento, la confianza del sensor, el módulo de origen y las características de la señal (nivel de audio, palabras clave) para producir un puntaje de ambigüedad y una lista de interpretaciones posibles.

### 2. Análisis de Ruido Estructurado (`analyzeStructuredNoise`)
Examina las señales de los sensores en busca de patrones de ruido con estructura periódica o sostenida que puedan confundirse con eventos reales. Distingue entre fluctuaciones esperadas (deriva GPS dentro de tolerancia) y ruido de alta energía que requiere atención (picos acústicos sostenidos, vibración fuera de banda base).

### 3. Evaluación de Incertidumbre y Veto Humano (`assessUncertainty`)
Combina los resultados de los dos pilares anteriores para clasificar el nivel de incertidumbre del evento en `low`, `medium` o `high`. Cuando la incertidumbre es alta, activa el protocolo de veto humano: el sistema pausa cualquier acción automática y requiere que el operador confirme la interpretación antes de proceder.

### Integración EVOLIS
El módulo `EVOLIS` (`src/core/EVOLIS.ts`) orquesta los tres pilares. Cada evento que ingresa al sistema pasa por `analyzeEvent()`, que ejecuta los tres análisis y, si la incertidumbre es alta, invoca al veto handler registrado. En el flujo de demostración, el veto handler registra una advertencia en consola; en producción, este hook se conecta a la interfaz de confirmación del operador.

## PWA

- **Nombre**: Sentra Visión
- **Short Name**: SentraV
- **Theme Color**: `#0a0a0f`
- **Background Color**: `#0a0a0f`
- **Display**: Standalone

Al instalar la PWA, el nombre "Sentra Visión" aparece en la pantalla de inicio.

## Stack

- React 18 + TypeScript + Vite
- TensorFlow.js (detección de objetos, carga diferida)
- Tesseract.js (OCR, carga diferida)
- Tailwind CSS

## Modos de operación

### Modo Normal (operador de campo)
- Vista simplificada, sin jerga técnica
- Estado del sistema en lenguaje claro ("Sistema seguro", "Atención requerida", "Alerta crítica")
- Cámara en vivo cuando el modo Real está activo
- Descripciones de entorno por voz con priorización de seguridad

### Modo Técnico (supervisor)
- Métricas avanzadas: Confianza (%) y Carga Cognitiva (%)
- Panel de métricas del sistema (botón Aegis en la barra superior)
- Estado de módulos: Visión, Audio, GPS, Crypto, IndexedDB, FIFO
- Eventos en tiempo real con hash, firma Dilithium y timestamp
- Indicador de cadena de evidencia (intacta/comprometida)

## Sensores en modo Real

Cuando el modo Real está activo desde Configuración:
- **Cámara**: feed en vivo con detección de objetos (COCO-SSD de TensorFlow.js)
- **Micrófono**: análisis de nivel de audio y detección de palabras clave
- **GPS**: coordenadas con precisión alta; las lecturas con precisión > 20 metros se descartan automáticamente

## Exportación de evidencia

Desde la página de Operaciones, el botón "Descargar JSON" genera un archivo con todos los eventos registrados, incluyendo:
- Timestamp ISO de exportación
- Cantidad total de eventos
- Cada evento con: id, tipo, timestamp, lat/lng, hash, previousHash, firma Dilithium, cryptoVerified, metadata, demo
- Indicador visual verde "Exportado" confirma que la descarga fue exitosa

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción
npm run typecheck # verificación de tipos
```

## Licencia

Propietario — © Sentra Visión

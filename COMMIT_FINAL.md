# Final commit: Sentra Vision unification

Resumen de los cambios incluidos en este commit final:

- Corrigiendo imports rotos y autoconteniendo la carga de TensorFlow en el hook de sensores.
- Agregados:
  - src/lib/ocr.ts — Wrapper para Tesseract.js (extractTextFromImage)
  - src/lib/geolocation.ts — Reverse geocoding y POI (Nominatim)
  - src/lib/emotions.ts — Wrapper ligero para detección de expresiones (face-api)
  - src/lib/a11y.ts — announceForScreenReader helper (aria-live)
  - src/core/MoralNode.ts — Nodo de moral con registro en hash chain y firma
- Integraciones:
  - src/voice/detection-voice-bridge.ts modificado para consultar al MoralNode antes de hablar, usar OCR/emoción y actualizar aria-live
  - src/hooks/useRealModeSensors.ts modificado para pasar video al bridge
- package.json actualizado: añadidas dependencias tesseract.js y @vladmandic/face-api

Notas importantes (acciones pendientes en entorno local / CI):

1) Instalar dependencias nuevas:
   npm install

2) Ejecutar typecheck y build localmente (no se ejecutaron aquí):
   npm run typecheck
   npm run build

3) Modelos para face-api: coloca los archivos de modelo en public/models/ (tiny_face_detector and face_expression_model) o apunta a una URL válida.

4) Recomendación: añadir un workflow de CI (GitHub Actions) para instalar, typecheck y build automáticamente. Puedo crear ese workflow si lo deseás.

Archivos creados/modificados están listados arriba. Si querés, puedo ahora crear el workflow CI y/o ejecutar más cambios.

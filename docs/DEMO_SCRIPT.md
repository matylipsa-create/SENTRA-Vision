# Script de Demo UMADESCA — Aegis v3.1.1-PROT

**Duración estimada:** 12-15 minutos
**Objetivo:** Mostrar Aegis como sistema soberano de seguridad con veto humano, evidencia criptográfica y modo offline.

---

## 1. Apertura — Landing (2 min)

**Acción:** Mostrar la landing page.

**Narrar:**
> "Aegis es un sistema soberano de seguridad y asistencia. La frase clave es: la IA sugiere, el humano decide. No reemplaza el juicio del operador, lo amplifica."

**Puntos a destacar:**
- Offline-first: funciona sin internet
- Procesamiento local: los datos no salen del dispositivo
- Veto humano: ninguna acción crítica se ejecuta sin confirmación
- Post-cuántica: firma Dilithium + hash chain

**Clic:** "Probar la demo" → entra a la PWA.

---

## 2. Modo Normal — Vista del Operador (3 min)

**Acción:** Asegurarse de estar en Modo Normal (toggle en Settings si es necesario).

**Narrar:**
> "Esta es la vista que ve un operador en el campo. Sin tecnicismos."

**Mostrar:**
- Banner de estado: "Sistema seguro" (verde) con texto claro
- Botones de emergencia: PÁNICO, 911, 107, 103
- Cámara en vivo (si hay webcam disponible)
- Navegación inferior: Centro, Operaciones, Regulación, Ajustes

**Punto clave:** "Todo está en español, sin jerga técnica. El operador ve estado, eventos y acciones."

---

## 3. Modo Técnico — Vista del Supervisor (3 min)

**Acción:** Cambiar a Modo Técnico desde Settings.

**Narrar:**
> "Ahora activamos el modo técnico. Esto es lo que ve un supervisor o técnico en operaciones."

**Mostrar:**
- Métricas: Confianza (%) y Carga Cognitiva (%)
- Panel de métricas Aegis (botón Aegis en TopBar)
- Estado de módulos: Visión, Audio, GPS, Crypto
- Eventos con detalles: hash, firma, timestamp

**Punto clave:** "El supervisor tiene visibilidad completa del sistema, pero el operador no se ve abrumado."

---

## 4. Exportación de Evidencia (2 min)

**Acción:** Ir a Operaciones, generar eventos demo, luego clic en "Descargar JSON".

**Narrar:**
> "Cada evento detectado queda registrado con firma criptográfica Dilithium y encadenado por hash. Esto es evidencia inmutable."

**Mostrar:**
- Lista de eventos con iconos de verificación (verde = verificado)
- Estado de la cadena: "Cadena intacta" o "Comprometida"
- Clic en "Descargar JSON" → el botón cambia a verde con "Exportado"
- Abrir el JSON descargado y mostrar: timestamp, hash, firma, metadata

**Punto clave:** "La evidencia es exportable y verificable por terceros. No depende de Aegis."

---

## 5. Modo Real — Sensores (2 min)

**Acción:** En Settings, activar "Modo Real".

**Narrar:**
> "Hasta ahora vimos modo demostración. En modo real, Aegis usa los sensores del dispositivo."

**Mostrar:**
- Cámara: feed en vivo con detección de objetos (COCO-SSD)
- Micrófono: indicador de nivel de audio
- GPS: coordenadas con precisión (lecturas > 20m se descartan)

**Punto clave:** "El GPS filtra lecturas imprecisas. Solo se registran coordenadas con precisión menor a 20 metros."

---

## 6. Cierre (1-2 min)

**Narrar:**
> "Aegis es:
> - Soberano: tus datos no salen de tu dispositivo
> - Verificable: evidencia criptográfica exportable
> - Humano: el veto está en el centro de cada decisión
> - Offline: funciona sin internet
>
> Está listo para validación con UMADESCA. Gracias."

---

## Checklist pre-demo

- [ ] Dev server corriendo
- [ ] Navegador en pantalla completa
- [ ] Webcam conectada (para modo Real)
- [ ] Permisos de cámara/micro/GPS otorgados previamente
- [ ] Eventos demo cargados (esperar 15-30 segundos)
- [ ] Modo Normal activo al inicio
- [ ] JSON de ejemplo descargado previamente para mostrar

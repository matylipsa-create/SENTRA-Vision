import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

// NOTE:
// The repo didn't include a ../vision/detector or ../events module. To avoid broken imports,
// this hook provides a self-contained loader/detector using @tensorflow-models/coco-ssd.
// Calls that previously emitted a global "generateEvent" have been removed — detections are
// still set into app state via setDetectedObjects and passed to the bridge if present.

let _model: any | null = null;
let _loadingModel = false;

/**
 * Load the COCO-SSD model if not already loaded.
 */
async function loadModel() {
  if (_model) return _model;
  if (_loadingModel) {
    while (_loadingModel && !_model) {
      // small wait until model loads
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    return _model;
  }
  _loadingModel = true;
  try {
    const coco = await import('@tensorflow-models/coco-ssd');
    // ensure tfjs loaded
    await import('@tensorflow/tfjs');
    _model = await coco.load();
    return _model;
  } catch (e) {
    _model = null;
    return null;
  } finally {
    _loadingModel = false;
  }
}

/** Has the model finished loading? */
function isModelLoaded(): boolean {
  return _model !== null;
}

/**
 * Run detection on the given HTMLVideoElement.
 * Returns an array of prediction objects from coco-ssd filtered by minScore.
 */
async function detectObjects(video: HTMLVideoElement, minScore = 0.5): Promise<any[]> {
  const model = await loadModel();
  if (!model) return [];
  try {
    const preds: any[] = await model.detect(video as any);
    if (!Array.isArray(preds)) return [];
    if (typeof minScore !== 'number') return preds;
    return preds.filter((p) => (p.score ?? 0) >= minScore);
  } catch {
    return [];
  }
}

export default function useRealModeSensors() {
  const { state, updateSettings, setDetectedObjects } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectionRafRef = useRef<number | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const voiceManagerRef = useRef<any>(null);
  const bridgeRef = useRef<any>(null);

  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
  };

  useEffect(() => {
    const realMode = !!state.settings.realMode;
    const powerSaving = !!state.settings.powerSavingMode;
    cancelledRef.current = false;

    if (!realMode || powerSaving) {
      // stop sensors / voice
      if (detectionRafRef.current) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }

      if (voiceManagerRef.current) {
        try { voiceManagerRef.current.cancel(); } catch (_) {}
        try { voiceManagerRef.current.stopRecognition(); } catch (_) {}
        voiceManagerRef.current = null;
      }
      if (bridgeRef.current) bridgeRef.current = null;

      return;
    }

    // Start model loading in background (non-blocking)
    loadModel().catch(() => { /* ignore load errors here */ });

    // Start detection loop when model is loaded or after a short wait
    const startWhenReady = async () => {
      let tries = 0;
      while (!_model && tries < 40) { // wait up to ~2s (40*50ms)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
        tries += 1;
      }

      const runDetection = async () => {
        if (cancelledRef.current) return;
        if (!videoRef.current || !videoRef.current.videoWidth) {
          detectionRafRef.current = requestAnimationFrame(runDetection);
          return;
        }

        try {
          const objects = await detectObjects(videoRef.current, 0.5);
          if (!cancelledRef.current) {
            try {
              setDetectedObjects(objects);
            } catch (_) {}

            try {
              bridgeRef.current?.handlePredictions(objects || []);
            } catch (_) {}

            // Previously, the code emitted a global event (generateEvent) when
            // objects were detected. That function/module is not present in this
            // repository, so we do not call it here. If you need centralized event
            // emission, implement generateEvent in src/lib/events.ts and reintroduce
            // the call.
            if (objects.length > 0) {
              const now = Date.now();
              if (now - lastEventTimeRef.current > 5000) {
                lastEventTimeRef.current = now;
                // Optional: additional per-detection logic can go here.
              }
            }
          }
        } catch {
          // swallow per-frame detection errors
        }

        detectionRafRef.current = requestAnimationFrame(runDetection);
      };

      detectionRafRef.current = requestAnimationFrame(runDetection);
    };

    startWhenReady().catch(() => { /* ignore */ });

    return () => {
      cancelledRef.current = true;
      if (detectionRafRef.current) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }
    };
  }, [state.settings.realMode, state.settings.powerSavingMode, setDetectedObjects]);

  return { setVideo };
}

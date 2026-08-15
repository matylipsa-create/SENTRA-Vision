import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { generateEvent } from '../events';

// NOTE:
// The repo didn't include a ../vision/detector module. To avoid a broken import,
// provide a small, self-contained loader/detector here that uses the installed
// @tensorflow-models/coco-ssd and @tensorflow/tfjs packages. We keep types loose
// (any) to avoid strict TS coupling with @types packages.

let _model: any | null = null;
let _loadingModel = false;

/**
 * Load the COCO-SSD model if not already loaded.
 */
async function loadModel() {
  if (_model) return _model;
  if (_loadingModel) {
    // wait until previously started load finishes
    while (_loadingModel && !_model) {
      // small busy wait; in practice this will be fast
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    return _model;
  }
  _loadingModel = true;
  try {
    // dynamic import to avoid bundling issues when running in environments without TF
    const coco = await import('@tensorflow-models/coco-ssd');
    // ensure tf backend loaded (tfjs is a dependency)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await import('@tensorflow/tfjs');
    _model = await coco.load();
    return _model;
  } catch (e) {
    // If model fails to load, leave _model null and surface no detections.
    // Consumers should handle absence gracefully.
    _model = null;
    return null;
  } finally {
    _loadingModel = false;
  }
}

/**
 * Has the model finished loading?
 */
function isModelLoaded(): boolean {
  return _model !== null;
}

/**
 * Run detection on the given HTMLVideoElement.
 * Returns an array of prediction objects from coco-ssd, filtered by minScore.
 */
async function detectObjects(video: HTMLVideoElement, minScore = 0.5): Promise<any[]> {
  const model = await loadModel();
  if (!model) return [];
  try {
    // coco-ssd `detect` accepts video elements directly
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

    // Start detection loop when model is loaded or after load completes
    const startWhenReady = async () => {
      // wait until model loaded (but don't loop forever)
      let tries = 0;
      while (!_model && tries < 40) { // wait up to ~2s (40*50ms)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 50));
        tries += 1;
      }
      // proceed even if model not loaded; detectObjects will gracefully return []
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

            if (objects.length > 0) {
              const now = Date.now();
              if (now - lastEventTimeRef.current > 5000) {
                lastEventTimeRef.current = now;
                const topObject = objects[0];
                generateEvent({
                  type: 'OBJECT_DETECTED',
                  metadata: {
                    source: 'tfjs-coco-ssd',
                    confidence: Math.round((topObject as any).score * 100),
                    objectClass: (topObject as any).class,
                    objectCount: objects.length,
                  },
                }, null, objects);
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

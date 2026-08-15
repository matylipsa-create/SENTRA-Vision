import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useApp } from '../context/AppContext';
import { isModelLoaded, detectObjects } from '../vision/detector';
import { generateEvent } from '../events';

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

    // Start detection loop when model is loaded
    if (isModelLoaded()) {
      const runDetection = async () => {
        if (cancelledRef.current) return;
        if (!videoRef.current || !videoRef.current.videoWidth) {
          detectionRafRef.current = requestAnimationFrame(runDetection);
          return;
        }

        try {
          const objects = await detectObjects(videoRef.current, 0.5);
          if (!cancelledRef.current) {
            setDetectedObjects(objects);
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
        } catch (e) {
          // noop - swallow errors during detection
        }

        detectionRafRef.current = requestAnimationFrame(runDetection);
      };

      detectionRafRef.current = requestAnimationFrame(runDetection);
    }

    return () => {
      cancelledRef.current = true;
      if (detectionRafRef.current) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }
    };
  }, [state.settings.realMode, state.settings.powerSavingMode]);

  return { setVideo };
}

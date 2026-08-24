import { useEffect, useRef, useState, useCallback } from 'react';

let _model: any = null;
let _loadingModel = false;

async function loadModel(): Promise<any> {
  if (_model) return _model;
  if (_loadingModel) {
    while (_loadingModel && !_model) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return _model;
  }
  _loadingModel = true;
  try {
    const coco = await import('@tensorflow-models/coco-ssd');
    await import('@tensorflow/tfjs');
    _model = await coco.load({ base: 'lite_mobilenet_v2' });
    return _model;
  } catch {
    _model = null;
    return null;
  } finally {
    _loadingModel = false;
  }
}

export interface DetectionResult {
  count: number;
  labels: string[];
  modelReady: boolean;
  modelError: boolean;
}

export function useObjectDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  active: boolean,
): DetectionResult {
  const [count, setCount] = useState(0);
  const [labels, setLabels] = useState<string[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState(false);
  const rafRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detect = useCallback(async () => {
    if (cancelledRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !_model) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    try {
      const predictions: any[] = await _model.detect(video, 20, 0.5);
      if (!cancelledRef.current) {
        setCount(predictions.length);
        setLabels(predictions.map((p) => p.class));
      }
    } catch {
      // swallow per-frame errors
    }
    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  useEffect(() => {
    cancelledRef.current = false;

    if (!active) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCount(0);
      setLabels([]);
      return;
    }

    // Start model loading
    loadModel()
      .then((model) => {
        if (cancelledRef.current) return;
        if (model) {
          setModelReady(true);
          setModelError(false);
          rafRef.current = requestAnimationFrame(detect);
        } else {
          setModelError(true);
        }
      })
      .catch(() => {
        if (!cancelledRef.current) setModelError(true);
      });

    // Fallback: poll detection at 1s intervals in case RAF stalls
    intervalRef.current = setInterval(async () => {
      if (cancelledRef.current || !_model) return;
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      try {
        const predictions: any[] = await _model.detect(video, 20, 0.5);
        if (!cancelledRef.current) {
          setCount(predictions.length);
          setLabels(predictions.map((p) => p.class));
        }
      } catch {
        // swallow
      }
    }, 1000);

    return () => {
      cancelledRef.current = true;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, videoRef, detect]);

  return { count, labels, modelReady, modelError };
}

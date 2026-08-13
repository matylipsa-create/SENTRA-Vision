import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { initPerceptionEngine, detectObjects, analyzeAudioFrame, shouldTriggerVeto, isModelLoaded, isModelLoadFailed } from '../core/PerceptionEngine';
import { sendEvent } from '../lib/pipedream';
import type { SecurityEvent } from '../types';

export function useRealModeSensors() {
  const { state, setSensors, signAndChain, addEvent, setAlertLevel, setDetectedObjects, addAudioAlert, setTfjsStatus, setConfidence, incrementTelegramCount, markEventTelegramSent } = useApp();
  const watchIdRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectionRafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastEventTimeRef = useRef<number>(0);
  const lastAudioAlertTimeRef = useRef<number>(0);

  const realMode = state.settings.realMode;
  const powerSaving = state.settings.powerSavingMode;

  const setVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
  };

  useEffect(() => {
    if (!realMode || powerSaving) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (detectionRafRef.current !== null) {
        cancelAnimationFrame(detectionRafRef.current);
        detectionRafRef.current = null;
      }
      setSensors({
        audioActive: false,
        gpsActive: false,
        audioError: null,
        gpsError: null,
        audioLevel: 0,
      });
      setDetectedObjects([]);
      setTfjsStatus(false, false);
      return;
    }

    let cancelled = false;

    async function startSensors() {
      await initPerceptionEngine();
      if (cancelled) return;
      setTfjsStatus(isModelLoaded(), isModelLoadFailed());

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setSensors({ audioError: 'getUserMedia no soportado' });
        } else {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
          audioStreamRef.current = stream;
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          const ctx = new AC();
          audioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.6;
          source.connect(analyser);
          analyserRef.current = analyser;
          setSensors({ audioActive: true, audioError: null });

          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const timeData = new Uint8Array(analyser.fftSize);
          const updateAudio = () => {
            if (cancelled || !analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(freqData);
            analyserRef.current.getByteTimeDomainData(timeData);
            const analysis = analyzeAudioFrame(freqData, timeData);
            setSensors({ audioLevel: analysis.level });

            const now = Date.now();
            if (analysis.isSpike && now - lastAudioAlertTimeRef.current > 3000) {
              lastAudioAlertTimeRef.current = now;
              addAudioAlert({
                id: `audio-${now}-${Math.random().toString(36).slice(2, 6)}`,
                timestamp: now,
                level: analysis.level,
                keyword: analysis.keyword,
                isSpike: analysis.isSpike,
              });

              if (now - lastEventTimeRef.current > 5000) {
                lastEventTimeRef.current = now;
                generateEvent({
                  type: analysis.keywordDetected ? 'AUDIO_KEYWORD' : 'AUDIO_ANOMALY',
                  metadata: {
                    source: 'tfjs-audio',
                    confidence: Math.min(100, analysis.level + 10),
                    keyword: analysis.keyword,
                    audioLevel: analysis.level,
                  },
                }, analysis);
              }
            }
            rafRef.current = requestAnimationFrame(updateAudio);
          };
          rafRef.current = requestAnimationFrame(updateAudio);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setSensors({ audioError: msg, audioActive: false });
      }

      if (isModelLoaded()) {
        const runDetection = async () => {
          if (cancelled || !videoRef.current || !videoRef.current.videoWidth) {
            detectionRafRef.current = requestAnimationFrame(runDetection);
            return;
          }
          try {
            const objects = await detectObjects(videoRef.current, 0.5);
            if (!cancelled) {
              setDetectedObjects(objects);
              if (objects.length > 0) {
                const now = Date.now();
                if (now - lastEventTimeRef.current > 5000) {
                  lastEventTimeRef.current = now;
                  const topObject = objects[0];
                  generateEvent({
                    type: 'OBJECT_DETECTED',
                    metadata: {
                      source: 'tfjs-coco-ssd',
                      confidence: Math.round(topObject.score * 100),
                      objectClass: topObject.class,
                      objectCount: objects.length,
                    },
                  }, null, objects);
                }
              }
            }
          } catch {
            // noop
          }
          detectionRafRef.current = requestAnimationFrame(runDetection);
        };
        detectionRafRef.current = requestAnimationFrame(runDetection);
      }

      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelled) return;
            // Precision filter: discard readings worse than 20 meters
            if (typeof pos.coords.accuracy === 'number' && pos.coords.accuracy > 20) {
              return;
            }
            setSensors({
              gpsActive: true,
              gpsError: null,
              gpsLat: pos.coords.latitude,
              gpsLng: pos.coords.longitude,
            });
          },
          (err) => {
            if (cancelled) return;
            setSensors({ gpsError: err.message, gpsActive: false });
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
        );
      } else {
        setSensors({ gpsError: 'Geolocation no soportado', gpsActive: false });
      }
    }

    async function generateEvent(
      partial: { type: string; metadata: Record<string, unknown> },
      audio: { level: number; keywordDetected: boolean; keyword: string | null; isSpike: boolean } | null,
      objects: { class: string; score: number }[] = [],
    ) {
      if (cancelled) return;
      const vetoCheck = shouldTriggerVeto(
        objects.map(o => ({ class: o.class, score: o.score, bbox: [0, 0, 0, 0] })),
        audio,
      );
      const baseEvent = {
        id: `tfjs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: partial.type,
        timestamp: Date.now(),
        lat: state.sensors.gpsLat ?? -34.6037,
        lng: state.sensors.gpsLng ?? -58.3816,
        metadata: { ...partial.metadata, vetoTriggered: vetoCheck.veto, vetoReason: vetoCheck.reason },
        demo: false,
      };
      const event: SecurityEvent = await signAndChain(baseEvent);
      if (cancelled) return;
      addEvent(event);
      // Dispatch real events to Telegram webhook
      sendEvent(event).then(ok => {
        if (ok && !cancelled) {
          incrementTelegramCount();
          markEventTelegramSent(event.id);
        }
      });
      if (vetoCheck.veto) {
        setAlertLevel('CRITICO');
        setConfidence(40);
      } else {
        setAlertLevel('ALERTA');
        setConfidence(partial.metadata.confidence as number ?? 75);
      }
    }

    startSensors();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null && navigator.geolocation) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      if (audioStreamRef.current) { audioStreamRef.current.getTracks().forEach(t => t.stop()); audioStreamRef.current = null; }
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (detectionRafRef.current !== null) { cancelAnimationFrame(detectionRafRef.current); detectionRafRef.current = null; }
    };
  }, [realMode, powerSaving, setSensors, signAndChain, addEvent, setAlertLevel, setDetectedObjects, addAudioAlert, setTfjsStatus, setConfidence, incrementTelegramCount, markEventTelegramSent, state.sensors.gpsLat, state.sensors.gpsLng]);

  return { setVideo };
}

// src/voice/detection-voice-bridge.ts
import VoiceManager from './voice';
import vmSingleton from './manager';
import { shouldSpeak, type MoralContext } from '../core/MoralNode';
import { generateTCREIPrompt, type SentraEvent, type TCREIPrompt } from '../core/TCREIBridge';
import { sendTCREIPrompt } from '../services/GeminiService';

interface Prediction { class: string; score: number; bbox?: number[] }

type RelevanceTier = 'safety' | 'obstacle' | 'navigation' | 'everyday' | 'low';

const RELEVANCE_WEIGHTS: Record<RelevanceTier, number> = {
  safety: 5,
  obstacle: 3,
  navigation: 2,
  everyday: 1,
  low: 0,
};

const NAVIGATION_CLASSES: Set<string> = new Set([
  'person', 'chair', 'dining_table', 'couch', 'bed', 'bench', 'toilet', 'sink',
  'refrigerator', 'oven', 'microwave', 'stop_sign', 'fire_hydrant', 'parking_meter',
  'bus', 'car', 'truck', 'motorcycle', 'bicycle',
]);

const EVERYDAY_CLASSES: Set<string> = new Set([
  'tv', 'laptop', 'cell_phone', 'clock', 'vase', 'bottle', 'cup', 'bowl',
  'book', 'potted_plant', 'umbrella', 'backpack', 'handbag', 'suitcase',
]);

const SAFETY_CLASSES: Set<string> = new Set([
  'knife', 'scissors', 'bicycle', 'motorcycle', 'car', 'truck', 'bus',
  'stop_sign', 'fire_hydrant', 'traffic_light', 'bench',
]);

function classifyRelevance(label: string): RelevanceTier {
  if (SAFETY_CLASSES.has(label)) return 'safety';
  if (NAVIGATION_CLASSES.has(label)) return 'navigation';
  if (EVERYDAY_CLASSES.has(label)) return 'everyday';
  return 'low';
}

interface TrackedObject {
  consecutiveSeen: number;
  lastSeenTs: number;
  lastSpokenTs: number;
  count: number;
  confirmedLabel: string | null;
  pendingLabel: string | null;
  pendingCount: number;
  disappearedSpoken: boolean;
  relevance: RelevanceTier;
}

export type VisionMode = 'navigation' | 'recognition';

export type TCREIInteractionRecorder = (
  prompt: TCREIPrompt,
  response: string,
  event: SentraEvent,
) => Promise<void>;

interface MotionReading {
  ts: number;
  magnitude: number;
}

export default class DetectionVoiceBridge {
  vm: VoiceManager;
  scoreThreshold: number;
  minFramesToConfirm: number;
  forgetMs: number;
  speakPriority: number;
  tracked: Map<string, TrackedObject>;

  private _motionActive: boolean = false;
  private _motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
  private _motionReadings: MotionReading[] = [];
  private _baseCooldownMs: number = 3000;
  private _currentCooldownMs: number = 3000;
  private _lastMotionUpdate: number = 0;

  private _touchStartTs: number = 0;
  private _touchStartX: number = 0;
  private _touchStartY: number = 0;
  private _lastTapTs: number = 0;
  private _lastDescription: string = '';

  private _visionMode: VisionMode = 'navigation';
  private _hapticsEnabled: boolean = true;
  private _recordInteraction: TCREIInteractionRecorder | null;

  constructor(
    voiceManager?: VoiceManager,
    {
      scoreThreshold = 0.5,
      minFramesToConfirm = 3,
      forgetMs = 3000,
      speakPriority = 0,
      recordInteraction,
    }: {
      scoreThreshold?: number;
      minFramesToConfirm?: number;
      forgetMs?: number;
      speakPriority?: number;
      recordInteraction?: TCREIInteractionRecorder;
    } = {},
  ) {
    this.vm = (voiceManager || (vmSingleton as unknown as VoiceManager));
    this.scoreThreshold = scoreThreshold;
    this.minFramesToConfirm = minFramesToConfirm;
    this.forgetMs = forgetMs;
    this.speakPriority = speakPriority;
    this._recordInteraction = recordInteraction ?? null;
    this.tracked = new Map();
  }

  get visionMode(): VisionMode { return this._visionMode; }
  get isMotionTracking(): boolean { return this._motionActive; }
  setHapticsEnabled(enabled: boolean): void { this._hapticsEnabled = enabled; }
  getCurrentCooldown(): number { return this._currentCooldownMs; }
  getLastDescription(): string { return this._lastDescription; }

  startMotionTracking(): boolean {
    if (this._motionActive) return true;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      this._motionActive = false;
      return false;
    }
    this._motionHandler = (e: DeviceMotionEvent) => { this._onDeviceMotion(e); };
    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DME.requestPermission === 'function') {
      DME.requestPermission()
        .then((state: string) => {
          if (state === 'granted') {
            window.addEventListener('devicemotion', this._motionHandler!, { passive: true });
            this._motionActive = true;
          } else {
            this._motionActive = false;
          }
        })
        .catch(() => { this._motionActive = false; });
    } else {
      window.addEventListener('devicemotion', this._motionHandler, { passive: true });
      this._motionActive = true;
    }
    return true;
  }

  stopMotionTracking(): void {
    if (this._motionHandler) {
      window.removeEventListener('devicemotion', this._motionHandler);
      this._motionHandler = null;
    }
    this._motionActive = false;
    this._motionReadings = [];
    this._currentCooldownMs = this._baseCooldownMs;
  }

  private _onDeviceMotion(e: DeviceMotionEvent): void {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const mag = Math.sqrt(
      (acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2,
    );
    const now = Date.now();
    this._motionReadings.push({ ts: now, magnitude: mag });
    const cutoff = now - 10_000;
    while (this._motionReadings.length > 0 && this._motionReadings[0].ts < cutoff) {
      this._motionReadings.shift();
    }
    if (now - this._lastMotionUpdate < 1000) return;
    this._lastMotionUpdate = now;
    const avgMag = this._motionReadings.reduce((s, r) => s + r.magnitude, 0) /
                   Math.max(1, this._motionReadings.length);
    if (avgMag > 15) this._currentCooldownMs = 1200;
    else if (avgMag > 11) this._currentCooldownMs = 2000;
    else if (avgMag > 9.8) this._currentCooldownMs = 3000;
    else this._currentCooldownMs = 4000;
  }

  private _vibrate(duration: number): void {
    if (!this._hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(duration);
  }

  private _vibrateForDistance(distanceLabel: string | null): void {
    if (!distanceLabel) return;
    if (distanceLabel === 'muy cerca') this._vibrate(80);
    else if (distanceLabel === 'cerca') this._vibrate(120);
    else if (distanceLabel === 'a media distancia') this._vibrate(250);
    else if (distanceLabel === 'lejos') this._vibrate(400);
  }

  private _vibrateDanger(): void {
    if (!this._hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
  }

  handleTouchStart(x: number, y: number): void {
    this._touchStartTs = Date.now();
    this._touchStartX = x;
    this._touchStartY = y;
  }

  handleTouchEnd(x: number, y: number): void {
    const dt = Date.now() - this._touchStartTs;
    const dx = Math.abs(x - this._touchStartX);
    const dy = Math.abs(y - this._touchStartY);
    if (dt > 300 || dx > 20 || dy > 20) return;
    const now = Date.now();
    const isDoubleTap = (now - this._lastTapTs) < 350;
    this._lastTapTs = now;
    if (isDoubleTap) this._toggleVisionMode();
    else this._repeatLastDescription();
  }

  private _toggleVisionMode(): void {
    this._visionMode = this._visionMode === 'navigation' ? 'recognition' : 'navigation';
    const msg = this._visionMode === 'navigation'
      ? 'Modo navegación activado.'
      : 'Modo reconocimiento activado.';
    this.vm.speak(msg, 10, { interrupt: true, rate: 1.2 });
    this._vibrate(60);
  }

  private _repeatLastDescription(): void {
    if (this._lastDescription) {
      this.vm.speak(this._lastDescription, 10, { interrupt: true, rate: 1.1 });
      this._vibrate(40);
    } else {
      this.vm.speak('Sin descripción previa.', 10, { interrupt: true, rate: 1.2 });
    }
  }

  handlePredictions(predictions: Prediction[] = [], frameWidth?: number, frameHeight?: number) {
    const now = Date.now();
    const seenLabels = new Set<string>();

    const sorted = [...predictions].sort((a, b) => {
      const aSafety = SAFETY_CLASSES.has(a.class) ? 0 : 1;
      const bSafety = SAFETY_CLASSES.has(b.class) ? 0 : 1;
      return aSafety - bSafety;
    });

    const hasSafetyItems = sorted.some(p => SAFETY_CLASSES.has(p.class));
    const filtered = this._visionMode === 'navigation' && hasSafetyItems
      ? sorted.filter(p => SAFETY_CLASSES.has(p.class))
      : sorted;

    for (const p of filtered) {
      if (!p.class || p.score < this.scoreThreshold) continue;
      const label = p.class;
      seenLabels.add(label);

      let recorded = this.tracked.get(label);
      if (!recorded) {
        recorded = {
          consecutiveSeen: 0,
          lastSeenTs: 0,
          lastSpokenTs: 0,
          count: 0,
          confirmedLabel: null,
          pendingLabel: label,
          pendingCount: 1,
          disappearedSpoken: false,
          relevance: classifyRelevance(label),
        };
      }

      recorded.consecutiveSeen += 1;
      recorded.lastSeenTs = now;
      recorded.count += 1;

      if (recorded.pendingLabel === label) {
        recorded.pendingCount += 1;
      } else {
        recorded.pendingLabel = label;
        recorded.pendingCount = 1;
      }

      if (recorded.pendingCount >= this.minFramesToConfirm && recorded.confirmedLabel !== label) {
        recorded.confirmedLabel = label;
      }

      if (recorded.confirmedLabel === label && recorded.consecutiveSeen >= this.minFramesToConfirm) {
        const cooldown = recorded.relevance === 'safety'
          ? Math.min(this._currentCooldownMs, 800)
          : this._currentCooldownMs;
        if ((now - recorded.lastSpokenTs) > cooldown) {
          const text = this._formatAppearance(label, p, frameWidth, frameHeight);
          const priority = this.speakPriority + RELEVANCE_WEIGHTS[recorded.relevance];
          this._speakWithMoralCheck(text, priority, p.score);
          if (recorded.relevance === 'safety') {
            this._vibrateDanger();
          } else {
            const ctx = this._computePositionAndDistance(p, frameWidth, frameHeight);
            this._vibrateForDistance(ctx.distance);
          }
          this._lastDescription = text;
          recorded.lastSpokenTs = now;
        }
      }

      this.tracked.set(label, recorded);
    }

    for (const [label, info] of Array.from(this.tracked.entries())) {
      if (!seenLabels.has(label)) {
        const age = now - (info.lastSeenTs || 0);
        if (age > this.forgetMs) {
          if (!info.disappearedSpoken && info.confirmedLabel) {
            const text = this._formatDisappearance(label);
            this.vm.speak(text, this.speakPriority - 1, { interrupt: false });
            info.disappearedSpoken = true;
          }
          if (age > this.forgetMs * 3) {
            this.tracked.delete(label);
          } else {
            info.consecutiveSeen = 0;
            info.pendingCount = 0;
            this.tracked.set(label, info);
          }
        } else {
          info.consecutiveSeen = Math.max(0, info.consecutiveSeen - 1);
          info.pendingCount = Math.max(0, info.pendingCount - 1);
          this.tracked.set(label, info);
        }
      } else {
        if (info.disappearedSpoken) {
          info.disappearedSpoken = false;
          this.tracked.set(label, info);
        }
      }
    }
  }

  private async _speakWithMoralCheck(text: string, priority: number, score: number) {
    const ctx: MoralContext = {
      source: 'vision-detection',
      confidence: score,
      operatorConsent: true,
      demo: false,
    };
    const { allowed, message } = await shouldSpeak(text, ctx);
    if (allowed) {
      const event: SentraEvent = {
        tipo: 'obstáculo o peligro',
        objeto: text,
        confianza: score,
        entorno: 'cámara del dispositivo',
        estado_sistema: 'modo real activo',
        timestamp: Date.now(),
      };
      const prompt = generateTCREIPrompt(event);
      void sendTCREIPrompt(prompt).then(async (response) => {
        if (this._recordInteraction) await this._recordInteraction(prompt, response, event);
        this.vm.speak(response, priority, { interrupt: priority >= 5, rate: 1.15 });
      });
    } else if (message) {
      console.warn(`[MoralNode] Descripción vetada: ${message}`);
    }
  }

  speakOcrText(text: string) {
    if (!text || text.trim().length < 2) return;
    const priority = this.speakPriority + RELEVANCE_WEIGHTS['navigation'];
    const clean = text.trim().slice(0, 80);
    this._lastDescription = `Texto: ${clean}`;
    this.vm.speak(`Texto: ${clean}`, priority, { interrupt: false });
  }

  _mapLabelToSpanish(label: string) {
    const map: Record<string, string> = {
      person: 'persona', dog: 'perro', cat: 'gato', car: 'auto', bicycle: 'bicicleta',
      bottle: 'botella', chair: 'silla', couch: 'sofá', tv: 'televisor', laptop: 'computadora',
      motorcycle: 'moto', bus: 'colectivo', truck: 'camión', backpack: 'mochila',
      handbag: 'bolso', suitcase: 'valija', cell_phone: 'celular', cup: 'taza',
      fork: 'tenedor', knife: 'cuchillo', spoon: 'cuchara', bowl: 'cuenco',
      banana: 'banana', apple: 'manzana', sandwich: 'sándwich', orange: 'naranja',
      clock: 'reloj', vase: 'jarrón', scissors: 'tijeras', teddy_bear: 'oso de peluche',
      hair_drier: 'secador de pelo', toothbrush: 'cepillo de dientes', toilet: 'inodoro',
      sink: 'pileta', mouse: 'mouse', keyboard: 'teclado', remote: 'control remoto',
      microwave: 'microondas', oven: 'horno', toaster: 'tostadora', refrigerator: 'heladera',
      book: 'libro', potted_plant: 'planta', dining_table: 'mesa', bed: 'cama',
      sports_ball: 'pelota', kite: 'cometa', baseball_bat: 'bate de béisbol',
      baseball_glove: 'guante de béisbol', skateboard: 'skate', surfboard: 'tabla de surf',
      tennis_racket: 'raqueta de tenis', frisbee: 'frisbee', skis: 'esquíes',
      snowboard: 'snowboard', stop_sign: 'cartel de pare', fire_hydrant: 'boca de incendio',
      parking_meter: 'parquímetro', bench: 'banco', umbrella: 'paraguas', tie: 'corbata',
      traffic_light: 'semáforo',
    };
    return map[label] || label;
  }

  _computePositionAndDistance(prediction: Prediction, frameW?: number, frameH?: number) {
    const bbox = prediction.bbox;
    if (!bbox || bbox.length < 4) return { position: null as string | null, distance: null as string | null };

    let [x, y, w, h] = bbox;
    const isNormalized = (w <= 1 && h <= 1 && x <= 1 && y <= 1);
    let relCenterX = 0.5;
    let relArea = 0.01;

    if (isNormalized) {
      relCenterX = (x + w / 2);
      relArea = w * h;
    } else if (frameW && frameH) {
      relCenterX = (x + w / 2) / frameW;
      relArea = (w * h) / (frameW * frameH);
    } else {
      const fallbackW = 640;
      const fallbackH = 480;
      relCenterX = (x + w / 2) / fallbackW;
      relArea = (w * h) / (fallbackW * fallbackH);
    }

    let position: string | null = null;
    if (relCenterX < 0.33) position = 'izquierda';
    else if (relCenterX > 0.66) position = 'derecha';
    else position = 'frente';

    let distance: string | null = null;
    if (relArea > 0.12) distance = 'muy cerca';
    else if (relArea > 0.04) distance = 'cerca';
    else if (relArea > 0.01) distance = 'a media distancia';
    else distance = 'lejos';

    return { position, distance };
  }

  _formatAppearance(label: string, prediction: Prediction, frameW?: number, frameH?: number) {
    const esp = this._mapLabelToSpanish(label);
    const ctx = this._computePositionAndDistance(prediction, frameW, frameH);
    const name = esp.charAt(0).toUpperCase() + esp.slice(1);
    const isSafety = SAFETY_CLASSES.has(label);
    const parts: string[] = [name];

    if (isSafety && ctx.distance === 'muy cerca') {
      parts.push('peligro, 1m');
      return parts.join(', ') + '.';
    }

    if (ctx.position) parts.push(ctx.position);
    if (ctx.distance) {
      const shortDist = ctx.distance === 'muy cerca' ? '1m'
        : ctx.distance === 'cerca' ? '2m'
        : ctx.distance === 'a media distancia' ? '5m'
        : 'lejos';
      parts.push(shortDist);
    }

    return parts.join(', ') + '.';
  }

  _formatDisappearance(label: string) {
    const esp = this._mapLabelToSpanish(label);
    return `${esp.charAt(0).toUpperCase() + esp.slice(1)} fuera de vista.`;
  }
}

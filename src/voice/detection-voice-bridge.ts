// src/voice/detection-voice-bridge.ts
import VoiceManager from './voice';
import vmSingleton from './manager';
import { shouldSpeak, type MoralContext } from '../core/MoralNode';

interface Prediction { class: string; score: number; bbox?: number[] }

export default class DetectionVoiceBridge {
  vm: VoiceManager;
  scoreThreshold: number;
  minFramesToConfirm: number;
  forgetMs: number;
  speakPriority: number;
  tracked: Map<string, any>;

  // option: pass vm (for testability) or use default singleton
  constructor(voiceManager?: VoiceManager, {
    scoreThreshold = 0.5,
    minFramesToConfirm = 2,
    forgetMs = 2000,
    speakPriority = 0
  } = {}) {
    this.vm = (voiceManager || (vmSingleton as unknown as VoiceManager));
    this.scoreThreshold = scoreThreshold;
    this.minFramesToConfirm = minFramesToConfirm;
    this.forgetMs = forgetMs;
    this.speakPriority = speakPriority;
    this.tracked = new Map();
  }

  /**
   * Handle predictions.
   * predictions: array from COCO-SSD: { class, score, bbox? }
   * Optionally pass frameWidth and frameHeight so we can compute positions/distances:
   * handlePredictions(predictions, frameWidth?, frameHeight?)
   */
  handlePredictions(predictions: Prediction[] = [], frameWidth?: number, frameHeight?: number) {
    const now = Date.now();
    const seenLabels = new Set<string>();

    for (const p of predictions) {
      if (!p.class || p.score < this.scoreThreshold) continue;
      const label = p.class;
      seenLabels.add(label);
      const recorded = this.tracked.get(label) || { consecutiveSeen: 0, lastSeenTs: 0, lastSpokenTs: 0, count: 0 };
      recorded.consecutiveSeen += 1;
      recorded.lastSeenTs = now;
      recorded.count += 1;
      this.tracked.set(label, recorded);

      if (recorded.consecutiveSeen >= this.minFramesToConfirm) {
        const text = this._formatAppearance(label, p, frameWidth, frameHeight);
        const priority = (label === 'person' || label === 'persona') ? this.speakPriority + 1 : this.speakPriority;
        if ((now - recorded.lastSpokenTs) > 3000) {
          this._speakWithMoralCheck(text, priority, p.score);
          recorded.lastSpokenTs = now;
          this.tracked.set(label, recorded);
        }
      }
    }

    for (const [label, info] of Array.from(this.tracked.entries())) {
      if (!seenLabels.has(label)) {
        const age = now - (info.lastSeenTs || 0);
        if (age > this.forgetMs) {
          if (!info.disappearedSpoken) {
            const text = this._formatDisappearance(label);
            this.vm.speak(text, this.speakPriority - 1, { interrupt: false });
            info.disappearedSpoken = true;
            this.tracked.set(label, info);
          }
          if (age > this.forgetMs * 3) {
            this.tracked.delete(label);
          } else {
            info.consecutiveSeen = 0;
            this.tracked.set(label, info);
          }
        } else {
          info.consecutiveSeen = Math.max(0, info.consecutiveSeen - 1);
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
      this.vm.speak(text, priority, { interrupt: false });
    } else if (message) {
      console.warn(`[MoralNode] Descripción vetada: ${message}`);
    }
  }

  _mapLabelToSpanish(label: string) {
    const map: Record<string, string> = {
      person: 'persona',
      dog: 'perro',
      cat: 'gato',
      car: 'auto',
      bicycle: 'bicicleta',
      bottle: 'botella',
      chair: 'silla',
      couch: 'sofá',
      tv: 'televisor',
      laptop: 'computadora',
      motorcycle: 'moto',
      bus: 'colectivo',
      truck: 'camión',
      backpack: 'mochila',
      handbag: 'bolso',
      suitcase: 'valija',
      cell_phone: 'celular',
      cup: 'taza',
      fork: 'tenedor',
      knife: 'cuchillo',
      spoon: 'cuchara',
      bowl: 'cuenco',
      banana: 'banana',
      apple: 'manzana',
      sandwich: 'sándwich',
      orange: 'naranja',
      clock: 'reloj',
      vase: 'jarrón',
      scissors: 'tijeras',
      teddy_bear: 'oso de peluche',
      hair_drier: 'secador de pelo',
      toothbrush: 'cepillo de dientes',
      toilet: 'inodoro',
      sink: 'pileta',
      mouse: 'mouse',
      keyboard: 'teclado',
      remote: 'control remoto',
      microwave: 'microondas',
      oven: 'horno',
      toaster: 'tostadora',
      refrigerator: 'heladera',
      book: 'libro',
      potted_plant: 'planta',
      dining_table: 'mesa',
      bed: 'cama',
      sports_ball: 'pelota',
      kite: 'cometa',
      baseball_bat: 'bate de béisbol',
      baseball_glove: 'guante de béisbol',
      skateboard: 'skate',
      surfboard: 'tabla de surf',
      tennis_racket: 'raqueta de tenis',
      frisbee: 'frisbee',
      skis: 'esquíes',
      snowboard: 'snowboard',
      stop_sign: 'cartel de pare',
      fire_hydrant: 'boca de incendio',
      parking_meter: 'parquímetro',
      bench: 'banco',
      umbrella: 'paraguas',
      tie: 'corbata',
    };
    return map[label] || label;
  }

  _computePositionAndDistance(prediction: Prediction, frameW?: number, frameH?: number) {
    const bbox = prediction.bbox;
    if (!bbox || bbox.length < 4) return { position: null, distance: null };

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
    if (relCenterX < 0.33) position = 'a la izquierda';
    else if (relCenterX > 0.66) position = 'a la derecha';
    else position = 'al frente';

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
    const fragments: string[] = [];

    const name = esp.charAt(0).toUpperCase() + esp.slice(1);

    if (ctx.position) fragments.push(ctx.position);
    if (ctx.distance) fragments.push(ctx.distance);

    if (fragments.length) {
      return `${name} ${fragments.join(', ')}.`;
    }
    return `${name} detectada.`;
  }

  _formatDisappearance(label: string) {
    const esp = this._mapLabelToSpanish(label);
    return `${esp.charAt(0).toUpperCase() + esp.slice(1)} ya no visible.`;
  }
}

// src/voice/detection-voice-bridge.ts
import VoiceManager from './voice';

interface Prediction { class: string; score: number; bbox?: number[] }

export default class DetectionVoiceBridge {
  vm: VoiceManager;
  scoreThreshold: number;
  minFramesToConfirm: number;
  forgetMs: number;
  speakPriority: number;
  tracked: Map<string, any>;

  constructor(voiceManager: VoiceManager, {
    scoreThreshold = 0.5,
    minFramesToConfirm = 2,
    forgetMs = 2000,
    speakPriority = 0
  } = {}) {
    this.vm = voiceManager;
    this.scoreThreshold = scoreThreshold;
    this.minFramesToConfirm = minFramesToConfirm;
    this.forgetMs = forgetMs;
    this.speakPriority = speakPriority;
    this.tracked = new Map();
  }

  handlePredictions(predictions: Prediction[] = []) {
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

      if (recorded.consecutiveSeen === this.minFramesToConfirm) {
        const text = this._formatAppearance(label, p);
        const priority = (label === 'person') ? this.speakPriority + 1 : this.speakPriority;
        if ((now - recorded.lastSpokenTs) > 1500) {
          this.vm.speak(text, priority, { interrupt: false });
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

  _formatAppearance(label: string, prediction: Prediction) {
    return `${label} detectado`;
  }

  _formatDisappearance(label: string) {
    return `${label} ya no está`;
  }
}

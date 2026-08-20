// src/voice/voice.ts
// VoiceManager: síntesis + reconocimiento + cola priorizada + logging en IndexedDB
export default class VoiceManager {
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  dedupeWindowMs: number;

  queue: Array<any>;
  processing: boolean;
  lastUtterance: { text: string | null; ts: number };
  _idCounter: number;

  recognition: any;
  recognitionActive: boolean;
  commandHandlers: Array<(transcript: string, confidence: number) => void>;
  recognitionOptions: any;

  voicesReady: boolean;
  selectedVoice: SpeechSynthesisVoice | null;
  _dbPromise: Promise<IDBDatabase | null> | null;

  constructor({ lang = 'es-ES', rate = 1, pitch = 1, volume = 1, dedupeWindowMs = 3000 } = {}) {
    this.lang = lang;
    this.rate = rate;
    this.pitch = pitch;
    this.volume = volume;
    this.dedupeWindowMs = dedupeWindowMs;

    this.queue = [];
    this.processing = false;
    this.lastUtterance = { text: null, ts: 0 };
    this._idCounter = 1;

    this.recognition = null;
    this.recognitionActive = false;
    this.commandHandlers = [];
    this.recognitionOptions = { continuous: true, interimResults: false };

    this.voicesReady = false;
    this.selectedVoice = null;
    this._initVoices();

    this._dbPromise = this._openDB();
  }

  // -------------------- IndexedDB --------------------
  _openDB(): Promise<IDBDatabase | null> {
    return new Promise<IDBDatabase | null>((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      const req = indexedDB.open('sentra_voice', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('utterances')) {
          db.createObjectStore('utterances', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  async _logUtterance(text: string, meta: Record<string, unknown> = {}) {
    const db = await (this._dbPromise as Promise<IDBDatabase | null>);
    if (!db) return;
    try {
      const tx = db.transaction('utterances', 'readwrite');
      const store = tx.objectStore('utterances');
      store.add({ text, meta, ts: Date.now() });
    } catch (_) {
      // best-effort
    }
  }

  // -------------------- Voices --------------------
  _initVoices() {
    const setup = () => {
      const vs = speechSynthesis.getVoices();
      if (vs && vs.length) {
        this.voicesReady = true;
        this.selectedVoice = vs.find(v => v.lang && v.lang.startsWith(this.lang)) || vs[0] || null;
      }
    };
    setup();
    (window as any).speechSynthesis.onvoiceschanged = setup;
  }

  // -------------------- Queue management --------------------
  speak(text: string, priority = 0, opts: Record<string, any> = {}) {
    if (!text || typeof text !== 'string') return null;
    const now = Date.now();
    if (this.lastUtterance.text === text && (now - this.lastUtterance.ts) < this.dedupeWindowMs) {
      return null;
    }

    const id = this._idCounter++;
    this.queue.push({ id, text, priority, opts, addedAt: now });
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.addedAt - b.addedAt;
    });
    this._processQueue();
    return id;
  }

  cancel(id: number | null = null) {
    if (id == null) {
      this.queue = [];
      try { speechSynthesis.cancel(); } catch (_) {}
      this.processing = false;
    } else {
      this.queue = this.queue.filter(item => item.id !== id);
    }
  }

  async _processQueue() {
    if (this.processing) return;
    if (!this.queue.length) return;
    this.processing = true;
    while (this.queue.length) {
      const { id, text, opts } = this.queue.shift();
      this.lastUtterance = { text, ts: Date.now() };
      try {
        await this._speakOnce(text, opts);
        await this._logUtterance(text, { opts });
      } catch (e) {
        console.warn('speech error', e);
      }
      await new Promise(r => setTimeout(r, (opts.pauseAfterMs || 120)));
    }
    this.processing = false;
  }

  _speakOnce(text: string, opts: Record<string, any> = {}) {
    return new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis not available in this browser.');
        return resolve();
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || this.lang;
      u.rate = typeof opts.rate === 'number' ? opts.rate : this.rate;
      u.pitch = typeof opts.pitch === 'number' ? opts.pitch : this.pitch;
      u.volume = typeof opts.volume === 'number' ? opts.volume : this.volume;
      if (this.selectedVoice) u.voice = this.selectedVoice;

      u.onend = () => resolve();
      u.onerror = (ev) => {
        console.error('utterance error', ev);
        resolve();
      };

      if (opts.interrupt) {
        try { speechSynthesis.cancel(); } catch (_) {}
      }
      try { speechSynthesis.speak(u); } catch (e) { console.warn('speak failed', e); resolve(); }
    });
  }

  // -------------------- Recognition --------------------
  _makeRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = this.lang;
    rec.interimResults = !!this.recognitionOptions.interimResults;
    rec.continuous = !!this.recognitionOptions.continuous;
    rec.maxAlternatives = 1;
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          const transcript = ev.results[i][0].transcript.trim();
          const confidence = ev.results[i][0].confidence;
          this._handleTranscript(transcript, confidence);
        }
      }
    };
    rec.onerror = (e: any) => {
      console.warn('recognition error', e);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.stopRecognition();
      } else {
        setTimeout(() => {
          if (this.recognitionActive) try { rec.start(); } catch (_) {}
        }, 500);
      }
    };
    rec.onend = () => {
      if (this.recognitionActive) {
        try { rec.start(); } catch (_) {}
      }
    };
    return rec;
  }

  startRecognition() {
    if (!this.recognition) {
      this.recognition = this._makeRecognition();
      if (!this.recognition) {
        console.warn('SpeechRecognition not available.');
        return false;
      }
    }
    try {
      this.recognitionActive = true;
      this.recognition.start();
      return true;
    } catch (e) {
      console.warn('could not start recognition', e);
      return false;
    }
  }

  stopRecognition() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
    }
    this.recognitionActive = false;
  }

  onCommand(handler: (transcript: string, confidence: number) => void) {
    this.commandHandlers.push(handler);
  }

  _handleTranscript(transcript: string, confidence: number) {
    for (const h of this.commandHandlers) {
      try { h(transcript, confidence); } catch (e) { console.error(e); }
    }
  }

  // -------------------- Helpers --------------------
  setLanguage(lang: string) {
    this.lang = lang;
    if (this.recognition) this.recognition.lang = lang;
    this._initVoices();
  }

  setVoice(voiceName: string) {
    const vs = speechSynthesis.getVoices();
    const v = vs.find(x => x.name === voiceName);
    if (v) this.selectedVoice = v;
  }

  setRate(rate: number) { this.rate = rate; }
  setPitch(pitch: number) { this.pitch = pitch; }
  setVolume(volume: number) { this.volume = volume; }
}

import VoiceManager from './voice';

// Shared singleton VoiceManager instance
const vm = new VoiceManager({ lang: 'es-ES', rate: 1.15, volume: 1 });

export default vm;

import { useEffect, useState, useCallback } from 'react';
import vm from '../voice/manager';

const STORAGE_KEY = 'sentra_selected_voice';

export function useVoiceSettings() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const available = window.speechSynthesis.getVoices();
      if (!available.length) return;
      setVoices(available);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && available.some(v => v.voiceURI === saved)) {
        setSelectedVoiceURI(saved);
        const found = available.find(v => v.voiceURI === saved);
        if (found) vm.setVoice(found.name);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const selectVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    localStorage.setItem(STORAGE_KEY, voice.voiceURI);
    vm.setVoice(voice.name);
  }, []);

  const testVoice = useCallback((voice: SpeechSynthesisVoice) => {
    vm.speak('Hola. Esta es una prueba de la voz seleccionada.', 10, {
      interrupt: true,
      rate: 1.1,
    });
  }, []);

  return { voices, selectedVoiceURI, selectVoice, testVoice };
}

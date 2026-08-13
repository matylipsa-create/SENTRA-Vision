import { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

const NORMAL_METRIC_INTERVAL = 5_000;
const POWER_SAVING_METRIC_INTERVAL = 15_000;
const GPS_INTERVAL = 10_000;

export function useMetricsUpdater() {
  const { state, setConfidence, setCognitiveLoad } = useApp();
  const powerSavingRef = useRef(state.settings.powerSavingMode);
  powerSavingRef.current = state.settings.powerSavingMode;

  useEffect(() => {
    const metricInterval = powerSavingRef.current ? POWER_SAVING_METRIC_INTERVAL : NORMAL_METRIC_INTERVAL;

    const metricTick = () => {
      if (powerSavingRef.current) {
        setConfidence(Math.floor(Math.random() * 8 + 88));
        setCognitiveLoad(Math.floor(Math.random() * 15 + 20));
      } else {
        setConfidence(Math.floor(Math.random() * 15 + 80));
        setCognitiveLoad(Math.floor(Math.random() * 40 + 30));
      }
    };

    const metricTimer = setInterval(metricTick, metricInterval);

    const gpsTick = () => {
      console.log(`[AEGIS] GPS update @ ${new Date().toISOString()}`);
    };
    const gpsTimer = setInterval(gpsTick, GPS_INTERVAL);

    return () => {
      clearInterval(metricTimer);
      clearInterval(gpsTimer);
    };
  }, [setConfidence, setCognitiveLoad, state.settings.powerSavingMode]);
}

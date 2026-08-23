import { useEffect, useState, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import Landing from './components/Landing';
import OnboardingGuide from './components/OnboardingGuide';
import DemoModeBanner from './components/DemoModeBanner';
import Dashboard from './pages/Dashboard';
import Regulation from './pages/Regulation';
import Operations from './pages/Operations';
import Settings from './pages/Settings';
import AegisMetricsPanel from './components/AegisMetricsPanel';
import useRealModeSensors from './hooks/useRealModeSensors';
import { useDemoEventGenerator } from './hooks/useDemoEventGenerator';
import { useMetricsUpdater } from './hooks/useMetricsUpdater';

const ONBOARDING_KEY = 'aegis-onboarded';

function MainApp() {
  const { state, setMode, setDemoMode } = useApp();
  const [activePage, setActivePage] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [demoBannerVisible, setDemoBannerVisible] = useState(false);

  const { setVideo } = useRealModeSensors();
  useDemoEventGenerator();
  useMetricsUpdater();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      setDemoMode(true);
      setDemoBannerVisible(true);
    }
    if (params.get('debug') === 'true') {
      console.debug('[AEGIS] Debug mode active');
    }
  }, [setDemoMode]);

  const handleToggleMode = useCallback(() => {
    setMode(state.mode === 'normal' ? 'technical' : 'normal');
  }, [state.mode, setMode]);

  const isTechnical = state.mode === 'technical';
  const showBanner = demoBannerVisible && state.demoMode;
  const topPadding = 52 + (showBanner ? 36 : 0) + 16;

  return (
    <div className={state.settings.powerSavingMode ? 'power-saving-mode' : ''} style={{ minHeight: '100dvh' }}>
      <TopBar
        onToggleMode={handleToggleMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMetrics={() => setMetricsOpen(true)}
      />
      {showBanner && <DemoModeBanner onHide={() => setDemoBannerVisible(false)} />}
      <main
        style={{
          paddingTop: topPadding,
          paddingBottom: 80,
          paddingLeft: 16,
          paddingRight: 16,
          maxWidth: 480,
          margin: '0 auto',
          width: '100%',
          minHeight: '100dvh',
        }}
      >
        {activePage === 'dashboard' && (
          <Dashboard isTechnical={isTechnical} onArm={() => {}} setVideo={setVideo} />
        )}
        {activePage === 'regulation' && <Regulation />}
        {activePage === 'operations' && <Operations />}
      </main>
      <BottomNav
        active={activePage}
        onNavigate={setActivePage}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AegisMetricsPanel open={metricsOpen} onClose={() => setMetricsOpen(false)} />
    </div>
  );
}

export default function App() {
  const [enteredApp, setEnteredApp] = useState(false);
  const [onboarded, setOnboarded] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const handleEnterApp = useCallback(() => setEnteredApp(true), []);

  const handleOnboardingComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      /* noop */
    }
    setOnboarded(true);
  }, []);

  return (
    <AppProvider>
      <ToastProvider>
        {!enteredApp ? (
          <Landing onEnterApp={handleEnterApp} />
        ) : !onboarded ? (
          <OnboardingGuide onComplete={handleOnboardingComplete} />
        ) : (
          <MainApp />
        )}
      </ToastProvider>
    </AppProvider>
  );
}

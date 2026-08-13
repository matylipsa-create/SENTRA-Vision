import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useDemoEventGenerator } from './hooks/useDemoEventGenerator';
import { useMetricsUpdater } from './hooks/useMetricsUpdater';
import { useRealModeSensors } from './hooks/useRealModeSensors';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import DemoModeBanner from './components/DemoModeBanner';
import AegisMetricsPanel from './components/AegisMetricsPanel';
import OnboardingGuide from './components/OnboardingGuide';
import Landing from './components/Landing';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import type { PageKey } from './types';
import Regulation from './pages/Regulation';
import Operations from './pages/Operations';

const ONBOARDING_KEY = 'aegis-onboarded';

function AppShell() {
  const { state, setMode, setCurrentPage, setDemoMode } = useApp();
  useDemoEventGenerator();
  useMetricsUpdater();
  const { setVideo } = useRealModeSensors();

  const [showLanding, setShowLanding] = useState(true);
  const [page, setPage] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== 'true'; } catch { return true; }
  });

  const showBanner = state.demoMode && !bannerHidden;

  const handleToggleMode = () => setMode(state.mode === 'normal' ? 'technical' : 'normal');

  const handleArm = () => {
    console.log(`[AEGIS] ${state.status === 'ARMADO' ? 'Desarmando' : 'Armando'} sistema...`);
  };

  const handleOnboardingComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch { /* noop */ }
    setShowOnboarding(false);
  };

  const paddingTop = showBanner ? '88px' : '60px';
  const powerSaving = state.settings.powerSavingMode;

  const handleNavigate = (p: string) => {
    setPage(p);
    if (p === 'dashboard' || p === 'regulation' || p === 'operations') {
      setCurrentPage(p as PageKey);
    }
  };

  const handleEnterApp = () => {
    setShowLanding(false);
    setDemoMode(true);
  };

  if (showLanding) {
    return <Landing onEnterApp={handleEnterApp} />;
  }

  return (
    <div className={`h-screen flex flex-col ${powerSaving ? 'power-saving-mode' : ''}`} style={{ background: 'linear-gradient(180deg, #0A0C12 0%, #000000 100%)' }}>
      <TopBar
        onToggleMode={handleToggleMode}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMetrics={() => setShowMetrics(true)}
      />

      {showBanner && <DemoModeBanner onHide={() => setBannerHidden(true)} />}

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24"
        style={{ paddingTop, WebkitOverflowScrolling: 'touch' }}>
        {page === 'dashboard' && <Dashboard isTechnical={state.mode === 'technical'} onArm={handleArm} setVideo={setVideo} />}
        {page === 'regulation' && <Regulation />}
        {page === 'operations' && <Operations />}
      </main>

      <BottomNav
        active={page}
        onNavigate={handleNavigate}
        onOpenSettings={() => setShowSettings(true)}
      />

      <AegisMetricsPanel open={showMetrics} onClose={() => setShowMetrics(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
      {showOnboarding && <OnboardingGuide onComplete={handleOnboardingComplete} />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { useDemoEventGenerator } from './hooks/useDemoEventGenerator';
import { useMetricsUpdater } from './hooks/useMetricsUpdater';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import DemoModeBanner from './components/DemoModeBanner';
import AegisMetricsPanel from './components/AegisMetricsPanel';
import OnboardingGuide from './components/OnboardingGuide';
import Settings from './pages/Settings';
import AccessibleMinimalUI from './components/AccessibleMinimalUI';
import type { PageKey } from './types';

const ONBOARDING_KEY = 'aegis-onboarded';

function AppShell() {
  const { state, setMode, setCurrentPage, setDemoMode } = useApp();
  useDemoEventGenerator();
  useMetricsUpdater();

  const [page, setPage] = useState<PageKey>('dashboard');
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
    setPage(p as PageKey);
    if (p === 'dashboard' || p === 'regulation' || p === 'operations') {
      setCurrentPage(p as PageKey);
    }
  };

  return (
    <div className={`h-screen flex flex-col ${powerSaving ? 'power-saving-mode' : ''}`} style={{ background: 'linear-gradient(180deg, #0A0C12 0%, #000000 100%)' }}>
      <TopBar
        onToggleMode={handleToggleMode}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMetrics={() => setShowMetrics(true)}
      />

      {showBanner && <DemoModeBanner onHide={() => setBannerHidden(true)} />}

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24" style={{ paddingTop, WebkitOverflowScrolling: 'touch' }}>
        {/* Render minimal accessible UI as the app's main view */}
        <AccessibleMinimalUI />
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

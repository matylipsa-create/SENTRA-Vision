import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { store } from "./lib/store";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Nodes } from "./pages/Nodes";
import { Topology } from "./pages/Topology";
import { EventLog } from "./pages/EventLog";
import { Alerts } from "./pages/Alerts";


export default function App() {
  const [ready, setReady] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(0);

  useEffect(() => {
    let mounted = true;
    const unsub = store.subscribe(async () => {
      if (!mounted) return;
      const stats = await store.getNetworkStats();
      setPendingAlerts(stats.pendingAlerts);
    });

    (async () => {
      await store.init();
      if (!mounted) return;
      const stats = await store.getNetworkStats();
      setPendingAlerts(stats.pendingAlerts);
      setReady(true);
    })();

    return () => {
      mounted = false;
      unsub();
      store.stopSimulation();
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-ink-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-ink-700 border-t-accent-500 rounded-full animate-spin" />
          <p className="text-sm text-ink-400 font-mono">Inicializando Sentra Core…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar pendingAlerts={pendingAlerts} />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/topology" element={<Topology />} />
            <Route path="/events" element={<EventLog />} />
            <Route path="/alerts" element={<Alerts />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

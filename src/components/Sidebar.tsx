import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  Network,
  ScrollText,
  ShieldAlert,
  Cpu,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/nodes", label: "Nodos", icon: Radio },
  { to: "/topology", label: "Topología", icon: Network },
  { to: "/events", label: "Cadena de Eventos", icon: ScrollText },
  { to: "/alerts", label: "Alertas", icon: ShieldAlert },
];

export function Sidebar({ pendingAlerts }: { pendingAlerts: number }) {
  return (
    <aside className="w-64 shrink-0 bg-ink-900/95 backdrop-blur-md border-r border-ink-700/60 flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-ink-700/60">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-lg bg-ink-800 flex items-center justify-center border border-ink-600">
            <Cpu className="w-5 h-5 text-accent-400" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-400 rounded-full animate-pulse-slow ring-2 ring-ink-900" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-ink-50 tracking-tight">Sentra Core</h1>
            <p className="text-xs text-ink-400 font-mono">LoRa Mesh v1.0</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-accent-500/10 text-accent-300 border border-accent-500/20"
                    : "text-ink-300 hover:text-ink-100 hover:bg-ink-800/60 border border-transparent"
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.to === "/alerts" && pendingAlerts > 0 && (
                <span className="badge bg-danger-500/20 text-danger-400 border border-danger-500/30 px-1.5 py-0">
                  {pendingAlerts}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-ink-700/60">
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span className="status-dot bg-accent-400 animate-pulse-slow" />
          <span className="font-mono">Red soberana activa</span>
        </div>
        <p className="mt-2 text-xs text-ink-500 leading-relaxed">
          Operación offline-first. Sin dependencia de infraestructura externa.
        </p>
      </div>
    </aside>
  );
}

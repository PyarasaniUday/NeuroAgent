import React from 'react';
import { useNeuro } from '../../context/NeuroContext';
import {
  LayoutDashboard,
  Waves,
  CircleDot,
  Bot,
  RefreshCw,
  ShieldCheck,
  FileText,
  Download,
  History,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'channels', label: 'Channels', icon: Waves },
  { id: 'ica', label: 'ICA Analysis', icon: CircleDot },
  { id: 'ai', label: 'Artifact AI', icon: Bot },
  { id: 'reconstruction', label: 'Reconstruction', icon: RefreshCw },
  { id: 'quality', label: 'Quality Check', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'history', label: 'History', icon: History },
];

export const Sidebar: React.FC = () => {
  const { activeRoute, setActiveRoute } = useNeuro();

  return (
    <aside className="w-56 shrink-0 border-r border-cyan-500/20 bg-[#060b15]/90 backdrop-blur-xl flex flex-col justify-between py-4 select-none">
      <div className="space-y-1 px-3">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveRoute(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 shadow-glow-cyan-sm font-semibold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-transform duration-200 ${
                  isActive ? 'text-cyan-400 scale-110' : 'text-gray-400'
                }`}
              />
              <span className="tracking-wide">{item.label}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00d4ff]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom station status info */}
      <div className="px-4 py-3 mx-3 rounded-xl bg-cyan-950/20 border border-cyan-500/15 text-[11px] text-gray-400 space-y-1">
        <div className="flex justify-between items-center text-[10px] text-cyan-400/80 font-bold uppercase tracking-wider">
          <span>Engine Status</span>
          <span className="text-emerald-400">READY</span>
        </div>
        <div className="text-[10px] font-mono text-gray-400 truncate">
          1D-CNN • ICLabel • MNE
        </div>
      </div>
    </aside>
  );
};

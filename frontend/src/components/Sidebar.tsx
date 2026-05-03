import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Tv2,
  Settings,
  FileText,
  Film,
  ScrollText,
} from "lucide-react";

const links = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/channels", icon: Tv2, label: "Canais" },
  { to: "/clips", icon: Film, label: "Clips" },
  { to: "/prompt", icon: FileText, label: "Prompt" },
  { to: "/settings", icon: Settings, label: "Configurações" },
  { to: "/logs", icon: ScrollText, label: "Logs" },
];

export default function Sidebar() {
  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3 gap-1 shrink-0">
      <span className="text-red-500 font-bold text-lg px-3 mb-4 flex items-center gap-2">
        ▶ AutoYT
      </span>
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-red-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </aside>
  );
}

import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Tv2,
  Settings,
  FileText,
  Film,
  ScrollText,
  Languages
} from "lucide-react";

export default function Sidebar() {
  const { t, i18n } = useTranslation();

  const links = [
    { to: "/", icon: LayoutDashboard, label: t("sidebar.dashboard") },
    { to: "/channels", icon: Tv2, label: t("sidebar.channels") },
    { to: "/clips", icon: Film, label: t("sidebar.clips") },
    { to: "/prompt", icon: FileText, label: t("sidebar.prompt") },
    { to: "/settings", icon: Settings, label: t("sidebar.settings") },
    { to: "/logs", icon: ScrollText, label: t("sidebar.logs") },
  ];

  const toggleLanguage = () => {
    const next = i18n.language === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(next);
  };

  return (
    <aside className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-3 gap-1 shrink-0">
      <span className="text-red-500 font-bold text-lg px-3 mb-4 flex items-center gap-2">
        ▶ AutoYT
      </span>
      <div className="flex-1 space-y-1">
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
      </div>

      <button
        onClick={toggleLanguage}
        className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
      >
        <Languages size={16} />
        {i18n.language === 'pt' ? 'English (EN)' : 'Português (PT)'}
      </button>
    </aside>
  );
}

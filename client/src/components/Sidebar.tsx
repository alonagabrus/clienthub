type Page = "dashboard" | "customers" | "companies" | "packages" | "promotions";

interface SidebarProps {
  current: Page;
  onChange: (p: Page) => void;
}

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "dashboard",  label: "Dashboard",  icon: "▦" },
  { id: "customers",  label: "Customers",  icon: "👤" },
  { id: "companies",  label: "Companies",  icon: "🏢" },
  { id: "packages",   label: "Packages",   icon: "📦" },
  { id: "promotions", label: "Promotions", icon: "🏷" },
];

export function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-200 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            CRM
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">ClientHub</p>
            <p className="text-xs text-slate-400">Customer Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              current === item.id
                ? "bg-blue-600 text-white font-medium"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
        GCP · Cloud Run + Cloud SQL
      </div>
    </aside>
  );
}

export type { Page };

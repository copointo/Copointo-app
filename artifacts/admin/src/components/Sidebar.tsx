import { Link } from "wouter";
import { LayoutDashboard, Coffee, Users, AlertCircle, LogOut } from "lucide-react";
import logoUrl from "@/assets/copointo-logo.png";

const nav = [
  { href: "/",       icon: LayoutDashboard, label: "لوحة التحكم" },
  { href: "/cafes",  icon: Coffee,          label: "الكافيهات"   },
  { href: "/users",  icon: Users,           label: "المستخدمون"  },
  { href: "/reports",icon: AlertCircle,     label: "البلاغات"    },
];

export default function Sidebar({ active }: { active: string }) {
  return (
    <aside className="w-60 flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/40 shrink-0 overflow-hidden">
          <img src={logoUrl} alt="Copointo" className="w-full h-full object-contain" />
        </div>
        <div>
          <p className="font-bold text-foreground text-lg leading-tight">Copointo</p>
          <p className="text-xs text-muted-foreground">لوحة المدير</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, icon: Icon, label }) => {
          const isActive = active === href;
          return (
            <Link key={href} href={href}>
              <a className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium
                ${isActive
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
                <Icon size={18} />
                {label}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5">
        <button
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
          onClick={() => { sessionStorage.removeItem("adm"); window.location.reload(); }}
        >
          <LogOut size={18} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

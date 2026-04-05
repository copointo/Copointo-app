import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import DashboardPage     from "@/pages/DashboardPage";
import CafesPage         from "@/pages/CafesPage";
import UsersPage         from "@/pages/UsersPage";
import CafeDashboardPage from "@/pages/CafeDashboardPage";
import { LayoutDashboard, Coffee, Users, ArrowRight } from "lucide-react";

const queryClient = new QueryClient();

// ── Home Screen ───────────────────────────────────────────────
function HomePage() {
  const cards = [
    {
      href:    "/dashboard",
      icon:    LayoutDashboard,
      emoji:   "📊",
      label:   "لوحة التحكم",
      sub:     "الإيرادات والإحصائيات العامة",
      grad:    "from-amber-800 to-amber-600",
      border:  "border-amber-700/40",
    },
    {
      href:    "/cafes",
      icon:    Coffee,
      emoji:   "☕",
      label:   "الكوفيهات",
      sub:     "إدارة وإضافة الكوفيهات",
      grad:    "from-violet-900 to-violet-700",
      border:  "border-violet-700/40",
    },
    {
      href:    "/users",
      icon:    Users,
      emoji:   "👥",
      label:   "المستخدمون",
      sub:     "عرض وحظر المستخدمين",
      grad:    "from-slate-800 to-slate-600",
      border:  "border-slate-600/40",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6" dir="rtl">
      {/* Logo */}
      <div className="text-center mb-14">
        <div className="text-7xl mb-4">☕</div>
        <h1 className="text-4xl font-bold text-foreground">Copointo</h1>
        <p className="text-muted-foreground mt-2 text-lg">لوحة تحكم المدير</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-2xl">
        {cards.map(({ href, emoji, label, sub, grad, border }) => (
          <Link key={href} href={href}
            className={`group relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-gradient-to-br ${grad} border ${border} cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 shadow-xl`}>
            <span className="text-5xl">{emoji}</span>
            <div className="text-center">
              <p className="text-white font-bold text-lg">{label}</p>
              <p className="text-white/60 text-xs mt-1">{sub}</p>
            </div>
            <div className="absolute bottom-4 left-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
              <ArrowRight size={14} className="text-white" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Page Layout (with back button) ────────────────────────────
export function PageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir="rtl">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card shrink-0 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
          <ArrowRight size={18} />
          الرئيسية
        </Link>
        <div className="w-px h-5 bg-border" />
        <span className="text-xl">☕</span>
        <h1 className="font-bold text-foreground text-lg">{title}</h1>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

// ── Wrapped Pages ─────────────────────────────────────────────
function DashboardWrapped() {
  return <PageLayout title="لوحة التحكم"><DashboardPage /></PageLayout>;
}
function CafesWrapped() {
  return <PageLayout title="الكوفيهات"><CafesPage /></PageLayout>;
}
function UsersWrapped() {
  return <PageLayout title="المستخدمون"><UsersPage /></PageLayout>;
}

// ── Router ────────────────────────────────────────────────────
function AdminApp() {
  return (
    <Switch>
      <Route path="/"           component={HomePage}        />
      <Route path="/dashboard"  component={DashboardWrapped}/>
      <Route path="/cafes"      component={CafesWrapped}    />
      <Route path="/users"      component={UsersWrapped}    />
      <Route path="/cafe/:id"   component={CafeDashboardPage}/>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AdminApp />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

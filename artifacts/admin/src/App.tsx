import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Link } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import DashboardPage     from "@/pages/DashboardPage";
import CafesPage         from "@/pages/CafesPage";
import UsersPage         from "@/pages/UsersPage";
import CopointoHubPage   from "@/pages/CopointoHubPage";
import ReportsPage       from "@/pages/ReportsPage";
import CommunitiesPage   from "@/pages/CommunitiesPage";
import CafeDashboardPage, { ManagerAnalyticsPage } from "@/pages/CafeDashboardPage";
import { LayoutDashboard, Coffee, Users, Gamepad2, AlertCircle, ArrowRight, Users2 } from "lucide-react";
import logoUrl from "@/assets/copointo-logo.png";

const queryClient = new QueryClient();

// ── Home Screen ───────────────────────────────────────────────
function HomePage() {
  const cards = [
    {
      href:    "/dashboard",
      Icon:    LayoutDashboard,
      label:   "لوحة التحكم",
      sub:     "الإيرادات والإحصائيات العامة",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
    {
      href:    "/cafes",
      Icon:    Coffee,
      label:   "الكافيهات",
      sub:     "إدارة وإضافة الكافيهات",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
    {
      href:    "/users",
      Icon:    Users,
      label:   "المستخدمون",
      sub:     "عرض وحظر المستخدمين",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
    {
      href:    "/copointo-hub",
      Icon:    Gamepad2,
      iconImg: logoUrl,
      label:   "Copointo Hub",
      sub:     "إدارة لاعبي اللعبة وإيقافهم",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
    {
      href:    "/reports",
      Icon:    AlertCircle,
      label:   "البلاغات",
      sub:     "بلاغات المستخدمين والكوفي",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
    {
      href:    "/communities",
      Icon:    Users2,
      label:   "المجتمعات",
      sub:     "أعضاء وتصنيف وحظر المجتمعات",
      grad:    "from-[#0A0606] via-[#050303] to-black",
      border:  "border-[#E8B86D]/40",
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 sm:px-6 py-8" dir="rtl">
      {/* Logo */}
      <div className="text-center mb-8 sm:mb-12 lg:mb-14">
        <div className="mx-auto mb-4 sm:mb-5 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center bg-[#E8B86D]/12 border border-[#E8B86D]/40 shadow-lg shadow-[#E8B86D]/15 overflow-hidden">
          <img src={logoUrl} alt="Copointo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Copointo</h1>
        <p className="text-muted-foreground mt-1.5 sm:mt-2 text-base sm:text-lg">لوحة تحكم المدير</p>
      </div>

      {/* Cards: 1 col on phone, 2 on tablet, 3 on small laptop, 5 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 w-full max-w-5xl">
        {cards.map(({ href, Icon, iconImg, label, sub, grad, border }) => (
          <Link key={href} href={href}
            className={`group relative flex flex-col items-center justify-center gap-3 sm:gap-4 p-5 sm:p-6 lg:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${grad} border ${border} cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 shadow-xl shadow-[#E8B86D]/10`}>
            <div className={`w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 ${iconImg ? "rounded-full" : "rounded-2xl"} flex items-center justify-center bg-[#E8B86D]/12 border border-[#E8B86D]/40 group-hover:bg-[#E8B86D]/20 transition-colors overflow-hidden`}>
              {iconImg
                ? <img src={iconImg} alt="" className="w-[70%] h-[70%] object-contain" />
                : <Icon className="text-[#E8B86D] w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.75} />}
            </div>
            <div className="text-center">
              <p className="text-[#E8B86D] font-bold text-base sm:text-lg">{label}</p>
              <p className="text-[#F5E6CC]/60 text-[11px] sm:text-xs mt-1">{sub}</p>
            </div>
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#E8B86D]/10 flex items-center justify-center group-hover:bg-[#E8B86D]/20 transition-colors">
              <ArrowRight size={14} className="text-[#E8B86D]" />
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
      <header className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 border-b border-border bg-card shrink-0 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm font-medium shrink-0">
          <ArrowRight size={18} />
          <span className="hidden sm:inline">الرئيسية</span>
        </Link>
        <div className="w-px h-5 bg-border shrink-0" />
        <img src={logoUrl} alt="" className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0" />
        <h1 className="font-bold text-foreground text-sm sm:text-lg truncate">{title}</h1>
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
  return <PageLayout title="الكافيهات"><CafesPage /></PageLayout>;
}
function UsersWrapped() {
  return <PageLayout title="المستخدمون"><UsersPage /></PageLayout>;
}
function CopointoHubWrapped() {
  return <PageLayout title="Copointo Hub"><CopointoHubPage /></PageLayout>;
}
function ReportsWrapped() {
  return <PageLayout title="البلاغات"><ReportsPage /></PageLayout>;
}
function CommunitiesWrapped() {
  return <PageLayout title="المجتمعات"><CommunitiesPage /></PageLayout>;
}

// ── Router ────────────────────────────────────────────────────
function AdminApp() {
  return (
    <Switch>
      <Route path="/"           component={HomePage}        />
      <Route path="/dashboard"  component={DashboardWrapped}/>
      <Route path="/cafes"      component={CafesWrapped}    />
      <Route path="/users"      component={UsersWrapped}    />
      <Route path="/copointo-hub" component={CopointoHubWrapped} />
      <Route path="/reports"      component={ReportsWrapped}    />
      <Route path="/communities"  component={CommunitiesWrapped}/>
      <Route path="/cafe/:id/analytics"  component={ManagerAnalyticsPage}/>
      <Route path="/cafe/:id"            component={CafeDashboardPage}/>
    </Switch>
  );
}

// ── Splash Screen ─────────────────────────────────────────────
// Shown once per browser tab on first load: logo + "Copointo" fade in
// together, hold briefly, then fade out. The user sees it before the
// dashboard appears. We use sessionStorage so HMR / route changes don't
// re-trigger it during the same session — only a fresh tab/reload does.
function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const showTimer = setTimeout(() => setLeaving(true), 1600);
    const doneTimer = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(showTimer); clearTimeout(doneTimer); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${leaving ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-6 splash-rise">
        <div className="w-32 h-32 rounded-3xl flex items-center justify-center bg-[#E8B86D]/12 border border-[#E8B86D]/40 shadow-2xl shadow-[#E8B86D]/30 overflow-hidden">
          <img src={logoUrl} alt="Copointo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-5xl font-bold tracking-wide text-foreground">Copointo</h1>
        <div className="mt-2 w-10 h-10 rounded-full border-2 border-[#E8B86D]/30 border-t-[#E8B86D] animate-spin" />
      </div>
      <style>{`
        @keyframes splashRise {
          0%   { opacity: 0; transform: translateY(18px) scale(0.94); }
          60%  { opacity: 1; transform: translateY(0)     scale(1.02); }
          100% { opacity: 1; transform: translateY(0)     scale(1); }
        }
        .splash-rise { animation: splashRise 900ms cubic-bezier(.2,.7,.2,1) both; }
      `}</style>
    </div>
  );
}

export default function App() {
  // Only run the splash once per tab session — back/forward navigation
  // inside the SPA shouldn't replay it.
  const [showSplash, setShowSplash] = useState(() => {
    try { return !sessionStorage.getItem("copointo_splash_seen_v1"); }
    catch { return true; }
  });
  const finishSplash = () => {
    try { sessionStorage.setItem("copointo_splash_seen_v1", "1"); } catch { /* ignore */ }
    setShowSplash(false);
  };
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AdminApp />
      </WouterRouter>
      <Toaster />
      {showSplash && <SplashScreen onDone={finishSplash} />}
    </QueryClientProvider>
  );
}

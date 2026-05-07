import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, AlertTriangle, Coffee, MapPin, Phone, Trash2, User as UserIcon, CheckCircle2, RotateCcw, ExternalLink, Inbox } from "lucide-react";
import { api } from "@/lib/api";

interface Report {
  id: string;
  kind: "problem" | "cafe";
  name: string;
  phone: string;
  description: string;
  status: "open" | "resolved";
  createdAt: string;
  cafeId?: string;
  cafeName?: string;
  reporterUserId?: string;
  cafe?: {
    id: string; name: string; logo?: string; image?: string;
    ownerName?: string; ownerPhone?: string; address?: string; active?: boolean;
  } | null;
}

const POLL_MS = 5000;

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "problem" | "cafe" | "open">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const pulseRef = useRef<HTMLSpanElement | null>(null);

  const fetchReports = async () => {
    try {
      const r = await api.getReports();
      setReports(r.reports || []);
      if (pulseRef.current) {
        pulseRef.current.classList.remove("ping-pulse");
        // Force reflow so the animation can be re-triggered
        void pulseRef.current.offsetWidth;
        pulseRef.current.classList.add("ping-pulse");
      }
    } catch {
      /* ignore — keep last known list */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const t = setInterval(fetchReports, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const visible = reports.filter(r => {
    if (filter === "all") return true;
    if (filter === "open") return r.status === "open";
    return r.kind === filter;
  });
  const openCount = reports.filter(r => r.status === "open").length;

  const toggleStatus = async (r: Report) => {
    setBusyId(r.id);
    try {
      const next = r.status === "open" ? "resolved" : "open";
      await api.resolveReport(r.id, next);
      setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: next } : x));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Report) => {
    if (!window.confirm("هل تريد حذف هذا البلاغ نهائياً؟")) return;
    setBusyId(r.id);
    try {
      await api.deleteReport(r.id);
      setReports(prev => prev.filter(x => x.id !== r.id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <AlertCircle size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">البلاغات</h1>
            <p className="text-sm text-muted-foreground">
              {openCount > 0
                ? <>يوجد <span className="text-red-400 font-bold">{openCount}</span> بلاغ مفتوح</>
                : "لا توجد بلاغات مفتوحة"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span ref={pulseRef} className="relative inline-flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-green-400" />
          </span>
          تحديث تلقائي
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { id: "all" as const,     label: "الكل",          count: reports.length },
          { id: "open" as const,    label: "المفتوحة",      count: openCount },
          { id: "problem" as const, label: "بلاغ مشكلة",    count: reports.filter(r => r.kind === "problem").length },
          { id: "cafe" as const,    label: "بلاغ عن كوفي",  count: reports.filter(r => r.kind === "cafe").length },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors ${
              filter === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {f.label} <span className="opacity-60">({f.count})</span>
          </button>
        ))}
      </div>

      {/* Empty */}
      {loading ? (
        <div className="text-center text-muted-foreground py-16">جارٍ التحميل…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 bg-card border border-border rounded-2xl">
          <Inbox size={48} className="text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">لا توجد بلاغات في هذا التصنيف</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(r => (
            <div
              key={r.id}
              className={`bg-card border rounded-2xl p-5 transition-colors ${
                r.status === "open" ? "border-red-500/30" : "border-border opacity-70"
              }`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    r.kind === "cafe" ? "bg-amber-500/15 border border-amber-500/30" : "bg-blue-500/15 border border-blue-500/30"
                  }`}>
                    {r.kind === "cafe"
                      ? <Coffee size={18} className="text-amber-400" />
                      : <AlertTriangle size={18} className="text-blue-400" />}
                  </div>
                  <div>
                    <p className="font-bold text-foreground text-sm">
                      {r.kind === "cafe" ? "بلاغ عن كوفي" : "بلاغ مشكلة"}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                    r.status === "open"
                      ? "bg-red-500/15 text-red-300 border border-red-500/30"
                      : "bg-green-500/15 text-green-300 border border-green-500/30"
                  }`}>
                    {r.status === "open" ? "مفتوح" : "تم الحل"}
                  </span>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => toggleStatus(r)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-border text-muted-foreground hover:bg-muted/30 inline-flex items-center gap-1 disabled:opacity-50"
                    title={r.status === "open" ? "وضع علامة تم الحل" : "إعادة فتح"}
                  >
                    {r.status === "open" ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}
                    {r.status === "open" ? "تم الحل" : "إعادة فتح"}
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => remove(r)}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-border text-red-400 hover:bg-red-500/10 inline-flex items-center disabled:opacity-50"
                    title="حذف"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Reporter chips */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 bg-muted/40 border border-border px-3 py-1.5 rounded-full text-xs">
                  <UserIcon size={12} className="text-primary" />
                  <span className="text-foreground">{r.name}</span>
                </div>
                <a
                  href={`tel:${r.phone}`}
                  className="inline-flex items-center gap-1.5 bg-muted/40 hover:bg-muted/60 border border-border px-3 py-1.5 rounded-full text-xs transition-colors"
                >
                  <Phone size={12} className="text-primary" />
                  <span className="text-foreground font-mono" dir="ltr">{r.phone}</span>
                </a>
                {r.reporterUserId && (
                  <span className="inline-flex items-center bg-muted/30 border border-border px-2.5 py-1 rounded-full text-[10px] font-mono text-muted-foreground" dir="ltr">
                    {r.reporterUserId}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="bg-background/40 border border-border rounded-xl p-4 mb-3">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{r.description}</p>
              </div>

              {/* Cafe details (only for cafe reports) */}
              {r.kind === "cafe" && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-400 mb-3 flex items-center gap-1.5">
                    <Coffee size={13} /> الكوفي المُبلَّغ عنه
                  </p>
                  {r.cafe ? (
                    <div className="flex items-start gap-4 flex-wrap">
                      {r.cafe.logo ? (
                        <img src={r.cafe.logo} alt="" className="w-16 h-16 rounded-xl object-cover border border-border" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl">☕</div>
                      )}
                      <div className="flex-1 min-w-[200px]">
                        <p className="font-bold text-foreground">{r.cafe.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {r.cafe.address && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={11} className="text-amber-400" /> {r.cafe.address}
                            </span>
                          )}
                          {r.cafe.ownerName && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <UserIcon size={11} className="text-amber-400" /> {r.cafe.ownerName}
                            </span>
                          )}
                          {r.cafe.ownerPhone && (
                            <a href={`tel:${r.cafe.ownerPhone}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Phone size={11} className="text-amber-400" /> <span dir="ltr">{r.cafe.ownerPhone}</span>
                            </a>
                          )}
                        </div>
                        {r.cafe.active === false && (
                          <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-[10px] font-bold border border-red-500/30">
                            معطّل حالياً
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/cafe/${r.cafe.id}`}
                        className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-90"
                      >
                        <ExternalLink size={12} /> داشبورد الكوفي
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      الكوفي المرجعي لم يعد موجوداً (id: <span className="font-mono">{r.cafeId}</span>)
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pingPulse {
          0%   { box-shadow: 0 0 0 0 rgba(74,222,128,0.6); }
          80%  { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
          100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
        }
        .ping-pulse { animation: pingPulse 700ms ease-out; border-radius: 9999px; }
      `}</style>
    </div>
  );
}

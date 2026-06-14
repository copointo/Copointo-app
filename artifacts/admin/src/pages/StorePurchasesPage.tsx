import { useEffect, useMemo, useState } from "react";
import {
  ShoppingBag, Coffee, Wallet, Coins, Tag, TrendingUp, CheckCircle2,
  CalendarClock, Clock, Inbox, BadgePercent,
} from "lucide-react";
import { api } from "@/lib/api";

// ─── Types (mirror the super-admin store endpoints) ─────────────────────
interface Purchase {
  id: string;
  createdAt: string;
  userId: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  coinsBase: number;
  coinsBonus: number;
  coinsTotal: number;
  priceOmr: number;
  priceUsd: number | null;
  code: string | null;
  cafeId: string | null;
  cafeName: string | null;
  commission: number;
  profit: number;
  platform: string | null;
}
interface PurchasesResponse {
  purchases: Purchase[];
  count: number;
  totalRevenue: number;
  totalProfit: number;
  totalCommission: number;
}
interface CafePurchase {
  id: string;
  createdAt: string;
  buyerName: string | null;
  buyerPhone: string | null;
  code: string | null;
  coinsTotal: number;
  priceOmr: number;
  commission: number;
  platform: string | null;
}
interface CafeSummary {
  cafeId: string;
  cafeName: string;
  code: string | null;
  codeEnabled: boolean;
  enabledAt: string | null;
  settledAt: string | null;
  cycleStartAt: string;
  nextBillAt: string;
  daysLeft: number;
  overdue: boolean;
  accumulatedDue: number;
  dueCount: number;
  totalCommission: number;
  purchaseCount: number;
  purchases: CafePurchase[];
}
interface CafesResponse {
  cafes: CafeSummary[];
  totalDue: number;
  count: number;
}

const POLL_MS = 8000;
const GOLD = "#E8B86D";

// OMR has 3 decimals (baisa). Show a trimmed, RTL-friendly amount.
const fmtOmr = (n: number) =>
  `${(Math.round((n || 0) * 1000) / 1000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} ﷼`;
const fmtCoins = (n: number) => (n || 0).toLocaleString("en-US");

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ar", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function platformLabel(p: string | null): string {
  if (p === "web") return "الويب";
  if (p === "ios") return "آيفون";
  if (p === "android") return "أندرويد";
  return "—";
}

// ─── Small UI atoms ─────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: boolean;
}) {
  return (
    <div
      className="flex-1 min-w-[150px] rounded-2xl border p-4 bg-gradient-to-br from-[#0A0606] via-[#050303] to-black"
      style={{ borderColor: accent ? `${GOLD}66` : `${GOLD}33` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: GOLD }}>{icon}</span>
        <span className="text-[11px] text-[#F5E6CC]/60">{label}</span>
      </div>
      <p className="text-lg font-bold" style={{ color: accent ? GOLD : "#F5E6CC" }}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-[#F5E6CC]/50">
      <Inbox size={40} className="mb-3" style={{ color: `${GOLD}66` }} />
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ─── Tab 1: Copointo store (all purchases) ──────────────────────────────
function CopointoTab() {
  const [data, setData] = useState<PurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await api.copointoPurchases();
        if (alive) setData(r);
      } catch { /* keep last */ } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (loading && !data) return <p className="text-center text-[#F5E6CC]/50 py-16 text-sm">جارٍ التحميل…</p>;
  const rows = data?.purchases ?? [];

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <StatCard icon={<ShoppingBag size={16} />} label="عدد المشتريات" value={fmtCoins(data?.count ?? 0)} />
        <StatCard icon={<Wallet size={16} />} label="إجمالي المبيعات" value={fmtOmr(data?.totalRevenue ?? 0)} />
        <StatCard icon={<TrendingUp size={16} />} label="إجمالي الأرباح" value={fmtOmr(data?.totalProfit ?? 0)} accent />
        <StatCard icon={<BadgePercent size={16} />} label="عمولات الكافيهات" value={fmtOmr(data?.totalCommission ?? 0)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState text="لا توجد مشتريات بعد." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: `${GOLD}33` }}>
          <table className="w-full text-sm text-right border-collapse min-w-[760px]">
            <thead>
              <tr className="text-[#F5E6CC]/60 text-[11px]" style={{ borderBottom: `1px solid ${GOLD}33` }}>
                <th className="p-3 font-medium">المستخدم</th>
                <th className="p-3 font-medium">الهاتف</th>
                <th className="p-3 font-medium">العملات</th>
                <th className="p-3 font-medium">السعر</th>
                <th className="p-3 font-medium">الكود</th>
                <th className="p-3 font-medium">الأرباح</th>
                <th className="p-3 font-medium">المنصّة</th>
                <th className="p-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="text-[#F5E6CC]/90" style={{ borderBottom: `1px solid ${GOLD}1a` }}>
                  <td className="p-3 font-medium">{r.buyerName || "—"}</td>
                  <td className="p-3 text-[#F5E6CC]/60" dir="ltr">{r.buyerPhone || "—"}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1" style={{ color: GOLD }}>
                      <Coins size={13} /> {fmtCoins(r.coinsTotal)}
                    </span>
                    {r.coinsBonus > 0 && (
                      <span className="text-[10px] text-[#F5E6CC]/40 mr-1">(+{fmtCoins(r.coinsBonus)})</span>
                    )}
                  </td>
                  <td className="p-3">{fmtOmr(r.priceOmr)}</td>
                  <td className="p-3">
                    {r.code ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
                        style={{ color: GOLD, background: `${GOLD}1a`, border: `1px solid ${GOLD}40` }}>
                        <Tag size={11} /> {r.code}
                      </span>
                    ) : <span className="text-[#F5E6CC]/40 text-[11px]">بدون كود</span>}
                  </td>
                  <td className="p-3 font-bold" style={{ color: GOLD }}>{fmtOmr(r.profit)}</td>
                  <td className="p-3 text-[#F5E6CC]/60 text-[12px]">{platformLabel(r.platform)}</td>
                  <td className="p-3 text-[#F5E6CC]/50 text-[12px] whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Cafe data hook (shared by tabs 2 & 3) ──────────────────────────────
function useCafes() {
  const [data, setData] = useState<CafesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    try {
      const r = await api.copointoCafes();
      setData(r);
    } catch { /* keep last */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let alive = true;
    const load = async () => { if (alive) await reload(); };
    load();
    const t = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return { data, loading, reload };
}

// ─── Tab 2: cafe purchases (per code-enabled cafe) ──────────────────────
function CafePurchasesTab() {
  const { data, loading } = useCafes();
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading && !data) return <p className="text-center text-[#F5E6CC]/50 py-16 text-sm">جارٍ التحميل…</p>;
  const cafes = data?.cafes ?? [];
  if (cafes.length === 0) return <EmptyState text="لا يوجد كافيهات مفعّلة للكود بعد." />;

  return (
    <div className="space-y-3">
      {cafes.map((c) => {
        const open = openId === c.cafeId;
        return (
          <div key={c.cafeId} className="rounded-2xl border overflow-hidden bg-gradient-to-br from-[#0A0606] via-[#050303] to-black"
            style={{ borderColor: `${GOLD}33` }}>
            <button
              onClick={() => setOpenId(open ? null : c.cafeId)}
              className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-[#E8B86D]/5 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${GOLD}1a`, border: `1px solid ${GOLD}40` }}>
                  <Coffee size={18} style={{ color: GOLD }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#F5E6CC] truncate">{c.cafeName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.code && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: GOLD }}>
                        <Tag size={11} /> {c.code}
                      </span>
                    )}
                    <span className="text-[11px] text-[#F5E6CC]/50">{c.purchaseCount} عملية</span>
                    {!c.codeEnabled && <span className="text-[10px] text-[#F5E6CC]/40">(الكود متوقف)</span>}
                  </div>
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-[10px] text-[#F5E6CC]/50">المتراكم حالياً</p>
                <p className="font-bold" style={{ color: GOLD }}>{fmtOmr(c.accumulatedDue)}</p>
              </div>
            </button>

            {open && (
              <div className="px-4 pb-4">
                {c.purchases.length === 0 ? (
                  <p className="text-[#F5E6CC]/40 text-xs py-4 text-center">لا توجد مشتريات بهذا الكود.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border" style={{ borderColor: `${GOLD}26` }}>
                    <table className="w-full text-sm text-right border-collapse min-w-[560px]">
                      <thead>
                        <tr className="text-[#F5E6CC]/60 text-[11px]" style={{ borderBottom: `1px solid ${GOLD}26` }}>
                          <th className="p-2.5 font-medium">المشتري</th>
                          <th className="p-2.5 font-medium">الكود</th>
                          <th className="p-2.5 font-medium">السعر</th>
                          <th className="p-2.5 font-medium">عمولة 10%</th>
                          <th className="p-2.5 font-medium">التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.purchases.map((p) => (
                          <tr key={p.id} className="text-[#F5E6CC]/90" style={{ borderBottom: `1px solid ${GOLD}14` }}>
                            <td className="p-2.5">{p.buyerName || "—"}</td>
                            <td className="p-2.5" style={{ color: GOLD }}>{p.code || "—"}</td>
                            <td className="p-2.5">{fmtOmr(p.priceOmr)}</td>
                            <td className="p-2.5 font-bold" style={{ color: GOLD }}>{fmtOmr(p.commission)}</td>
                            <td className="p-2.5 text-[#F5E6CC]/50 text-[12px] whitespace-nowrap">{fmtDateTime(p.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: cafe dues (monthly settlement) ──────────────────────────────
function CafeDuesTab() {
  const { data, loading, reload } = useCafes();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const settle = async (cafeId: string) => {
    setBusyId(cafeId);
    try {
      await api.settleCopointoCafe(cafeId);
      await reload();
    } catch { /* ignore — list reload will reflect latest */ } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  if (loading && !data) return <p className="text-center text-[#F5E6CC]/50 py-16 text-sm">جارٍ التحميل…</p>;
  const cafes = data?.cafes ?? [];
  if (cafes.length === 0) return <EmptyState text="لا يوجد كافيهات مفعّلة للكود بعد." />;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <StatCard icon={<Wallet size={16} />} label="إجمالي المستحقات" value={fmtOmr(data?.totalDue ?? 0)} accent />
        <StatCard icon={<Coffee size={16} />} label="عدد الكافيهات" value={fmtCoins(cafes.length)} />
      </div>

      <div className="space-y-3">
        {cafes.map((c) => (
          <div key={c.cafeId} className="rounded-2xl border p-4 bg-gradient-to-br from-[#0A0606] via-[#050303] to-black"
            style={{ borderColor: c.accumulatedDue > 0 ? `${GOLD}55` : `${GOLD}26` }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${GOLD}1a`, border: `1px solid ${GOLD}40` }}>
                  <Coffee size={18} style={{ color: GOLD }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#F5E6CC] truncate">{c.cafeName}</p>
                  {c.code && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold mt-0.5" style={{ color: GOLD }}>
                      <Tag size={11} /> {c.code}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-[10px] text-[#F5E6CC]/50">المستحق (تراكم 10%)</p>
                <p className="text-xl font-bold" style={{ color: GOLD }}>{fmtOmr(c.accumulatedDue)}</p>
              </div>
            </div>

            {/* cycle facts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl p-2.5" style={{ background: "#0000004d", border: `1px solid ${GOLD}1a` }}>
                <div className="flex items-center gap-1.5 text-[10px] text-[#F5E6CC]/50 mb-1">
                  <CalendarClock size={12} /> بدء تفعيل الكود
                </div>
                <p className="text-[13px] text-[#F5E6CC]/90">{fmtDate(c.enabledAt)}</p>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: "#0000004d", border: `1px solid ${GOLD}1a` }}>
                <div className="flex items-center gap-1.5 text-[10px] text-[#F5E6CC]/50 mb-1">
                  <Clock size={12} /> باقٍ لإكمال الشهر
                </div>
                <p className="text-[13px] font-bold" style={{ color: c.overdue ? "#F0A07A" : "#F5E6CC" }}>
                  {c.overdue ? "حان موعد التحويل" : `${c.daysLeft} يوم`}
                </p>
              </div>
              <div className="rounded-xl p-2.5" style={{ background: "#0000004d", border: `1px solid ${GOLD}1a` }}>
                <div className="flex items-center gap-1.5 text-[10px] text-[#F5E6CC]/50 mb-1">
                  <CheckCircle2 size={12} /> آخر دفعة
                </div>
                <p className="text-[13px] text-[#F5E6CC]/90">{fmtDate(c.settledAt)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
              <p className="text-[11px] text-[#F5E6CC]/50">
                {c.dueCount} عملية هذه الدورة · إجمالي العمولات: {fmtOmr(c.totalCommission)}
              </p>
              {confirmId === c.cafeId ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#F5E6CC]/70">تأكيد التحويل؟</span>
                  <button
                    disabled={busyId === c.cafeId}
                    onClick={() => settle(c.cafeId)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-black disabled:opacity-60"
                    style={{ background: GOLD }}
                  >
                    {busyId === c.cafeId ? "جارٍ…" : "نعم، تم"}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#F5E6CC]/70"
                    style={{ border: `1px solid ${GOLD}33` }}
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(c.cafeId)}
                  disabled={c.accumulatedDue <= 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: GOLD, background: `${GOLD}1a`, border: `1px solid ${GOLD}55` }}
                >
                  <CheckCircle2 size={14} /> تم الدفع
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page shell with sub-tabs ───────────────────────────────────────────
type TabKey = "copointo" | "cafes" | "dues";
export default function StorePurchasesPage() {
  const [tab, setTab] = useState<TabKey>("copointo");
  const tabs = useMemo(() => ([
    { key: "copointo" as const, label: "مشتريات المتجر Copointo", Icon: ShoppingBag },
    { key: "cafes" as const, label: "مشتريات الكافيهات", Icon: Coffee },
    { key: "dues" as const, label: "مستحقات الكافيهات", Icon: Wallet },
  ]), []);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5" dir="rtl">
      {/* sub-tab switcher */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
              style={active
                ? { color: "#000", background: GOLD }
                : { color: GOLD, background: `${GOLD}12`, border: `1px solid ${GOLD}33` }}
            >
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </div>

      {tab === "copointo" && <CopointoTab />}
      {tab === "cafes" && <CafePurchasesTab />}
      {tab === "dues" && <CafeDuesTab />}
    </div>
  );
}

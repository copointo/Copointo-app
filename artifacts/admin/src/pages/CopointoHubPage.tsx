import { useEffect, useMemo, useState } from "react";
import { Search, Ban, Clock, ShieldOff, ShieldCheck, X, AlertTriangle, Users as UsersIcon, CheckCircle as CheckIcon, Hourglass, Megaphone, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface HubUser {
  id: string;
  username: string;
  phone: string;
  level: number;
  totalOrders: number;
  banned: boolean;
  joinedAt: string;
  gameBanned?: boolean;
  gameSuspendedUntil?: string | null;
  gameSuspendReason?: string | null;
  gameSuspendedAt?: string | null;
}

type FilterTab = "all" | "active" | "suspended" | "banned";

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("ar-OM", { dateStyle: "short", timeStyle: "short" }) : "—";

function gameStatus(u: HubUser): "banned" | "suspended" | "active" {
  if (u.gameBanned) return "banned";
  if (u.gameSuspendedUntil && new Date(u.gameSuspendedUntil).getTime() > Date.now()) return "suspended";
  return "active";
}

function daysLeft(until?: string | null): number {
  if (!until) return 0;
  const ms = new Date(until).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86400000) : 0;
}

export default function CopointoHubPage() {
  const [users,   setUsers]   = useState<HubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");
  const [tab,     setTab]     = useState<FilterTab>("all");

  // Modal state
  const [modal, setModal] = useState<{ user: HubUser; mode: "ban" | "suspend" } | null>(null);
  const [reason, setReason] = useState("");
  const [days,   setDays]   = useState("3");
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState("");

  // Broadcast (system notification to all game users) modal state
  const [broadcastOpen,   setBroadcastOpen]   = useState(false);
  const [broadcastMsg,    setBroadcastMsg]    = useState("");
  const [broadcastBusy,   setBroadcastBusy]   = useState(false);
  const [broadcastErr,    setBroadcastErr]    = useState("");
  const [broadcastOk,     setBroadcastOk]     = useState(false);
  const [broadcasts,      setBroadcasts]      = useState<{ id: string; message: string; createdAt: string }[]>([]);

  const loadBroadcasts = () =>
    api.getBroadcasts().then(d => setBroadcasts(d.broadcasts ?? [])).catch(() => {});

  const openBroadcast = () => {
    setBroadcastMsg("");
    setBroadcastErr("");
    setBroadcastOk(false);
    setBroadcastOpen(true);
    loadBroadcasts();
  };

  const sendBroadcast = async () => {
    const m = broadcastMsg.trim();
    if (!m) { setBroadcastErr("الرجاء كتابة نص الإشعار"); return; }
    setBroadcastBusy(true); setBroadcastErr("");
    try {
      await api.sendBroadcast(m);
      setBroadcastOk(true);
      setBroadcastMsg("");
      await loadBroadcasts();
      setTimeout(() => setBroadcastOk(false), 2500);
    } catch (e: any) {
      try { setBroadcastErr(JSON.parse(e?.message ?? "{}").error || "تعذّر الإرسال"); }
      catch { setBroadcastErr(e?.message || "تعذّر الإرسال"); }
    } finally {
      setBroadcastBusy(false);
    }
  };

  const removeBroadcast = async (id: string) => {
    if (!confirm("حذف هذا الإشعار من السجل؟ (لن يُحذف من إشعارات المستخدمين)")) return;
    await api.deleteBroadcast(id);
    await loadBroadcasts();
  };

  const reload = () => api.getUsers().then(d => setUsers(d.users));

  useEffect(() => { reload().finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    return users
      .filter(u => {
        const s = gameStatus(u);
        if (tab === "active"    && s !== "active")    return false;
        if (tab === "suspended" && s !== "suspended") return false;
        if (tab === "banned"    && s !== "banned")    return false;
        return true;
      })
      .filter(u =>
        u.username.toLowerCase().includes(query.toLowerCase()) ||
        u.phone.includes(query),
      )
      .sort((a, b) => b.totalOrders - a.totalOrders);
  }, [users, query, tab]);

  const counts = useMemo(() => ({
    all:       users.length,
    active:    users.filter(u => gameStatus(u) === "active").length,
    suspended: users.filter(u => gameStatus(u) === "suspended").length,
    banned:    users.filter(u => gameStatus(u) === "banned").length,
  }), [users]);

  const openModal = (user: HubUser, mode: "ban" | "suspend") => {
    setModal({ user, mode });
    setReason("");
    setDays("3");
    setErr("");
  };

  const closeModal = () => { if (!busy) setModal(null); };

  const submitModal = async () => {
    if (!modal) return;
    const r = reason.trim();
    if (!r) { setErr("الرجاء كتابة سبب الإجراء"); return; }
    if (modal.mode === "suspend") {
      const d = Number(days);
      if (!Number.isFinite(d) || d <= 0) { setErr("عدد الأيام غير صحيح"); return; }
    }
    setBusy(true); setErr("");
    try {
      if (modal.mode === "ban") {
        await api.gameBan(modal.user.id, r);
      } else {
        await api.gameSuspend(modal.user.id, Number(days), r);
      }
      await reload();
      setModal(null);
    } catch (e: any) {
      setErr(e?.message || "حدث خطأ");
    } finally {
      setBusy(false);
    }
  };

  const liftRestriction = async (u: HubUser) => {
    if (!confirm(`رفع جميع قيود اللعبة عن "${u.username}"؟`)) return;
    await api.gameClear(u.id);
    await reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎮</span>
            <h1 className="text-3xl font-bold text-foreground">Copointo Hub</h1>
          </div>
          <p className="text-muted-foreground">
            إدارة لاعبي اللعبة • {counts.all} لاعب • {counts.suspended} موقوف مؤقتاً • {counts.banned} محظور
          </p>
        </div>
        <button
          onClick={openBroadcast}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 shadow"
        >
          <Megaphone size={18} /> إشعار للمستخدمين
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {([
          { key: "all",       label: "إجمالي اللاعبين",  Icon: UsersIcon, value: counts.all       },
          { key: "active",    label: "نشطون في اللعبة",  Icon: CheckIcon, value: counts.active    },
          { key: "suspended", label: "موقوفون مؤقتاً",   Icon: Hourglass, value: counts.suspended },
          { key: "banned",    label: "محظورون نهائياً",   Icon: Ban,       value: counts.banned    },
        ] as const).map(c => {
          const active = tab === c.key;
          const Icon = c.Icon;
          return (
            <button
              key={c.key}
              onClick={() => setTab(c.key as FilterTab)}
              className={`text-right p-5 rounded-2xl border transition-all
                ${active
                  ? "bg-primary/15 border-primary/50 shadow"
                  : "bg-card border-border hover:border-primary/30"}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/15 border border-primary/30">
                  <Icon size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">{c.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-0.5">{c.value}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم اللاعب أو الهاتف..."
          className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">اللاعب</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الهاتف</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">المستوى</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">النقاط (طلبات)</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الانضمام</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">حالة اللعبة</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(user => {
                const status = gameStatus(user);
                return (
                  <tr key={user.id} className={`transition-colors ${
                    status === "banned"    ? "bg-destructive/5" :
                    status === "suspended" ? "bg-yellow-500/5" :
                    "hover:bg-muted/20"
                  }`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {user.username[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground font-mono">{user.phone}</td>
                    <td className="px-5 py-4">
                      <span className="bg-primary/15 text-primary rounded-lg px-2.5 py-1 text-xs font-bold">
                        {user.level}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-foreground font-semibold">{user.totalOrders}</td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">{fmtDate(user.joinedAt)}</td>
                    <td className="px-5 py-4">
                      {status === "banned" && (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> محظور نهائياً
                          </span>
                          {user.gameSuspendReason && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[220px]" title={user.gameSuspendReason}>
                              {user.gameSuspendReason}
                            </span>
                          )}
                        </div>
                      )}
                      {status === "suspended" && (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 w-fit">
                            <Clock size={11} /> موقوف · {daysLeft(user.gameSuspendedUntil)} يوم
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            حتى {fmtDateTime(user.gameSuspendedUntil)}
                          </span>
                          {user.gameSuspendReason && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[220px]" title={user.gameSuspendReason}>
                              {user.gameSuspendReason}
                            </span>
                          )}
                        </div>
                      )}
                      {status === "active" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/15 text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> نشط
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {status === "active" ? (
                          <>
                            <button
                              onClick={() => openModal(user, "suspend")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25"
                            >
                              <Clock size={14} /> إيقاف مؤقت
                            </button>
                            <button
                              onClick={() => openModal(user, "ban")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25"
                            >
                              <Ban size={14} /> حظر نهائي
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => liftRestriction(user)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 text-green-400 hover:bg-green-500/25"
                          >
                            <ShieldCheck size={14} /> رفع القيد
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-5xl mb-3">🎮</div>
              <p>لا يوجد لاعبون في هذا التصنيف</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                  modal.mode === "ban" ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"
                }`}>
                  {modal.mode === "ban" ? <ShieldOff size={22} /> : <Clock size={22} />}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    {modal.mode === "ban" ? "حظر من اللعبة نهائياً" : "إيقاف مؤقت من اللعبة"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{modal.user.username} · {modal.user.phone}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground p-1">
                <X size={18} />
              </button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 text-xs text-muted-foreground flex gap-2">
              <AlertTriangle size={14} className="text-primary shrink-0 mt-0.5" />
              <p>
                سيتم إخفاء اللاعب من تصنيفات اللعبة وإغلاق شاشة اللعبة معه. باقي الخدمات ستبقى تعمل، وستستمر نقاطه بالتراكم في الكوفي للحصول على مشروب مجاني.
              </p>
            </div>

            {modal.mode === "suspend" && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-foreground mb-1.5">مدة الإيقاف (بالأيام)</label>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[1, 3, 7, 14, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setDays(String(d))}
                      className="text-xs px-3 py-1 rounded-lg bg-muted/40 text-muted-foreground hover:bg-primary/15 hover:text-primary"
                    >
                      {d} أيام
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                سبب الإجراء <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="اكتب سبب الإيقاف (سيظهر للاعب)..."
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
              />
            </div>

            {err && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3 mb-3">{err}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={closeModal}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted/40 text-foreground hover:bg-muted/60 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={submitModal}
                disabled={busy}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 ${
                  modal.mode === "ban"
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-yellow-500 text-black hover:bg-yellow-600"
                }`}
              >
                {busy ? "جارٍ الحفظ..." : (modal.mode === "ban" ? "تأكيد الحظر" : "تأكيد الإيقاف")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast modal — send a system notification to all game users */}
      {broadcastOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { if (!broadcastBusy) setBroadcastOpen(false); }}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Megaphone size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">إشعار للمستخدمين</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    سيظهر لجميع لاعبي Copointo في شاشة الإشعارات كرسالة من Copointo
                  </p>
                </div>
              </div>
              <button
                onClick={() => { if (!broadcastBusy) setBroadcastOpen(false); }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                نص الإشعار <span className="text-red-400">*</span>
              </label>
              <textarea
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value.slice(0, 500))}
                rows={5}
                placeholder="مثال: عرض خاص اليوم! اطلب أي قهوة واحصل على نقاط مضاعفة 🎉"
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                <span>سيُرسل من: <b className="text-primary">Copointo</b></span>
                <span>{broadcastMsg.length}/500</span>
              </div>
            </div>

            {broadcastErr && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3 mb-3">{broadcastErr}</p>
            )}
            {broadcastOk && (
              <p className="text-green-400 text-xs bg-green-500/10 border border-green-500/30 rounded-lg py-2 px-3 mb-3">
                ✓ تم إرسال الإشعار لجميع المستخدمين
              </p>
            )}

            <div className="flex gap-2 mb-5">
              <button
                onClick={() => { if (!broadcastBusy) setBroadcastOpen(false); }}
                disabled={broadcastBusy}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted/40 text-foreground hover:bg-muted/60 disabled:opacity-50"
              >
                إغلاق
              </button>
              <button
                onClick={sendBroadcast}
                disabled={broadcastBusy || !broadcastMsg.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Send size={15} /> {broadcastBusy ? "جارٍ الإرسال..." : "إرسال للجميع"}
              </button>
            </div>

            {/* History */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                الإشعارات السابقة ({broadcasts.length})
              </p>
              {broadcasts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">لا توجد إشعارات سابقة</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {broadcasts.map(b => (
                    <div key={b.id} className="bg-muted/20 border border-border rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground whitespace-pre-wrap flex-1">{b.message}</p>
                        <button
                          onClick={() => removeBroadcast(b.id)}
                          className="text-muted-foreground hover:text-red-400 p-1 shrink-0"
                          title="حذف من السجل"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{fmtDateTime(b.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

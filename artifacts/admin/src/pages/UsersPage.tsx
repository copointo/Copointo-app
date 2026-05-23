import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle, Search, MessageSquare, X, Send, AlertTriangle, Trash2, SlidersHorizontal, Coffee, Trophy } from "lucide-react";
import { api } from "@/lib/api";

interface AppUser {
  id: string; username: string; phone: string;
  level: number; totalOrders: number; banned: boolean; joinedAt: string;
  banReason?: string | null;
  bannedAt?: string | null;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  // ─── Live polling ──────────────────────────────────────────────────────
  // Re-fetch the user list every 2 s so accounts created or logged-in from
  // the mobile app appear in the super-admin almost instantly without
  // requiring a page refresh. We also re-fetch immediately whenever the tab
  // becomes visible again so a manager who switches back to this tab always
  // sees the latest roster without waiting for the next poll tick.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getUsers()
        .then(d => { if (!cancelled) setUsers(d.users); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const t = setInterval(load, 2000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", load);
    };
  }, []);

  // ─── Ban modal state ───────────────────────────────────────────────────
  // Banning now REQUIRES a written reason which is shown to the user inside
  // the mobile app (full-screen ban gate). Unbanning still works as a
  // single-click action and clears the stored reason.
  const [banTarget,  setBanTarget]  = useState<AppUser | null>(null);
  const [banReason,  setBanReason]  = useState("");
  const [banSaving,  setBanSaving]  = useState(false);
  const [banErr,     setBanErr]     = useState("");
  const banInputRef = useRef<HTMLTextAreaElement>(null);

  const openBan = (u: AppUser) => {
    setBanTarget(u); setBanReason(""); setBanErr("");
    setTimeout(() => banInputRef.current?.focus(), 50);
  };
  const closeBan = () => { if (banSaving) return; setBanTarget(null); setBanReason(""); setBanErr(""); };
  const submitBan = async () => {
    if (!banTarget) return;
    const reason = banReason.trim();
    if (!reason) { setBanErr("اكتب سبب الحظر"); return; }
    setBanSaving(true); setBanErr("");
    try {
      const res = await api.banUser(banTarget.id, reason);
      setUsers(prev => prev.map(u => u.id === banTarget.id ? { ...u, ...res.user } : u));
      setBanTarget(null); setBanReason("");
    } catch (e: any) {
      setBanErr(e?.message?.substring(0, 200) || "تعذّر الحظر");
    } finally { setBanSaving(false); }
  };

  const unban = async (id: string) => {
    const res = await api.unbanUser(id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...res.user } : u));
  };

  // ─── Delete-user modal state ───────────────────────────────────────────
  // Permanently removes the user and frees up their gameUsername so any
  // other player can claim it. Requires typing the username for confirmation
  // to avoid accidental deletion.
  const [delTarget,   setDelTarget]   = useState<AppUser | null>(null);
  const [delConfirm,  setDelConfirm]  = useState("");
  const [delSaving,   setDelSaving]   = useState(false);
  const [delErr,      setDelErr]      = useState("");

  const openDelete = (u: AppUser) => {
    setDelTarget(u); setDelConfirm(""); setDelErr("");
  };
  const closeDelete = () => { if (delSaving) return; setDelTarget(null); setDelConfirm(""); setDelErr(""); };
  const submitDelete = async () => {
    if (!delTarget) return;
    if (delConfirm.trim() !== delTarget.username) {
      setDelErr("اكتب اسم المستخدم بالضبط للتأكيد");
      return;
    }
    setDelSaving(true); setDelErr("");
    try {
      await api.deleteUser(delTarget.id);
      setUsers(prev => prev.filter(u => u.id !== delTarget.id));
      setDelTarget(null); setDelConfirm("");
    } catch (e: any) {
      setDelErr(e?.message?.substring(0, 200) || "تعذّر الحذف");
    } finally { setDelSaving(false); }
  };

  // ─── Send-message modal state ──────────────────────────────────────────
  const [msgTarget,  setMsgTarget]  = useState<AppUser | null>(null);
  const [msgText,    setMsgText]    = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent,    setMsgSent]    = useState(false);
  const [msgErr,     setMsgErr]     = useState("");
  const msgInputRef = useRef<HTMLTextAreaElement>(null);

  const openMessage = (u: AppUser) => {
    setMsgTarget(u); setMsgText(""); setMsgSent(false); setMsgErr("");
    setTimeout(() => msgInputRef.current?.focus(), 50);
  };
  const closeMessage = () => {
    if (msgSending) return;
    setMsgTarget(null); setMsgText(""); setMsgSent(false); setMsgErr("");
  };
  const sendMessage = async () => {
    const text = msgText.trim();
    if (!text || !msgTarget) return;
    setMsgSending(true); setMsgErr("");
    try {
      await api.sendUserMessage(msgTarget.id, text);
      setMsgSent(true); setMsgText("");
      setTimeout(() => closeMessage(), 1200);
    } catch (e: any) {
      setMsgErr(e?.message?.substring(0, 200) || "تعذّر إرسال الرسالة");
    } finally {
      setMsgSending(false);
    }
  };

  // ─── Adjust progress modal (level & coffees, independent) ──────────────
  const [adjTarget,    setAdjTarget]    = useState<AppUser | null>(null);
  const [lvlDelta,     setLvlDelta]     = useState("");
  const [ordDelta,     setOrdDelta]     = useState("");
  const [lvlSaving,    setLvlSaving]    = useState(false);
  const [ordSaving,    setOrdSaving]    = useState(false);
  const [adjErr,       setAdjErr]       = useState("");

  const openAdjust = (u: AppUser) => {
    setAdjTarget(u); setLvlDelta(""); setOrdDelta(""); setAdjErr("");
  };
  const closeAdjust = () => {
    if (lvlSaving || ordSaving) return;
    setAdjTarget(null); setLvlDelta(""); setOrdDelta(""); setAdjErr("");
  };
  const applyLevelDelta = async () => {
    if (!adjTarget) return;
    const d = Math.trunc(Number(lvlDelta));
    if (!Number.isFinite(d) || d === 0) { setAdjErr("أدخل رقمًا للمستوى (موجب أو سالب)"); return; }
    setLvlSaving(true); setAdjErr("");
    try {
      const res = await api.adjustProgress(adjTarget.id, { levelDelta: d });
      setUsers(prev => prev.map(u => u.id === adjTarget.id ? { ...u, ...res.user } : u));
      setAdjTarget(t => t ? { ...t, ...res.user } : t);
      setLvlDelta("");
    } catch (e: any) {
      setAdjErr(e?.message?.substring(0, 200) || "تعذّر التعديل");
    } finally { setLvlSaving(false); }
  };
  const applyOrdersDelta = async () => {
    if (!adjTarget) return;
    const d = Math.trunc(Number(ordDelta));
    if (!Number.isFinite(d) || d === 0) { setAdjErr("أدخل رقمًا لعدد الكوفي (موجب أو سالب)"); return; }
    setOrdSaving(true); setAdjErr("");
    try {
      const res = await api.adjustProgress(adjTarget.id, { ordersDelta: d });
      setUsers(prev => prev.map(u => u.id === adjTarget.id ? { ...u, ...res.user } : u));
      setAdjTarget(t => t ? { ...t, ...res.user } : t);
      setOrdDelta("");
    } catch (e: any) {
      setAdjErr(e?.message?.substring(0, 200) || "تعذّر التعديل");
    } finally { setOrdSaving(false); }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(query.toLowerCase()) ||
    u.phone.includes(query)
  );

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" });

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">المستخدمون</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          {users.length} مستخدم مسجل • {users.filter(u => u.banned).length} محظور
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> تحديث تلقائي
          </span>
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم المستخدم أو الهاتف..."
          className="w-full bg-card border border-border rounded-xl pr-10 pl-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">المستخدم</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">رقم الهاتف</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">المستوى</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الطلبات</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">تاريخ الانضمام</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الحالة</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(user => (
                <tr key={user.id} className={`transition-colors ${user.banned ? "bg-destructive/5" : "hover:bg-muted/20"}`}>
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
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${user.banned ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.banned ? "bg-red-400" : "bg-green-400"}`} />
                        {user.banned ? "محظور" : "نشط"}
                      </span>
                      {user.banned && user.banReason && (
                        <span className="text-[10px] text-red-300/80 max-w-[200px] truncate" title={user.banReason}>
                          {user.banReason}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openMessage(user)}
                        title="إرسال رسالة"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                      >
                        <MessageSquare size={14} /> رسالة
                      </button>
                      <button
                        onClick={() => openAdjust(user)}
                        title="تعديل المستوى أو عدد الكوفي يدوياً"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors"
                      >
                        <SlidersHorizontal size={14} /> تعديل
                      </button>
                      <button
                        onClick={() => user.banned ? unban(user.id) : openBan(user)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          user.banned
                            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {user.banned ? <><CheckCircle size={14} /> رفع الحظر</> : <><Ban size={14} /> حظر</>}
                      </button>
                      <button
                        onClick={() => openDelete(user)}
                        title="حذف المستخدم نهائياً"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/25 transition-colors"
                      >
                        <Trash2 size={14} /> حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-5xl mb-3">👥</div>
              <p>لا توجد نتائج</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Ban modal (require reason) ── */}
      {banTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeBan} />
          <div className="relative bg-card border border-red-500/40 rounded-2xl w-full max-w-md shadow-2xl z-10 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-l from-red-900/30 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="font-bold text-foreground">حظر {banTarget.username}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{banTarget.phone}</p>
                </div>
              </div>
              <button onClick={closeBan} className="text-muted-foreground hover:text-foreground" disabled={banSaving}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-2">
                سبب الحظر <span className="text-red-400">*</span> سيظهر للمستخدم داخل التطبيق ويمنعه من استخدام الموقع أو إعادة التسجيل بنفس الرقم/اليوزر.
              </p>
              <textarea
                ref={banInputRef}
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="مثال: مخالفة شروط الاستخدام، إساءة، طلبات وهمية..."
                rows={4}
                maxLength={500}
                disabled={banSaving}
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-muted-foreground resize-none"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{banReason.length} / 500</span>
                {banErr && <span className="text-red-400">{banErr}</span>}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={closeBan}
                  disabled={banSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted/30 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={submitBan}
                  disabled={banSaving || !banReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Ban size={14} /> {banSaving ? "جاري الحظر..." : "تأكيد الحظر"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete-user modal (require username confirmation) ── */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDelete} />
          <div className="relative bg-card border border-red-500/40 rounded-2xl w-full max-w-md shadow-2xl z-10 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-l from-red-900/30 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                  <Trash2 size={20} />
                </div>
                <div>
                  <p className="font-bold text-foreground">حذف {delTarget.username}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{delTarget.phone}</p>
                </div>
              </div>
              <button onClick={closeDelete} className="text-muted-foreground hover:text-foreground" disabled={delSaving}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                سيتم حذف هذا المستخدم نهائياً، ويصبح يوزر اللعبة <span className="text-primary font-semibold">@{delTarget.username}</span> متاحاً لأي مستخدم آخر للتسجيل به.
                <br />
                للتأكيد، اكتب اسم المستخدم بالضبط:
              </p>
              <input
                value={delConfirm}
                onChange={e => setDelConfirm(e.target.value)}
                placeholder={delTarget.username}
                disabled={delSaving}
                dir="ltr"
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-muted-foreground"
              />
              {delErr && <div className="mt-1.5 text-xs text-red-400">{delErr}</div>}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={closeDelete}
                  disabled={delSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted/30 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={submitDelete}
                  disabled={delSaving || delConfirm.trim() !== delTarget.username}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={14} /> {delSaving ? "جاري الحذف..." : "حذف نهائي"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust progress modal (level & coffees, INDEPENDENT controls) ── */}
      {adjTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAdjust} />
          <div className="relative bg-card border border-amber-500/40 rounded-2xl w-full max-w-md shadow-2xl z-10 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-l from-amber-900/30 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <p className="font-bold text-foreground">تعديل تقدّم {adjTarget.username}</p>
                  <p className="text-xs text-muted-foreground">
                    المستوى الحالي: <span className="text-amber-400 font-semibold">{adjTarget.level}</span>
                    {" · "}
                    عدد الكوفي: <span className="text-primary font-semibold">{adjTarget.totalOrders}</span>
                  </p>
                </div>
              </div>
              <button onClick={closeAdjust} className="text-muted-foreground hover:text-foreground" disabled={lvlSaving || ordSaving}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 border border-border rounded-lg px-3 py-2">
                ⚠️ كل خانة منفصلة تمامًا: تعديل المستوى لا يغيّر عدد الكوفي، وتعديل عدد الكوفي لا يغيّر المستوى.
                استخدم رقمًا سالبًا للتقليل (مثلاً <span className="font-mono">-3</span>) أو موجبًا للزيادة (<span className="font-mono">+5</span>).
              </p>

              {/* ── Level section ── */}
              <div className="border border-amber-500/30 rounded-xl p-4 bg-amber-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={16} className="text-amber-400" />
                  <p className="font-bold text-foreground text-sm">المستوى فقط</p>
                  <span className="text-[10px] text-muted-foreground">(لن يتغير عدد الكوفي)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={lvlDelta}
                    onChange={e => setLvlDelta(e.target.value)}
                    placeholder="مثلاً 5 أو -2"
                    disabled={lvlSaving || ordSaving}
                    className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <button
                    onClick={applyLevelDelta}
                    disabled={lvlSaving || ordSaving || !lvlDelta.trim()}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {lvlSaving ? "..." : "تطبيق المستوى"}
                  </button>
                </div>
              </div>

              {/* ── Coffees (totalOrders) section ── */}
              <div className="border border-primary/30 rounded-xl p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Coffee size={16} className="text-primary" />
                  <p className="font-bold text-foreground text-sm">عدد الكوفي فقط</p>
                  <span className="text-[10px] text-muted-foreground">(لن يتغير المستوى)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={ordDelta}
                    onChange={e => setOrdDelta(e.target.value)}
                    placeholder="مثلاً 7 أو -1"
                    disabled={lvlSaving || ordSaving}
                    className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-60"
                  />
                  <button
                    onClick={applyOrdersDelta}
                    disabled={lvlSaving || ordSaving || !ordDelta.trim()}
                    className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {ordSaving ? "..." : "تطبيق الكوفي"}
                  </button>
                </div>
              </div>

              {adjErr && (
                <div className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
                  {adjErr}
                </div>
              )}

              <button
                onClick={closeAdjust}
                disabled={lvlSaving || ordSaving}
                className="w-full px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted/30 transition-colors disabled:opacity-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send-message modal ── */}
      {msgTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeMessage} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl z-10 overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-l from-amber-900/20 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {msgTarget.username[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-foreground">{msgTarget.username}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{msgTarget.phone}</p>
                </div>
              </div>
              <button onClick={closeMessage} className="text-muted-foreground hover:text-foreground" disabled={msgSending}>
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-2">
                ستظهر الرسالة في تبويب "Messages" في تطبيق المستخدم باسم <span className="text-primary font-semibold">كوبوينتو</span>.
              </p>
              <textarea
                ref={msgInputRef}
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                rows={5}
                maxLength={1000}
                disabled={msgSending || msgSent}
                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
              />
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{msgText.length} / 1000</span>
                {msgErr && <span className="text-red-400">{msgErr}</span>}
                {msgSent && <span className="text-green-400 flex items-center gap-1"><CheckCircle size={12} /> تم الإرسال</span>}
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={closeMessage}
                  disabled={msgSending}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-sm font-semibold hover:bg-muted/30 transition-colors disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  onClick={sendMessage}
                  disabled={msgSending || msgSent || !msgText.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={14} /> {msgSending ? "جاري الإرسال..." : "إرسال"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

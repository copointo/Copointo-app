import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle, Search, MessageSquare, X, Send } from "lucide-react";
import { api } from "@/lib/api";

interface AppUser {
  id: string; username: string; phone: string;
  level: number; totalOrders: number; banned: boolean; joinedAt: string;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  // ─── Live polling ──────────────────────────────────────────────────────
  // Re-fetch the user list every 5 s so accounts created from the mobile
  // app appear in the super-admin without requiring a page refresh.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api.getUsers()
        .then(d => { if (!cancelled) setUsers(d.users); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const toggleBan = async (id: string) => {
    await api.toggleBan(id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: !u.banned } : u));
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

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(query.toLowerCase()) ||
    u.phone.includes(query)
  );

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" });

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="p-8" dir="rtl">
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
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${user.banned ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.banned ? "bg-red-400" : "bg-green-400"}`} />
                      {user.banned ? "محظور" : "نشط"}
                    </span>
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
                        onClick={() => toggleBan(user.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          user.banned
                            ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                            : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                        }`}
                      >
                        {user.banned ? <><CheckCircle size={14} /> رفع الحظر</> : <><Ban size={14} /> حظر</>}
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

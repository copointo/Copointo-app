import { useEffect, useMemo, useState } from "react";
import { Search, Users as UsersIcon, Ban, X, AlertTriangle, Crown, Shield, Star, User as UserIcon, Trophy } from "lucide-react";
import { api } from "@/lib/api";

interface CommunityMember {
  id: string;
  name: string;
  username: string;
  phone: string;
  avatar: string | null;
  gender: "male" | "female" | null;
  level: number;
  totalOrders: number;
  rankName: string;
  rankIcon: string;
  roleKey: "leader" | "vice" | "senior" | "member";
  roleLabel: string;
  banned: boolean;
}

interface CommunityRow {
  id: string;
  name: string;
  avatar: string | null;
  createdBy: string;
  createdAt: number;
  memberCount: number;
  totalLevel: number;
  totalOrders: number;
  members: CommunityMember[];
}

const fmtDate = (ms?: number) =>
  ms ? new Date(ms).toLocaleDateString("ar-OM", { year: "numeric", month: "short", day: "numeric" }) : "—";

function roleColor(role: CommunityMember["roleKey"]): string {
  switch (role) {
    case "leader": return "#FFD700";
    case "vice":   return "#E8B86D";
    case "senior": return "#9CA3AF";
    default:       return "#6B7280";
  }
}

function RoleIcon({ role, size = 14 }: { role: CommunityMember["roleKey"]; size?: number }) {
  const color = roleColor(role);
  if (role === "leader") return <Crown size={size} color={color} />;
  if (role === "vice")   return <Shield size={size} color={color} />;
  if (role === "senior") return <Star size={size} color={color} />;
  return <UserIcon size={size} color={color} />;
}

export default function CommunitiesPage() {
  const [rows, setRows] = useState<CommunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  // Ban modal
  const [banTarget, setBanTarget] = useState<CommunityRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getCommunities();
      setRows(r.communities ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return rows;
    return rows.filter(r =>
      r.name.includes(q) ||
      r.members.some(m => m.name.includes(q) || m.username.includes(q) || m.phone.includes(q))
    );
  }, [rows, query]);

  const submitBan = async () => {
    if (!banTarget) return;
    const r = reason.trim();
    if (!r) { setErr("الرجاء كتابة سبب الحظر"); return; }
    setBusy(true); setErr("");
    try {
      await api.banCommunity(banTarget.id, r);
      setBanTarget(null);
      setReason("");
      await load();
    } catch (e: any) {
      try { setErr(JSON.parse(e?.message ?? "{}").error || "تعذّر الحظر"); }
      catch { setErr(e?.message || "تعذّر الحظر"); }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#E8B86D]/15 border border-[#E8B86D]/40 flex items-center justify-center">
          <UsersIcon className="text-[#E8B86D]" size={22} />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">المجتمعات</h2>
          <p className="text-xs text-muted-foreground">عرض جميع المجتمعات وأفرادها وتصنيفهم • حظر مع إرسال السبب لكل الأعضاء</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث باسم المجتمع أو عضو..."
          className="w-full pr-10 pl-4 py-2.5 bg-card border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-[#E8B86D]/60"
        />
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">لا توجد مجتمعات</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((c, i) => {
            const open = openId === c.id;
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Row header */}
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-[#E8B86D]/5 text-right transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#E8B86D]/15 border border-[#E8B86D]/40 flex items-center justify-center text-[#E8B86D] font-bold text-sm shrink-0">
                    #{i + 1}
                  </div>
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1a0f08] border border-[#E8B86D]/30 flex items-center justify-center shrink-0">
                    {c.avatar
                      ? (c.avatar.startsWith("http") || c.avatar.startsWith("data:"))
                        ? <img src={c.avatar} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl">{c.avatar}</span>
                      : <UsersIcon size={20} className="text-[#E8B86D]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {c.memberCount} عضو • أنشئ {fmtDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-0.5 px-2">
                    <span className="text-[10px] text-muted-foreground">المستوى الكلي</span>
                    <span className="font-bold text-[#E8B86D] flex items-center gap-1 text-sm">
                      <Trophy size={13} /> {c.totalLevel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setBanTarget(c); setReason(""); setErr(""); }}
                    className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/25 flex items-center gap-1.5"
                  >
                    <Ban size={13} /> حظر
                  </button>
                </button>

                {/* Members */}
                {open && (
                  <div className="border-t border-border bg-black/30 p-3 sm:p-4 space-y-2">
                    {c.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2.5 bg-card/50 rounded-lg border border-border/60">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a0f08] border border-[#E8B86D]/20 shrink-0 flex items-center justify-center">
                          {m.avatar
                            ? <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                            : <UserIcon size={18} className="text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm truncate">{m.name}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border" style={{ color: roleColor(m.roleKey), borderColor: `${roleColor(m.roleKey)}55`, backgroundColor: `${roleColor(m.roleKey)}15` }}>
                              <RoleIcon role={m.roleKey} size={10} /> {m.roleLabel}
                            </span>
                            {m.banned && <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/40 px-1.5 py-0.5 rounded">محظور</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            @{m.username || "—"} • {m.phone || "—"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{m.rankIcon} {m.rankName}</span>
                          <span className="text-xs font-bold text-[#E8B86D]">المستوى {m.level} • {m.totalOrders} طلب</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ban Modal */}
      {banTarget && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => { if (!busy) setBanTarget(null); }}
        >
          <div
            className="bg-card border border-red-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/40 flex items-center justify-center">
                  <AlertTriangle className="text-red-400" size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">حظر مجتمع</h3>
                  <p className="text-xs text-muted-foreground">{banTarget.name} • {banTarget.memberCount} عضو</p>
                </div>
              </div>
              <button
                onClick={() => { if (!busy) setBanTarget(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-[#F5E6CC]/70 bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3 mb-3">
              سيتم حذف المجتمع نهائياً مع جميع الدعوات، وسيتم إرسال السبب كإشعار لكل أفراد المجتمع.
            </p>

            <label className="block text-xs font-bold text-foreground mb-1.5">سبب الحظر</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="اكتب سبب الحظر بوضوح..."
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-red-500/60 resize-none"
              disabled={busy}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>500 حرف كحد أقصى</span>
              <span>{reason.length}/500</span>
            </div>

            {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3 mt-3">{err}</p>}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { if (!busy) setBanTarget(null); }}
                disabled={busy}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm font-bold hover:bg-card/60 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                onClick={submitBan}
                disabled={busy || !reason.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Ban size={15} /> {busy ? "جارٍ الحظر..." : "حظر وحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

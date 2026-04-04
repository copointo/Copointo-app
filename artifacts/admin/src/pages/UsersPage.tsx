import { useEffect, useState } from "react";
import { Ban, CheckCircle, Search } from "lucide-react";
import { api } from "@/lib/api";

interface AppUser {
  id: string; username: string; phone: string;
  level: number; totalOrders: number; banned: boolean; joinedAt: string;
}

export default function UsersPage() {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  useEffect(() => { api.getUsers().then(d => setUsers(d.users)).finally(() => setLoading(false)); }, []);

  const toggleBan = async (id: string) => {
    await api.toggleBan(id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, banned: !u.banned } : u));
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
        <p className="text-muted-foreground mt-1">{users.length} مستخدم مسجل • {users.filter(u => u.banned).length} محظور</p>
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
    </div>
  );
}

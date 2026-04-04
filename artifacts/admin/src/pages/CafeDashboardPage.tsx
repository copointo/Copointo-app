import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, LayoutDashboard, ShoppingBag, CalendarDays, UtensilsCrossed,
  MessageCircle, Table2, Receipt, Plus, Trash2, CheckCircle, Clock, ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { Link } from "wouter";

type Tab = "stats" | "orders" | "bookings" | "menu" | "chat" | "tables" | "invoices";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id:"stats",    label:"الإحصائيات",   icon: LayoutDashboard },
  { id:"orders",   label:"طلبات القهوة", icon: ShoppingBag },
  { id:"bookings", label:"حجوزات الطاولة",icon: CalendarDays },
  { id:"menu",     label:"القائمة",      icon: UtensilsCrossed },
  { id:"chat",     label:"معلومات الشات",icon: MessageCircle },
  { id:"tables",   label:"الطاولات",     icon: Table2 },
  { id:"invoices", label:"الفواتير",     icon: Receipt },
];

const COLORS = ["#C67C4E","#6C3FC5","#1A6B4A","#2563EB","#DC2626","#D97706"];
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-500/15 text-yellow-400",
  preparing: "bg-blue-500/15 text-blue-400",
  ready:     "bg-green-500/15 text-green-400",
  done:      "bg-slate-500/15 text-slate-400",
  confirmed: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
};
const STATUS_AR: Record<string, string> = {
  pending:"بانتظار", preparing:"قيد التحضير", ready:"جاهز",
  done:"تم", confirmed:"مؤكد", cancelled:"ملغي",
};

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-2xl ${className}`}>{children}</div>;
}
function StatBox({ label, value, icon, color }: { label:string; value:any; icon:string; color:string }) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${color}`}>{icon}</div>
      <div><p className="text-muted-foreground text-sm">{label}</p><p className="text-2xl font-bold text-foreground mt-0.5">{value}</p></div>
    </Card>
  );
}
function Inp({ value, onChange, placeholder, type = "text", className = "" }: any) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground ${className}`} />
  );
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
    </div>
  );
}

// ── Stats Tab ─────────────────────────────────────────────────
function StatsTab({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.cafeStats(id).then(setData); }, [id]);
  if (!data) return <Loader />;
  const topItems = Object.entries(data.topItems || {}).map(([name, qty]) => ({ name, qty }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <StatBox label="إجمالي الطلبات"   value={data.totalOrders}   icon="📦" color="bg-amber-700/60" />
        <StatBox label="الحجوزات"          value={data.totalBookings} icon="🪑" color="bg-violet-700/60" />
        <StatBox label="عناصر القائمة"    value={data.totalMenuItems} icon="🍽️" color="bg-blue-700/60" />
        <StatBox label="إجمالي الإيرادات" value={`${data.totalRevenue} OMR`} icon="💰" color="bg-green-700/60" />
        <StatBox label="طلبات بانتظار"    value={data.pendingOrders}  icon="⏳" color="bg-yellow-700/60" />
        <StatBox label="حجوزات مؤكدة"    value={data.confirmedBookings} icon="✅" color="bg-teal-700/60" />
      </div>

      {data.chartData?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">📈 الإيرادات اليومية</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.chartData}>
              <XAxis dataKey="date" tick={{ fill:"#888", fontSize:11 }} />
              <YAxis tick={{ fill:"#888", fontSize:11 }} />
              <Tooltip contentStyle={{ background:"#1a1f2e", border:"1px solid #2a3044", borderRadius:8 }} labelStyle={{ color:"#ccc" }} />
              <Bar dataKey="revenue" fill="#C67C4E" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {topItems.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">🏆 أكثر العناصر طلباً</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={topItems} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
                {topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background:"#1a1f2e", border:"1px solid #2a3044", borderRadius:8 }} />
              <Legend wrapperStyle={{ fontSize:12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────
function OrdersTab({ id }: { id: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(() => api.cafeOrders(id).then(d => setOrders(d.orders)), [id]);
  useEffect(() => { load(); }, [load]);
  const statuses = ["pending","preparing","ready","done"];
  const changeStatus = async (oid: string, status: string) => {
    await api.cafeOrderStatus(id, oid, status);
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status } : o));
  };
  return (
    <div className="space-y-4">
      {orders.length === 0 && <Empty icon="📦" text="لا توجد طلبات قهوة بعد" />}
      {orders.map(o => (
        <Card key={o.id} className="p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-semibold text-foreground">{o.customerName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{o.customerPhone} • {o.type === "dine" ? `طاولة ${o.tableNumber}` : `سيارة: ${o.plateNumber}`}</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[o.status]}`}>{STATUS_AR[o.status]}</span>
          </div>
          <div className="space-y-1 mb-3">
            {o.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.name} ×{item.qty}</span>
                <span className="text-foreground font-medium">{(item.price * item.qty).toFixed(3)} OMR</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-bold text-primary">{o.total?.toFixed(3)} OMR</span>
            <div className="flex gap-2">
              {statuses.filter(s => s !== o.status).map(s => (
                <button key={s} onClick={() => changeStatus(o.id, s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/30 transition-colors">
                  {STATUS_AR[s]}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Bookings Tab ──────────────────────────────────────────────
function BookingsTab({ id }: { id: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const load = useCallback(() => api.cafeBookings(id).then(d => setBookings(d.bookings)), [id]);
  useEffect(() => { load(); }, [load]);
  const change = async (bid: string, status: string) => {
    await api.cafeBookingStatus(id, bid, status);
    setBookings(prev => prev.map(b => b.id === bid ? { ...b, status } : b));
  };
  return (
    <div className="space-y-4">
      {bookings.length === 0 && <Empty icon="🪑" text="لا توجد حجوزات بعد" />}
      {bookings.map(b => (
        <Card key={b.id} className="p-5">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <p className="font-semibold text-foreground">{b.customerName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{b.customerPhone}</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[b.status]}`}>{STATUS_AR[b.status]}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm mb-3">
            <div><p className="text-muted-foreground text-xs">الطاولة</p><p className="text-foreground font-medium">{b.tableNumber}</p></div>
            <div><p className="text-muted-foreground text-xs">التاريخ</p><p className="text-foreground font-medium">{b.date}</p></div>
            <div><p className="text-muted-foreground text-xs">الوقت</p><p className="text-foreground font-medium">{b.time}</p></div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-border">
            {b.status === "pending" && <>
              <button onClick={() => change(b.id,"confirmed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25"><CheckCircle size={13}/>تأكيد</button>
              <button onClick={() => change(b.id,"cancelled")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">إلغاء</button>
            </>}
            {b.status === "confirmed" && <button onClick={() => change(b.id,"cancelled")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">إلغاء الحجز</button>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Menu Tab ──────────────────────────────────────────────────
function MenuTab({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm]   = useState({ name:"", price:"", category:"قهوة", description:"" });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api.cafeMenu(id).then(d => setItems(d.items)), [id]);
  useEffect(() => { load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    setSaving(true);
    await api.addMenuItem(id, { ...form, price: +form.price });
    await load(); setForm({ name:"", price:"", category:"قهوة", description:"" }); setSaving(false);
  };
  const del = async (mid: string) => {
    await api.deleteMenuItem(id, mid); setItems(prev => prev.filter(m => m.id !== mid));
  };
  const toggleAvail = async (item: any) => {
    await api.updateMenuItem(id, item.id, { available: !item.available });
    setItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m));
  };
  const cats = [...new Set(items.map(i => i.category))];
  return (
    <div className="space-y-5">
      {/* Add form */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">➕ إضافة عنصر جديد للقائمة</h3>
        <form onSubmit={add} className="grid grid-cols-2 gap-3">
          <Inp value={form.name} onChange={(v:string) => setForm(p=>({...p,name:v}))} placeholder="اسم المنتج *" />
          <Inp value={form.price} onChange={(v:string) => setForm(p=>({...p,price:v}))} placeholder="السعر (OMR) *" type="number" />
          <Sel value={form.category} onChange={(v:string) => setForm(p=>({...p,category:v}))} options={[{value:"قهوة",label:"☕ قهوة"},{value:"حلى",label:"🍰 حلى"},{value:"مشروبات",label:"🥤 مشروبات"},{value:"أكل",label:"🍽️ أكل"}]} />
          <Inp value={form.description} onChange={(v:string) => setForm(p=>({...p,description:v}))} placeholder="وصف مختصر" />
          <button type="submit" disabled={saving} className="col-span-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
            <Plus size={16}/>{saving?"جاري الإضافة...":"إضافة للقائمة"}
          </button>
        </form>
      </Card>
      {/* Items grouped by category */}
      {cats.length === 0 && items.length === 0 && <Empty icon="🍽️" text="القائمة فارغة — أضف منتجات!" />}
      {cats.map(cat => (
        <Card key={cat} className="overflow-hidden">
          <div className="px-5 py-3 bg-muted/30 border-b border-border">
            <span className="font-semibold text-foreground text-sm">{cat}</span>
          </div>
          <div className="divide-y divide-border">
            {items.filter(i => i.category === cat).map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1">
                  <p className={`font-medium text-sm ${item.available ? "text-foreground" : "text-muted-foreground line-through"}`}>{item.name}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                </div>
                <span className="text-primary font-bold text-sm">{item.price?.toFixed(3)} OMR</span>
                <button onClick={() => toggleAvail(item)} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${item.available ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {item.available ? "متاح" : "غير متاح"}
                </button>
                <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Chat Info Tab ─────────────────────────────────────────────
function ChatTab({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm]   = useState({ topic:"", content:"" });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api.cafeChat(id).then(d => setItems(d.items)), [id]);
  useEffect(() => { load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic || !form.content) return;
    setSaving(true);
    await api.addChatInfo(id, form);
    await load(); setForm({ topic:"", content:"" }); setSaving(false);
  };
  const del = async (cid: string) => {
    await api.deleteChatInfo(id, cid); setItems(prev => prev.filter(c => c.id !== cid));
  };
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-1">💬 إضافة معلومات للشات</h3>
        <p className="text-xs text-muted-foreground mb-4">هذه المعلومات سيستخدمها الشات للرد على المستخدمين بشكل دقيق</p>
        <form onSubmit={add} className="space-y-3">
          <Inp value={form.topic} onChange={(v:string) => setForm(p=>({...p,topic:v}))} placeholder="الموضوع — مثال: ساعات العمل، الواي فاي، العروض..." />
          <textarea value={form.content} onChange={e => setForm(p=>({...p,content:e.target.value}))} placeholder="المعلومات التفصيلية..." rows={3}
            className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none" />
          <button type="submit" disabled={saving} className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            <Plus size={16}/>{saving?"جاري الإضافة...":"إضافة معلومة"}
          </button>
        </form>
      </Card>
      {items.length === 0 && <Empty icon="💬" text="لا توجد معلومات للشات بعد" />}
      <div className="space-y-3">
        {items.map(item => (
          <Card key={item.id} className="p-4 flex gap-3">
            <div className="flex-1">
              <p className="font-semibold text-sm text-foreground mb-1">📌 {item.topic}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
            </div>
            <button onClick={() => del(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive shrink-0 h-fit"><Trash2 size={14}/></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Tables Tab ────────────────────────────────────────────────
function TablesTab({ id }: { id: string }) {
  const [tbls, setTbls]   = useState<any[]>([]);
  const [form, setForm]   = useState({ number:"", capacity:"" });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api.cafeTables(id).then(d => setTbls(d.tables)), [id]);
  useEffect(() => { load(); }, [load]);
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.number || !form.capacity) return;
    setSaving(true);
    await api.addTable(id, { number: +form.number, capacity: +form.capacity });
    await load(); setForm({ number:"", capacity:"" }); setSaving(false);
  };
  const del = async (tid: string) => {
    await api.deleteTable(id, tid); setTbls(prev => prev.filter(t => t.id !== tid));
  };
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4">➕ إضافة طاولة جديدة</h3>
        <form onSubmit={add} className="flex gap-3">
          <Inp value={form.number} onChange={(v:string) => setForm(p=>({...p,number:v}))} placeholder="رقم الطاولة *" type="number" className="flex-1" />
          <Inp value={form.capacity} onChange={(v:string) => setForm(p=>({...p,capacity:v}))} placeholder="السعة (أشخاص) *" type="number" className="flex-1" />
          <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
            <Plus size={16}/>{saving?"...":"إضافة"}
          </button>
        </form>
      </Card>
      {tbls.length === 0 && <Empty icon="🪑" text="لا توجد طاولات مضافة بعد" />}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {tbls.map(t => (
          <Card key={t.id} className="p-4 flex flex-col items-center gap-2 relative">
            <button onClick={() => del(t.id)} className="absolute top-2 left-2 p-1 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={13}/></button>
            <div className="text-4xl">🪑</div>
            <p className="font-bold text-foreground text-lg">طاولة {t.number}</p>
            <p className="text-xs text-muted-foreground">{t.capacity} أشخاص</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${t.available ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
              {t.available ? "متاحة" : "محجوزة"}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────
function InvoicesTab({ id }: { id: string }) {
  const [invs, setInvs] = useState<any[]>([]);
  useEffect(() => { api.cafeInvoices(id).then(d => setInvs(d.invoices)); }, [id]);
  const fmtDate = (d: string) => new Date(d).toLocaleString("ar-OM", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  return (
    <div className="space-y-4">
      {invs.length === 0 && <Empty icon="🧾" text="لا توجد فواتير بعد" />}
      {invs.map(inv => (
        <Card key={inv.id} className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold text-foreground">فاتورة #{inv.id.slice(-5)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{inv.customerName} • {fmtDate(inv.createdAt)}</p>
            </div>
            <span className="text-xl font-bold text-primary">{inv.total?.toFixed(3)} OMR</span>
          </div>
          <div className="space-y-1 border-t border-border pt-3">
            {inv.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.name} ×{item.qty}</span>
                <span className="text-foreground">{(item.price * item.qty).toFixed(3)} OMR</span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Loader() {
  return <div className="flex items-center justify-center py-20 text-muted-foreground">جاري التحميل...</div>;
}
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="text-5xl mb-3">{icon}</div>
      <p>{text}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CafeDashboardPage() {
  const params = useParams<{ id: string }>();
  const id     = params.id;
  const [_, navigate] = useLocation();
  const [cafe,    setCafe]    = useState<any>(null);
  const [tab,     setTab]     = useState<Tab>("stats");

  useEffect(() => {
    fetch("/api/admin/cafes").then(r => r.json()).then(d => {
      const found = d.cafes?.find((c: any) => c.id === id);
      if (found) setCafe(found);
    });
  }, [id]);

  return (
    <div className="flex flex-col h-screen bg-background" dir="rtl">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-border bg-card shrink-0">
        <Link href="/cafes">
          <a className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft size={18}/> العودة
          </a>
        </Link>
        <div className="w-px h-5 bg-border" />
        {cafe?.logo
          ? <img src={cafe.logo} className="w-9 h-9 rounded-xl object-cover" alt="" />
          : <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-xl">☕</div>}
        <div>
          <p className="font-bold text-foreground">{cafe?.name ?? "..."}</p>
          <p className="text-xs text-muted-foreground">{cafe?.address ?? ""}</p>
        </div>
        <div className="mr-auto">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cafe?.active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
            {cafe?.active ? "نشط" : "موقوف"}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-card shrink-0 overflow-x-auto">
        {TABS.map(({ id: tid, label, icon: Icon }) => (
          <button key={tid} onClick={() => setTab(tid)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
              ${tab === tid ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted/30"}`}>
            <Icon size={15}/>{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "stats"    && <StatsTab    id={id} />}
        {tab === "orders"   && <OrdersTab   id={id} />}
        {tab === "bookings" && <BookingsTab id={id} />}
        {tab === "menu"     && <MenuTab     id={id} />}
        {tab === "chat"     && <ChatTab     id={id} />}
        {tab === "tables"   && <TablesTab   id={id} />}
        {tab === "invoices" && <InvoicesTab id={id} />}
      </div>
    </div>
  );
}

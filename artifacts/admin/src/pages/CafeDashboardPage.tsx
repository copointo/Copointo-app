import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, LayoutDashboard, ShoppingBag, CalendarDays, UtensilsCrossed,
  MessageCircle, Table2, Receipt, Plus, Trash2, CheckCircle, Clock, ChevronDown,
  Lock, ShieldCheck, X, TrendingUp, Eye, Users, Crown, Trophy, Coffee, Car,
  CalendarRange, BarChart3, Tag, Percent,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { Link } from "wouter";

type Tab = "stats" | "orders" | "bookings" | "menu" | "chat" | "tables" | "invoices";

const TABS: { id: Tab; label: string; icon: any; emoji: string }[] = [
  { id:"stats",    label:"الإحصائيات",      icon: LayoutDashboard,  emoji:"📊" },
  { id:"orders",   label:"طلبات القهوة",     icon: ShoppingBag,      emoji:"☕" },
  { id:"bookings", label:"حجوزات الطاولة",   icon: CalendarDays,     emoji:"📅" },
  { id:"menu",     label:"القائمة",          icon: UtensilsCrossed,  emoji:"🍽️" },
  { id:"chat",     label:"معلومات الشات",    icon: MessageCircle,    emoji:"💬" },
  { id:"tables",   label:"الطاولات",         icon: Table2,           emoji:"🪑" },
  { id:"invoices", label:"الفواتير",         icon: Receipt,          emoji:"🧾" },
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
  const [err, setErr] = useState<string>("");
  useEffect(() => {
    api.cafeStats(id).then(setData).catch((e: any) => setErr(String(e?.message ?? e)));
  }, [id]);
  if (err) return <div className="p-8 text-center text-muted-foreground text-sm">تعذّر تحميل الإحصائيات.</div>;
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
  const confirmPrep = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "preparing");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "preparing" } : o));
  };
  const markReady = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "ready");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "ready" } : o));
  };
  const markDone = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "done");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "done" } : o));
  };
  const printInvoice = (o: any) => {
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    const rows = (o.items ?? []).map((it: any) =>
      `<tr><td>${it.name}</td><td style="text-align:center">×${it.qty}</td><td style="text-align:left">${(it.price * it.qty).toFixed(3)} OMR</td></tr>`
    ).join("");
    const where = o.type === "dine" ? `طاولة ${o.tableNumber}` : `سيارة: ${o.plateNumber} ${o.plateSymbol ?? ""}`;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة #${o.id?.slice(-6)}</title>
      <style>body{font-family:'Tahoma','Arial';padding:20px;color:#000}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#666;margin:0 0 16px;font-weight:normal}
      .info{font-size:12px;color:#444;margin-bottom:14px;line-height:1.7}
      table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px dashed #ccc;padding:8px 4px;text-align:right}
      .total{margin-top:14px;padding-top:10px;border-top:2px solid #000;display:flex;justify-content:space-between;font-weight:bold;font-size:15px}
      .footer{margin-top:24px;text-align:center;font-size:11px;color:#888}
      </style></head><body>
      <h1>☕ Copointo</h1>
      <h2>فاتورة طلب #${o.id?.slice(-6)}</h2>
      <div class="info">
        <div><b>الزبون:</b> ${o.customerName}</div>
        <div><b>الهاتف:</b> ${o.customerPhone}</div>
        <div><b>المكان:</b> ${where}</div>
        <div><b>التاريخ:</b> ${new Date(o.createdAt).toLocaleString("ar-OM")}</div>
      </div>
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total"><span>الإجمالي</span><span>${o.total?.toFixed(3)} OMR</span></div>
      <div class="footer">شكراً لزيارتكم — Copointo</div>
      <script>window.print();</script>
    </body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      {orders.length === 0 && <Empty icon="📦" text="لا توجد طلبات قهوة بعد" />}
      {orders.map(o => (
        <Card key={o.id} className="p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-semibold text-foreground">{o.customerName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {o.customerPhone} •{" "}
                {o.type === "dine"
                  ? `🪑 طاولة ${o.tableNumber}`
                  : `🚗 ${o.plateNumber} ${o.plateSymbol ?? ""}`}
              </p>
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
          <div className="flex items-center justify-between border-t border-border pt-3 gap-3 flex-wrap">
            <span className="font-bold text-primary">{o.total?.toFixed(3)} OMR</span>
            <div className="flex gap-2 flex-wrap">
              {o.status === "pending" && (
                <button
                  onClick={() => confirmPrep(o.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                >
                  <CheckCircle size={14}/> تأكيد تحضير الطلب
                </button>
              )}
              {o.status === "preparing" && (
                <button
                  onClick={() => markReady(o.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30"
                >
                  <CheckCircle size={13}/> الطلب جاهز
                </button>
              )}
              {o.status === "ready" && (
                <button
                  onClick={() => markDone(o.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/30"
                >
                  <CheckCircle size={13}/> تم التسليم
                </button>
              )}
              <button
                onClick={() => printInvoice(o)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:bg-muted/30"
              >
                🖨️ طباعة فاتورة
              </button>
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

  // Sequential 3D spin: each tab button rotates one after another every 5s
  const [spinIdx, setSpinIdx] = useState<number>(-1);
  useEffect(() => {
    let i = 0;
    const tick = () => {
      setSpinIdx(i);
      i = (i + 1) % TABS.length;
    };
    const timer = setTimeout(tick, 800); // first spin ~0.8s after mount
    const interval = setInterval(tick, 5000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  useEffect(() => {
    fetch("/api/admin/cafes").then(r => r.json()).then(d => {
      const found = d.cafes?.find((c: any) => c.id === id);
      if (found) {
        setCafe(found);
      } else {
        alert("هذا الكوفي لم يعد موجوداً (ربما حُذف أو تم إعادة تشغيل الخادم).");
        navigate("/cafes");
      }
    }).catch(() => {});
  }, [id, navigate]);

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

      {/* Tabs — square 3D-rotating buttons */}
      <div className="px-6 py-5 border-b border-border bg-card shrink-0">
        <div
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-4"
          style={{ perspective: "900px" }}
        >
          {/* Manager analytics — special king button (now opens full page) */}
          <Link
            href={`/cafe/${id}/analytics`}
            className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shrink-0 focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/60"
            style={{ perspective: "800px" }}
            title="إحصائيات المدير"
          >
            <div
              className="relative w-full h-full rounded-2xl flex flex-col items-center justify-center gap-1
                bg-gradient-to-br from-[#E8B86D] via-[#C99654] to-[#7A4F1E]
                border-2 border-[#FFE0A8] shadow-lg shadow-[#E8B86D]/40 text-black
                hover:shadow-xl hover:shadow-[#E8B86D]/60 group-hover:scale-[1.05] transition-all duration-200"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-1 rounded-xl ring-1 ring-black/15 pointer-events-none" />
              <Crown size={22} className="text-black drop-shadow" />
              <Lock size={14} className="text-black/70" />
              <span className="text-[10.5px] font-extrabold text-center px-1 leading-tight text-black">
                إحصائيات المدير
              </span>
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-card animate-pulse" />
            </div>
          </Link>
          {TABS.map(({ id: tid, label, icon: Icon, emoji }, i) => {
            const active     = tab === tid;
            const isSpinning = spinIdx === i;
            return (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                className="group relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/60"
                style={{ perspective: "800px" }}
                title={label}
              >
                <div
                  key={isSpinning ? `spin-${spinIdx}` : "idle"}
                  className={`relative w-full h-full rounded-2xl flex flex-col items-center justify-center gap-1.5
                    border transition-all duration-200
                    ${active
                      ? "bg-gradient-to-br from-[#E8B86D] via-[#D4A35A] to-[#B8884A] border-[#E8B86D] shadow-lg shadow-[#E8B86D]/30 text-black"
                      : "bg-gradient-to-br from-[#0A0606] via-[#050303] to-black border-[#E8B86D]/30 text-[#E8B86D] hover:border-[#E8B86D]/60 hover:shadow-md hover:shadow-[#E8B86D]/15 group-hover:scale-[1.04]"}
                    ${isSpinning ? "animate-spinY" : ""}`}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Inner gold accent ring */}
                  <div className={`absolute inset-1 rounded-xl pointer-events-none ${active ? "ring-1 ring-black/20" : "ring-1 ring-[#E8B86D]/15"}`} />

                  <span className="text-2xl leading-none drop-shadow-sm" aria-hidden>{emoji}</span>
                  <Icon size={18} className={active ? "text-black/80" : "text-[#E8B86D]/80"} />
                  <span className={`text-[11px] font-bold leading-tight text-center px-1 ${active ? "text-black" : "text-[#F5E6CC]"}`}>
                    {label}
                  </span>

                  {/* Active indicator dot */}
                  {active && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#E8B86D] shadow shadow-[#E8B86D]/60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
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

// ─── Discount Codes Tab ────────────────────────────────────────────
function DiscountCodesTab({ id }: { id: string }) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState<10 | 20 | 30 | 40 | 50>(10);
  const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [expiresAt, setExpiresAt] = useState<string>(tomorrow);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api.discountCodes(id).then(d => setCodes(d.codes ?? [])).catch(() => setCodes([]));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setErr("");
    const trimmed = code.trim();
    if (!/^\d+$/.test(trimmed)) { setErr("الكود يجب أن يكون أرقام فقط"); return; }
    if (!expiresAt) { setErr("اختر تاريخ الانتهاء"); return; }
    setLoading(true);
    try {
      // expiresAt input is YYYY-MM-DD; treat as end-of-day local.
      const expiry = new Date(expiresAt + "T23:59:59").toISOString();
      await api.addDiscountCode(id, { code: trimmed, percent, expiresAt: expiry });
      setCode("");
      setPercent(10);
      load();
    } catch (e: any) {
      try { setErr(JSON.parse(e?.message || "{}").error || "فشل الإنشاء"); }
      catch { setErr("فشل الإنشاء"); }
    } finally { setLoading(false); }
  };

  const remove = async (did: string) => {
    if (!confirm("هل تريد حذف هذا الكود؟")) return;
    try {
      await api.deleteDiscountCode(id, did);
      setCodes(prev => prev.filter(c => c.id !== did));
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Create card */}
      <Card className="p-5">
        <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus size={18} className="text-primary" /> إنشاء كود تخفيض
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">رمز الكود (أرقام فقط)</label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="مثال: 12345"
              className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary tracking-widest text-center"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">نسبة التخفيض</label>
            <div className="grid grid-cols-5 gap-1.5">
              {[10, 20, 30, 40, 50].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPercent(p as 10 | 20 | 30 | 40 | 50)}
                  className={`py-2 rounded-lg text-xs font-bold border transition ${
                    percent === p
                      ? "bg-primary text-primary-foreground border-primary shadow shadow-primary/30"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ينتهي في</label>
            <input
              type="date"
              value={expiresAt}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setExpiresAt(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              onClick={create}
              disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              <Tag size={15}/> {loading ? "جارٍ الإصدار..." : "إصدار الكود"}
            </button>
          </div>
        </div>
        {err && (
          <p className="mt-3 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3">{err}</p>
        )}
      </Card>

      {/* List */}
      <div className="space-y-3">
        {codes.length === 0 && <Empty icon="🏷️" text="لا توجد أكواد تخفيض حتى الآن" />}
        {codes.map(c => {
          const expired = new Date(c.expiresAt).getTime() < Date.now();
          return (
            <Card key={c.id} className={`p-4 flex items-center justify-between gap-4 ${expired ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-700 flex flex-col items-center justify-center text-primary-foreground shrink-0 shadow-md shadow-primary/20">
                  <Percent size={14} />
                  <span className="text-base font-extrabold leading-none">{c.percent}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-foreground font-mono font-bold text-lg tracking-widest truncate">{c.code}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ينتهي: {new Date(c.expiresAt).toLocaleDateString("ar-OM")} • مرات الاستخدام: {c.usedCount}
                    {expired && <span className="mr-2 text-red-400 font-semibold">(منتهي)</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                title="حذف"
              >
                <Trash2 size={16} />
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Manager Analytics Page (full screen) ──────────────────────────
export function ManagerAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const cafeId = params.id;
  const [, navigate] = useLocation();
  const [cafe, setCafe] = useState<any>(null);
  const [step, setStep]         = useState<"auth" | "view">("auth");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [data, setData]         = useState<any>(null);
  const [period, setPeriod]     = useState<"daily" | "monthly" | "yearly">("daily");

  useEffect(() => {
    fetch("/api/admin/cafes")
      .then(r => r.json())
      .then(d => {
        const found = d.cafes?.find((c: any) => c.id === cafeId);
        if (found) setCafe(found);
        else { alert("هذا الكوفي لم يعد موجوداً."); navigate(`/cafes`); }
      })
      .catch(() => {});
  }, [cafeId, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) { setError("ادخل كلمة المرور"); return; }
    setLoading(true);
    try {
      const res = await api.cafeAdvancedStats(cafeId, password.trim());
      setData(res);
      setStep("view");
    } catch (err: any) {
      const msg = err?.message || "";
      try { setError(JSON.parse(msg).error || "فشل التحقق"); }
      catch { setError("كلمة المرور غير صحيحة"); }
    } finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-background" dir="rtl">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#E8B86D]/20 bg-gradient-to-l from-[#E8B86D]/10 to-card shrink-0">
        <div className="flex items-center gap-4">
          <Link href={`/cafe/${cafeId}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft size={18}/> العودة للوحة الكوفي
          </Link>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#E8B86D] to-[#7A4F1E] flex items-center justify-center shadow-lg shadow-[#E8B86D]/30">
              <Crown size={20} className="text-black" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#F5E6CC]">إحصائيات المدير</h2>
              <p className="text-xs text-[#E8B86D]/70">{cafe?.name ?? "..."}</p>
            </div>
          </div>
        </div>
        {step === "view" && (
          <button
            onClick={() => { setStep("auth"); setData(null); setPassword(""); }}
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5"
          >
            إغلاق التقرير
          </button>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {step === "auth" ? (
          <form onSubmit={submit} className="max-w-md mx-auto py-16 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E8B86D] to-[#7A4F1E] flex items-center justify-center mx-auto shadow-xl shadow-[#E8B86D]/30">
                <Lock size={32} className="text-black" />
              </div>
              <h3 className="text-xl font-bold text-[#F5E6CC]">منطقة محمية</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ادخل كلمة مرور المدير المسجلة عند إنشاء الكوفي للوصول إلى التقارير المتقدمة.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-[#F5E6CC]">كلمة المرور</label>
              <input
                type="password" value={password} autoFocus
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-input border-2 border-[#E8B86D]/30 rounded-xl px-4 py-3 text-foreground text-base focus:outline-none focus:border-[#E8B86D] placeholder:text-muted-foreground text-center tracking-widest"
              />
              {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/30 rounded-lg py-2">
                  {error}
                </p>
              )}
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-l from-[#E8B86D] to-[#C99654] text-black font-bold text-base shadow-lg shadow-[#E8B86D]/30 hover:shadow-xl hover:shadow-[#E8B86D]/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? "جارٍ التحقق..." : (<><ShieldCheck size={18} />دخول</>)}
            </button>
          </form>
        ) : (
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Manager-only: Discount Codes */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Tag size={18} className="text-[#E8B86D]" />
                <h3 className="text-base font-extrabold text-[#F5E6CC]">أكواد التخفيض</h3>
              </div>
              <DiscountCodesTab id={cafeId} />
            </section>

            {/* Divider */}
            <div className="h-px bg-gradient-to-l from-transparent via-[#E8B86D]/30 to-transparent" />

            {/* Analytics view */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-[#E8B86D]" />
                <h3 className="text-base font-extrabold text-[#F5E6CC]">التقارير المتقدمة</h3>
              </div>
              <ManagerAnalyticsView data={data} period={period} setPeriod={setPeriod} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function GoldStat({ label, value, sub, icon, accent = "#E8B86D" }:
  { label: string; value: any; sub?: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0A0606] via-[#070404] to-black border border-[#E8B86D]/25 p-4 hover:border-[#E8B86D]/50 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#E8B86D]/70 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-extrabold text-[#F5E6CC] mt-1 truncate">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}11)`, color: accent }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0A0606] to-black border border-[#E8B86D]/20 p-5">
      <h3 className="text-sm font-bold text-[#F5E6CC] mb-4 flex items-center gap-2">
        {icon && <span className="text-[#E8B86D]">{icon}</span>}{title}
      </h3>
      {children}
    </div>
  );
}

function ManagerAnalyticsView({ data, period, setPeriod }:
  { data: any; period: "daily"|"monthly"|"yearly"; setPeriod: (p: "daily"|"monthly"|"yearly") => void }) {
  if (!data) return null;
  const r = data.revenue, o = data.orders, b = data.bookings, v = data.visits;
  const PIE_COLORS = ["#E8B86D", "#C99654", "#7A4F1E", "#F5E6CC", "#A87236", "#5B3A14"];

  const chartData = period === "daily" ? r.daily.map((d: any) => ({ x: d.date.slice(5), revenue: d.revenue }))
                  : period === "monthly" ? r.monthly.map((d: any) => ({ x: d.month, revenue: d.revenue }))
                  : r.yearly.map((d: any) => ({ x: d.year, revenue: d.revenue }));

  const orderTypeData   = [{ name: "داخل الكوفي", value: o.dineIn, color: "#E8B86D" }, { name: "خارج الكوفي (سيارة)", value: o.carOut, color: "#7A4F1E" }];
  const orderSourceData = [{ name: "طلب مباشر", value: o.direct, color: "#E8B86D" }, { name: "من الشات", value: o.viaChat, color: "#C99654" }];
  const bookingData     = [{ name: "بانتظار", value: b.pending, color: "#D4A35A" }, { name: "مؤكدة", value: b.confirmed, color: "#10B981" }, { name: "ملغية", value: b.cancelled, color: "#EF4444" }];

  return (
    <div className="space-y-6">
      {/* Revenue summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <GoldStat label="الإيرادات اليوم"    value={`${r.today.toFixed(3)} OMR`}  icon={<TrendingUp size={18} />} />
        <GoldStat label="الإيرادات الشهرية"  value={`${r.month.toFixed(3)} OMR`}  icon={<CalendarRange size={18} />} />
        <GoldStat label="الإيرادات السنوية"  value={`${r.year.toFixed(3)} OMR`}   icon={<BarChart3 size={18} />} />
        <GoldStat label="الإيرادات الكلية"  value={`${r.total.toFixed(3)} OMR`}  icon={<Trophy size={18} />} accent="#FFD700" />
      </div>

      {/* Revenue chart with period switcher */}
      <SectionCard title="📈 منحنى الإيرادات" icon={<TrendingUp size={16} />}>
        <div className="flex gap-2 mb-4">
          {([["daily","يومي"],["monthly","شهري"],["yearly","سنوي"]] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setPeriod(k)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition
                ${period === k
                  ? "bg-gradient-to-l from-[#E8B86D] to-[#C99654] text-black shadow shadow-[#E8B86D]/30"
                  : "bg-muted/40 text-[#E8B86D]/80 hover:bg-muted/60"}`}>
              {lbl}
            </button>
          ))}
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#E8B86D" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#E8B86D" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
              <XAxis dataKey="x" tick={{ fill: "#E8B86D", fontSize: 11 }} />
              <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              <Area type="monotone" dataKey="revenue" stroke="#E8B86D" strokeWidth={2.5} fill="url(#goldFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-10 text-sm">لا توجد بيانات بعد</p>
        )}
      </SectionCard>

      {/* Counts row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <GoldStat label="إجمالي الطلبات"    value={o.total}     icon={<ShoppingBag size={18} />} />
        <GoldStat label="داخل الكوفي"       value={o.dineIn}    icon={<Coffee size={18} />} />
        <GoldStat label="خارج الكوفي"       value={o.carOut}    icon={<Car size={18} />} />
        <GoldStat label="حجوزات الطاولات"   value={b.total}     icon={<Table2 size={18} />} />
        <GoldStat label="مشاهدات الكوفي"    value={v.total}     icon={<Eye size={18} />} />
        <GoldStat label="زوار فريدون"        value={v.uniqueViewers} icon={<Users size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order type pie */}
        <SectionCard title="نوع الطلب" icon={<Coffee size={16} />}>
          {(o.dineIn + o.carOut) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={orderTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {orderTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Legend wrapperStyle={{ color: "#F5E6CC" }} />
                <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد طلبات بعد</p>}
        </SectionCard>

        {/* Order source pie */}
        <SectionCard title="مصدر الطلب (مباشر / شات)" icon={<MessageCircle size={16} />}>
          {(o.direct + o.viaChat) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={orderSourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {orderSourceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Legend wrapperStyle={{ color: "#F5E6CC" }} />
                <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد طلبات بعد</p>}
        </SectionCard>

        {/* Weekday bar */}
        <SectionCard title={`الأيام الأكثر طلباً ${data.busiestDay?.orders ? `(الأكثر: ${data.busiestDay.day})` : ""}`} icon={<CalendarDays size={16} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.weekdayChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
              <XAxis dataKey="day" tick={{ fill: "#E8B86D", fontSize: 11 }} />
              <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              <Bar dataKey="orders" fill="#E8B86D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Bookings status */}
        <SectionCard title="حالة الحجوزات" icon={<Table2 size={16} />}>
          {b.total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={bookingData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {bookingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Legend wrapperStyle={{ color: "#F5E6CC" }} />
                <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد حجوزات بعد</p>}
        </SectionCard>
      </div>

      {/* Visits & conversion */}
      <SectionCard title="الزيارات والتحويل" icon={<Eye size={16} />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GoldStat label="إجمالي المشاهدات"     value={v.total}            icon={<Eye size={18} />} />
          <GoldStat label="زوار مميزون"          value={v.uniqueViewers}    icon={<Users size={18} />} />
          <GoldStat label="زوار طلبوا"            value={v.viewsThatOrdered} icon={<ShoppingBag size={18} />} />
          <GoldStat label="نسبة التحويل"          value={`${v.conversionRate}%`} icon={<TrendingUp size={18} />} accent="#10B981" />
        </div>
      </SectionCard>

      {/* Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="المنتجات الأكثر طلباً" icon={<Trophy size={16} />}>
          {data.topProducts.length > 0 ? (
            <div className="space-y-2">
              {data.topProducts.map((p: any, i: number) => (
                <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-black/40 border border-[#E8B86D]/15">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold"
                    style={{ background: i === 0 ? "#E8B86D" : i === 1 ? "#C99654" : "#7A4F1E", color: "#000" }}>
                    {i + 1}
                  </div>
                  <span className="flex-1 text-[#F5E6CC] font-semibold text-sm truncate">{p.name}</span>
                  <span className="text-[#E8B86D] text-xs font-bold">{p.qty}× </span>
                  <span className="text-muted-foreground text-xs">{p.revenue} OMR</span>
                </div>
              ))}
            </div>
          ) : <p className="text-center text-muted-foreground py-6 text-sm">لا توجد بيانات</p>}
        </SectionCard>

        {/* Top categories */}
        <SectionCard title="الفئة الأكثر طلباً" icon={<UtensilsCrossed size={16} />}>
          {data.topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.topCategories} dataKey="qty" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {data.topCategories.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Legend wrapperStyle={{ color: "#F5E6CC" }} />
                <Tooltip contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد بيانات</p>}
        </SectionCard>
      </div>

      {/* Players ranking */}
      <SectionCard title="لاعبو اللعبة وترتيبهم في عُمان" icon={<Crown size={16} />}>
        {data.players.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#E8B86D]/70 border-b border-[#E8B86D]/20">
                  <th className="text-right py-2 px-2 font-bold">#</th>
                  <th className="text-right py-2 px-2 font-bold">الاسم</th>
                  <th className="text-right py-2 px-2 font-bold">الرقم</th>
                  <th className="text-right py-2 px-2 font-bold">طلبات هنا</th>
                  <th className="text-right py-2 px-2 font-bold">إجمالي طلباته</th>
                  <th className="text-right py-2 px-2 font-bold">المستوى</th>
                  <th className="text-right py-2 px-2 font-bold">ترتيب عُمان</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p: any, i: number) => (
                  <tr key={p.phone} className="border-b border-[#E8B86D]/10 hover:bg-[#E8B86D]/5">
                    <td className="py-2.5 px-2">
                      <span className="inline-flex w-6 h-6 rounded-md items-center justify-center text-[11px] font-extrabold"
                        style={{ background: i === 0 ? "#E8B86D" : i === 1 ? "#C99654" : "#3A2410", color: i < 2 ? "#000" : "#E8B86D" }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-[#F5E6CC] font-semibold">{p.username}</td>
                    <td className="py-2.5 px-2 text-muted-foreground text-xs">{p.phone}</td>
                    <td className="py-2.5 px-2 text-[#E8B86D] font-bold">{p.ordersHere}</td>
                    <td className="py-2.5 px-2 text-foreground">{p.totalOrders}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">Lv {p.level}</td>
                    <td className="py-2.5 px-2">
                      {p.omanRank
                        ? <span className="inline-flex items-center gap-1 text-amber-300 font-bold"><Trophy size={12} />#{p.omanRank}</span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center text-muted-foreground py-6 text-sm">لا يوجد لاعبون طلبوا من هذا الكوفي بعد</p>}
      </SectionCard>

      {/* Invoices */}
      <SectionCard title="جميع الفواتير" icon={<Receipt size={16} />}>
        {data.invoices.length > 0 ? (
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="text-[11px] uppercase tracking-wider text-[#E8B86D]/70 border-b border-[#E8B86D]/20">
                  <th className="text-right py-2 px-2 font-bold">رقم</th>
                  <th className="text-right py-2 px-2 font-bold">العميل</th>
                  <th className="text-right py-2 px-2 font-bold">عدد الأصناف</th>
                  <th className="text-right py-2 px-2 font-bold">النوع</th>
                  <th className="text-right py-2 px-2 font-bold">التاريخ</th>
                  <th className="text-left py-2 px-2 font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-[#E8B86D]/10 hover:bg-[#E8B86D]/5">
                    <td className="py-2 px-2 text-muted-foreground text-xs font-mono">{inv.id.slice(-8)}</td>
                    <td className="py-2 px-2 text-[#F5E6CC]">{inv.customerName}</td>
                    <td className="py-2 px-2 text-[#E8B86D]">{inv.items?.length ?? 0}</td>
                    <td className="py-2 px-2 text-muted-foreground text-xs">{inv.type === "order" ? "طلب" : "حجز"}</td>
                    <td className="py-2 px-2 text-muted-foreground text-xs">{new Date(inv.createdAt).toLocaleString("ar-EG")}</td>
                    <td className="py-2 px-2 text-left text-[#E8B86D] font-bold">{inv.total.toFixed(3)} OMR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-center text-muted-foreground py-6 text-sm">لا توجد فواتير بعد</p>}
      </SectionCard>
    </div>
  );
}

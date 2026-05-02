import { useEffect, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, LayoutDashboard, ShoppingBag, CalendarDays, UtensilsCrossed,
  MessageCircle, Table2, Receipt, Plus, Trash2, CheckCircle, Clock, ChevronDown,
  Lock, ShieldCheck, X, TrendingUp, Eye, Users, Crown, Trophy, Coffee, Car,
  CalendarRange, BarChart3, Tag, Percent, Pencil, ImagePlus,
  Wallet, FileText, Printer, Save,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { Link } from "wouter";

type Tab = "stats" | "orders" | "bookings" | "menu" | "chat" | "tables" | "invoices" | "expenses" | "templates";

const TABS: { id: Tab; label: string; icon: any; emoji: string }[] = [
  { id:"stats",     label:"الإحصائيات",       icon: LayoutDashboard,  emoji:"📊" },
  { id:"orders",    label:"طلبات القهوة",      icon: ShoppingBag,      emoji:"☕" },
  { id:"bookings",  label:"حجوزات الطاولة",    icon: CalendarDays,     emoji:"📅" },
  { id:"menu",      label:"القائمة",           icon: UtensilsCrossed,  emoji:"🍽️" },
  { id:"chat",      label:"معلومات الشات",     icon: MessageCircle,    emoji:"💬" },
  { id:"tables",    label:"الطاولات",          icon: Table2,           emoji:"🪑" },
  { id:"invoices",  label:"الفواتير",          icon: Receipt,          emoji:"🧾" },
  { id:"expenses",  label:"المصاريف",          icon: Wallet,           emoji:"💸" },
  { id:"templates", label:"تعديل الفواتير",    icon: FileText,         emoji:"📝" },
];

const INVOICE_TYPE_LABEL: Record<string, string> = {
  order:   "فواتير الطلبات",
  expense: "فواتير المصاريف",
  daily:   "فواتير يومية",
  monthly: "فواتير شهرية",
  yearly:  "فواتير سنوية",
};

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

// ── Invoice rendering helpers (shared across tabs) ───────────
const ITEM_CATEGORIES = [
  { key: "حلى",            match: /حل[ىو]|حلوي|كيك|كرواس|دونات|تشيز|بسبوس/ },
  { key: "مشروبات ساخنة",  match: /قهوة|إسبر|اسبر|لاتيه|كابو|موكا|شاي|ساخن|أمريكا|كورت/ },
  { key: "مشروبات باردة",  match: /آيس|ايس|ميلك\s*شيك|عصير|سموذي|فرابي|مثلج|فريش|بارد/ },
  { key: "طعام",            match: /برغر|سندوي|فطور|بيتزا|باستا|طعام|أكل|سلطة|رول|توست|جبن/ },
] as const;

function classifyItem(name: string, original?: string): string {
  if (original) return original;
  for (const c of ITEM_CATEGORIES) if (c.match.test(name)) return c.key;
  return "أخرى";
}

function tplHeaderHtml(tpl: any, title: string, subtitle: string): string {
  const logoHtml = tpl?.logo
    ? `<img src="${tpl.logo}" class="logo" alt="">`
    : `<div class="logo logo-fallback">☕</div>`;
  return `
    <div class="header">
      ${logoHtml}
      <div class="brand">${tpl?.cafeName ?? ""}</div>
      ${tpl?.commercialReg ? `<div class="meta">س.ت • ${tpl.commercialReg}</div>` : ""}
      ${tpl?.contactPhone  ? `<div class="meta">${tpl.contactPhone}</div>` : ""}
    </div>
    <div class="divider"><span>✦</span></div>
    <div class="title-block">
      <div class="title">${title}</div>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
    </div>
    <div class="divider"><span>✦</span></div>
  `;
}

function tplFooterHtml(tpl: any): string {
  const promo = (tpl?.promoText ?? "شكراً لزيارتكم").replace(/\n/g, "<br>");
  const stamp = new Date().toLocaleString("ar-OM", {
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit",
  });
  return `
    <div class="divider"><span>✦</span></div>
    <div class="promo">${promo}</div>
    <div class="stamp">طُبعت في: ${stamp}</div>
    <div class="cut">✂ ─────────────────────────── ✂</div>
  `;
}

function openPrintWindow(title: string, body: string) {
  const w = window.open("", "_blank", "width=420,height=760");
  if (!w) return;
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      /* ── Page size: receipt paper, but content stays centered on any size ── */
      @page { size: 80mm auto; margin: 0; }

      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body {
        margin: 0; padding: 0;
        background: #efe9df;
        font-family: 'Tahoma','Segoe UI','Arial Unicode MS','Geeza Pro','Noto Sans Arabic','Arial', sans-serif;
        color: #2a1a0e; line-height: 1.6;
        text-align: center;     /* ⭐ ensure centering even if browser uses A4 */
      }

      /* ── Receipt wrapper (always centered) ─────────────── */
      .receipt {
        width: 72mm;            /* effective content width inside 80mm paper */
        margin: 6mm auto;       /* horizontally centered in any page size */
        padding: 4mm 4mm;
        background: #fdfbf6;
        text-align: right;      /* RTL natural alignment inside */
        direction: rtl;
        font-size: 12px;
      }

      /* ── Header ─────────────────────────────────────────── */
      .header { text-align: center; margin-bottom: 6px; }
      .logo {
        width: 56px; height: 56px; border-radius: 14px;
        object-fit: cover; margin: 0 auto 6px;
        display: block; border: 1.5px solid #C67C4E;
      }
      .logo-fallback {
        font-size: 32px; line-height: 56px; padding: 0;
        background: #f6ecd8; color: #6b4119; text-align: center;
      }
      .brand {
        font-size: 17px; font-weight: bold; color: #4a2c14;
        margin-top: 4px; letter-spacing: 0;
      }
      .meta { font-size: 11px; color: #6b513b; margin-top: 2px; }

      /* ── Decorative divider with center glyph ──────────── */
      .divider {
        position: relative; text-align: center;
        margin: 9px 0; height: 14px; line-height: 14px;
      }
      .divider::before {
        content: ""; position: absolute; top: 50%; left: 0; right: 0;
        height: 0; border-top: 1px dashed #b07b4c;
      }
      .divider span {
        position: relative; display: inline-block;
        background: #fdfbf6; padding: 0 8px;
        font-size: 11px; color: #C67C4E;
      }

      /* ── Title block ───────────────────────────────────── */
      .title-block { text-align: center; padding: 3px 0; }
      .title {
        font-size: 14px; font-weight: bold; color: #4a2c14;
      }
      .subtitle { font-size: 11px; color: #6b513b; margin-top: 2px; }

      /* ── Info rows ─────────────────────────────────────── */
      .info-block {
        background: #faf3e6; border-radius: 6px;
        padding: 7px 9px; margin: 8px 0;
        font-size: 11.5px; line-height: 1.9;
      }
      .info-block b { color: #4a2c14; font-weight: bold; }

      /* ── Section title ─────────────────────────────────── */
      .sec-title {
        font-size: 12px; font-weight: bold; margin: 10px 0 5px;
        color: #4a2c14; padding: 4px 8px;
        background: #f6ecd8;
        border-right: 3px solid #C67C4E; border-radius: 4px;
      }

      /* ── Tables ────────────────────────────────────────── */
      table {
        width: 100%; border-collapse: collapse; font-size: 11px;
        table-layout: fixed; word-wrap: break-word;
      }
      thead th {
        background: #4a2c14; color: #fdfbf6;
        padding: 5px 3px; font-weight: bold; font-size: 11px;
        text-align: center;
      }
      tbody td {
        padding: 5px 3px; border-bottom: 1px dashed #d4b896;
        text-align: right; font-size: 11px;
      }
      tbody tr:last-child td { border-bottom: none; }

      /* ── Rows / total ──────────────────────────────────── */
      .row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11.5px; padding: 3px 0;
      }
      .total {
        margin-top: 10px; padding: 10px 12px;
        background: #4a2c14;
        color: #fdfbf6; border-radius: 6px;
        display: flex; justify-content: space-between; align-items: center;
        font-weight: bold; font-size: 14px;
      }
      .total span:last-child { color: #f5d59a; font-size: 15px; }

      /* ── Footer ────────────────────────────────────────── */
      .promo {
        text-align: center; font-size: 11.5px;
        color: #6b4119; font-style: italic; line-height: 1.7;
        padding: 4px 6px;
      }
      .stamp {
        text-align: center; font-size: 10px;
        color: #9a7656; margin-top: 6px;
      }
      .cut {
        text-align: center; color: #b07b4c; font-size: 10px;
        letter-spacing: 1px; margin-top: 8px;
      }

      /* ── Empty state ───────────────────────────────────── */
      .empty {
        text-align: center; color: #9a7656;
        font-size: 11px; padding: 10px 0; font-style: italic;
      }

      /* ── Print mode: white page background ─────────────── */
      @media print {
        html, body { background: #fff !important; }
        .receipt { margin: 2mm auto !important; }
      }
    </style></head><body>
      <div class="receipt">${body}</div>
      <script>
        // Wait for fonts + images to load before printing so PDF render is clean.
        function go(){ try { window.focus(); window.print(); } catch(e) {} }
        var imgs = Array.from(document.images);
        Promise.all([
          (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve(),
          ...imgs.map(function(i){
            return i.complete ? Promise.resolve()
              : new Promise(function(r){ i.onload = i.onerror = r; });
          })
        ]).then(function(){ setTimeout(go, 120); });
      </script>
    </body></html>`);
  w.document.close();
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
  const printInvoice = async (o: any) => {
    // Award points + mark order as done (idempotent on server) — fire and forget.
    api.cafeOrderPrint(id, o.id).then(() => {
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "done", pointsAwarded: true } : x));
    }).catch(() => { /* swallow — print still happens */ });
    let tpl: any = null;
    try { tpl = (await api.invoiceTemplate(id, "order")).template; } catch { /* fallback */ }

    const rows = (o.items ?? []).map((it: any) =>
      `<tr><td>${it.name}</td><td style="text-align:center">×${it.qty}</td><td style="text-align:left">${(it.price * it.qty).toFixed(3)}</td></tr>`
    ).join("");
    const where = o.type === "dine" ? `طاولة ${o.tableNumber}` : `سيارة: ${o.plateNumber} ${o.plateSymbol ?? ""}`;

    const body = `
      ${tplHeaderHtml(tpl, `فاتورة طلب #${o.id?.slice(-6)}`, "")}
      <div class="info-block">
        <div><b>الزبون:</b> ${o.customerName}</div>
        <div><b>الهاتف:</b> ${o.customerPhone}</div>
        <div><b>المكان:</b> ${where}</div>
        <div><b>التاريخ:</b> ${new Date(o.createdAt).toLocaleString("ar-OM")}</div>
      </div>
      <div class="sec-title">تفاصيل الطلب</div>
      <table><thead><tr><th>الصنف</th><th>كمية</th><th>السعر</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total"><span>الإجمالي</span><span>${o.total?.toFixed(3)} ر.ع</span></div>
      ${tplFooterHtml(tpl)}
    `;
    openPrintWindow(`فاتورة طلب #${o.id?.slice(-6)}`, body);
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
const MENU_CATEGORIES = [
  { value: "مشروب ساخن",   label: "☕ مشروب ساخن" },
  { value: "مشروبات باردة", label: "🥤 مشروبات باردة" },
  { value: "حلى",          label: "🍰 حلى" },
  { value: "طعام",         label: "🍽️ طعام" },
];
const DEFAULT_CATEGORY = MENU_CATEGORIES[0].value;
const MAX_IMAGE_BYTES = 600 * 1024; // 600KB cap on upload

type PromoMode = "none" | "discount" | "bundle";
type MenuForm = {
  name: string; price: string; category: string; description: string; image: string;
  promoMode: PromoMode;
  originalPrice: string;
  promoBuyQty: string;
  promoGetQty: string;
};
const emptyForm = (): MenuForm => ({
  name: "", price: "", category: DEFAULT_CATEGORY, description: "", image: "",
  promoMode: "none", originalPrice: "", promoBuyQty: "", promoGetQty: "",
});

function MenuTab({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm]   = useState<MenuForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgErr, setImgErr] = useState<string>("");

  const load = useCallback(() => api.cafeMenu(id).then(d => setItems(d.items)), [id]);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyForm()); setEditingId(null); setImgErr(""); setFormErr(""); };

  const [formErr, setFormErr] = useState<string>("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr("");
    if (!form.name || !form.price) return;
    const price = +form.price;

    let originalPrice: number | null = null;
    let promoBuyQty:   number | null = null;
    let promoGetQty:   number | null = null;

    if (form.promoMode === "discount") {
      const op = +form.originalPrice;
      if (!form.originalPrice || isNaN(op) || op <= price) {
        setFormErr("السعر قبل الخصم يجب أن يكون أكبر من السعر الحالي");
        return;
      }
      originalPrice = op;
    } else if (form.promoMode === "bundle") {
      const b = +form.promoBuyQty, g = +form.promoGetQty;
      if (!form.promoBuyQty || !form.promoGetQty || b < 1 || g < 1) {
        setFormErr("أدخل قيم صحيحة لـ (اشترِ) و (احصل على)");
        return;
      }
      promoBuyQty = Math.floor(b);
      promoGetQty = Math.floor(g);
    }

    setSaving(true);
    try {
      const body = {
        name: form.name,
        price,
        category: form.category,
        description: form.description,
        image: form.image || null,
        originalPrice,
        promoBuyQty,
        promoGetQty,
      };
      if (editingId) {
        await api.updateMenuItem(id, editingId, body);
      } else {
        await api.addMenuItem(id, body);
      }
      await load();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setImgErr("");
    setFormErr("");
    const promoMode: PromoMode =
      item.originalPrice ? "discount"
      : (item.promoBuyQty && item.promoGetQty) ? "bundle"
      : "none";
    setForm({
      name: item.name ?? "",
      price: String(item.price ?? ""),
      category: item.category ?? DEFAULT_CATEGORY,
      description: item.description ?? "",
      image: item.image ?? "",
      promoMode,
      originalPrice: item.originalPrice ? String(item.originalPrice) : "",
      promoBuyQty: item.promoBuyQty ? String(item.promoBuyQty) : "",
      promoGetQty: item.promoGetQty ? String(item.promoGetQty) : "",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (mid: string) => {
    await api.deleteMenuItem(id, mid);
    setItems(prev => prev.filter(m => m.id !== mid));
    if (editingId === mid) resetForm();
  };
  const toggleAvail = async (item: any) => {
    await api.updateMenuItem(id, item.id, { available: !item.available });
    setItems(prev => prev.map(m => m.id === item.id ? { ...m, available: !m.available } : m));
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgErr("");
    if (!file.type.startsWith("image/")) { setImgErr("الملف ليس صورة"); return; }
    if (file.size > MAX_IMAGE_BYTES)     { setImgErr("الصورة كبيرة جداً (الحد الأقصى 600 كيلوبايت)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      setForm(p => ({ ...p, image: url }));
    };
    reader.onerror = () => setImgErr("تعذر قراءة الصورة");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      {/* Add / Edit form */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          {editingId ? <><Pencil size={16} className="text-primary" /> تعديل المنتج</> : <>➕ إضافة عنصر جديد للقائمة</>}
        </h3>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Inp value={form.name} onChange={(v:string) => setForm(p=>({...p,name:v}))} placeholder="اسم المنتج *" />
          <Inp value={form.price} onChange={(v:string) => setForm(p=>({...p,price:v}))} placeholder="السعر (OMR) *" type="number" />
          <Sel value={form.category} onChange={(v:string) => setForm(p=>({...p,category:v}))} options={MENU_CATEGORIES} />
          <Inp value={form.description} onChange={(v:string) => setForm(p=>({...p,description:v}))} placeholder="وصف مختصر" />

          {/* Image picker */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">صورة المنتج (اختياري)</label>
            <div className="flex items-center gap-3">
              {form.image ? (
                <img src={form.image} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-muted-foreground">
                  <ImagePlus size={22} />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 bg-card border border-border hover:border-primary/50 rounded-xl px-3 py-2 text-sm text-foreground transition w-fit">
                  <ImagePlus size={15}/> {form.image ? "تغيير الصورة" : "اختيار صورة"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                </label>
                {form.image && (
                  <button type="button" onClick={() => setForm(p=>({...p,image:""}))} className="text-xs text-red-400 hover:text-red-300 w-fit">
                    إزالة الصورة
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">حد أقصى 600 كيلوبايت — الصورة اختيارية</p>
                {imgErr && <p className="text-[11px] text-red-400">{imgErr}</p>}
              </div>
            </div>
          </div>

          {/* Promo / offer */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">العرض على المنتج (اختياري)</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "none",     label: "بدون عرض",         emoji: "—" },
                { v: "discount", label: "تخفيض (سعر قديم)",  emoji: "🏷️" },
                { v: "bundle",   label: "اشترِ X احصل على Y", emoji: "🎁" },
              ] as { v: PromoMode; label: string; emoji: string }[]).map(opt => {
                const active = form.promoMode === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, promoMode: opt.v }))}
                    className={`py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow shadow-primary/30"
                        : "bg-card text-muted-foreground border-border hover:border-primary/40"
                    }`}
                  >
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                );
              })}
            </div>

            {form.promoMode === "discount" && (
              <div className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">السعر قبل الخصم (OMR)</label>
                  <Inp
                    value={form.originalPrice}
                    onChange={(v: string) => setForm(p => ({ ...p, originalPrice: v }))}
                    placeholder="مثال: 2.5"
                    type="number"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-[11px] text-muted-foreground">
                    سيظهر في التطبيق: <span className="line-through text-red-400">{form.originalPrice || "0.000"}</span>{" "}
                    <span className="text-primary font-bold">{form.price || "0.000"} OMR</span>
                  </p>
                </div>
              </div>
            )}

            {form.promoMode === "bundle" && (
              <div className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">اشترِ (عدد)</label>
                  <Inp
                    value={form.promoBuyQty}
                    onChange={(v: string) => setForm(p => ({ ...p, promoBuyQty: v.replace(/\D/g, "") }))}
                    placeholder="مثال: 3"
                    type="number"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1">احصل على (مجاناً)</label>
                  <Inp
                    value={form.promoGetQty}
                    onChange={(v: string) => setForm(p => ({ ...p, promoGetQty: v.replace(/\D/g, "") }))}
                    placeholder="مثال: 1"
                    type="number"
                  />
                </div>
                {form.promoBuyQty && form.promoGetQty && (
                  <p className="col-span-2 text-[11px] text-primary font-semibold">
                    🎁 سيظهر: اشترِ {form.promoBuyQty} واحصل على {form.promoGetQty} مجاناً
                  </p>
                )}
              </div>
            )}
          </div>

          {formErr && (
            <p className="col-span-2 text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3">{formErr}</p>
          )}

          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
              {editingId ? <><CheckCircle size={16}/>{saving?"جاري الحفظ...":"حفظ التعديلات"}</> : <><Plus size={16}/>{saving?"جاري الإضافة...":"إضافة للقائمة"}</>}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Items grouped by category (fixed order) */}
      {items.length === 0 && <Empty icon="🍽️" text="القائمة فارغة — أضف منتجات!" />}
      {MENU_CATEGORIES.map(({ value: cat, label }) => {
        const list = items.filter(i => i.category === cat);
        if (list.length === 0) return null;
        return (
          <Card key={cat} className="overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <span className="font-semibold text-foreground text-sm">{label}</span>
            </div>
            <div className="divide-y divide-border">
              {list.map(item => (
                <div key={item.id} className={`flex items-center gap-3 px-5 py-3 ${editingId === item.id ? "bg-primary/5" : ""}`}>
                  {item.image ? (
                    <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted/30 border border-border flex items-center justify-center text-lg shrink-0">🍽️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${item.available ? "text-foreground" : "text-muted-foreground line-through"}`}>{item.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-0.5 items-center">
                      {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
                      {item.originalPrice && (
                        <span className="text-[10px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded">
                          🏷️ خصم من {item.originalPrice.toFixed(3)} OMR
                        </span>
                      )}
                      {item.promoBuyQty && item.promoGetQty && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
                          🎁 اشترِ {item.promoBuyQty} احصل على {item.promoGetQty}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-primary font-bold text-sm whitespace-nowrap">{item.price?.toFixed(3)} OMR</span>
                  <button onClick={() => toggleAvail(item)} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${item.available ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {item.available ? "متاح" : "غير متاح"}
                  </button>
                  <button onClick={() => startEdit(item)} title="تعديل" className="p-1.5 rounded-lg hover:bg-primary/15 text-primary"><Pencil size={14}/></button>
                  <button onClick={() => del(item.id)} title="حذف" className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* Legacy items (any category not in the 4 standard ones) */}
      {(() => {
        const known = new Set(MENU_CATEGORIES.map(c => c.value));
        const legacy = items.filter(i => !known.has(i.category));
        if (legacy.length === 0) return null;
        return (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border">
              <span className="font-semibold text-foreground text-sm">📦 تصنيفات قديمة (عدّلها لتظهر للزبائن)</span>
            </div>
            <div className="divide-y divide-border">
              {legacy.map(item => (
                <div key={item.id} className={`flex items-center gap-3 px-5 py-3 ${editingId === item.id ? "bg-primary/5" : ""}`}>
                  <div className="w-12 h-12 rounded-lg bg-muted/30 border border-border flex items-center justify-center text-lg shrink-0">🍽️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate text-foreground">{item.name}</p>
                    <p className="text-xs text-amber-400 mt-0.5">التصنيف الحالي: {item.category}</p>
                  </div>
                  <span className="text-primary font-bold text-sm whitespace-nowrap">{item.price?.toFixed(3)} OMR</span>
                  <button onClick={() => startEdit(item)} title="تعديل" className="p-1.5 rounded-lg hover:bg-primary/15 text-primary"><Pencil size={14}/></button>
                  <button onClick={() => del(item.id)} title="حذف" className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
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
type PriceTier = { hours: string; price: string };
type TableForm = {
  number: string; capacity: string; image: string;
  hourlyPricing: PriceTier[];
};
const emptyTableForm = (): TableForm => ({ number: "", capacity: "", image: "", hourlyPricing: [] });

function TablesTab({ id }: { id: string }) {
  const [tbls, setTbls]   = useState<any[]>([]);
  const [form, setForm]   = useState<TableForm>(emptyTableForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgErr, setImgErr] = useState<string>("");
  const [formErr, setFormErr] = useState<string>("");

  const load = useCallback(() => api.cafeTables(id).then(d => setTbls(d.tables)), [id]);
  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(emptyTableForm()); setEditingId(null);
    setImgErr(""); setFormErr("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr("");
    if (!form.number || !form.capacity) return;

    // Validate hourly pricing tiers (only non-empty rows count)
    const tiers: { hours: number; price: number }[] = [];
    for (const t of form.hourlyPricing) {
      if (!t.hours && !t.price) continue;
      const h = +t.hours, p = +t.price;
      if (!h || !p || h < 1 || p < 0) {
        setFormErr("تأكد من إدخال الساعات والسعر بشكل صحيح في كل صف");
        return;
      }
      tiers.push({ hours: Math.floor(h), price: p });
    }
    tiers.sort((a, b) => a.hours - b.hours);

    setSaving(true);
    try {
      const body: any = {
        number: +form.number,
        capacity: +form.capacity,
        image: form.image || null,
        hourlyPricing: tiers,
      };
      if (editingId) {
        await api.updateTable(id, editingId, body);
      } else {
        await api.addTable(id, body);
      }
      await load();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: any) => {
    setEditingId(t.id);
    setImgErr(""); setFormErr("");
    setForm({
      number: String(t.number ?? ""),
      capacity: String(t.capacity ?? ""),
      image: t.image ?? "",
      hourlyPricing: (t.hourlyPricing ?? []).map((tier: any) => ({
        hours: String(tier.hours), price: String(tier.price),
      })),
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (tid: string) => {
    await api.deleteTable(id, tid);
    setTbls(prev => prev.filter(t => t.id !== tid));
    if (editingId === tid) resetForm();
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgErr("");
    if (!file.type.startsWith("image/")) { setImgErr("الملف ليس صورة"); return; }
    if (file.size > MAX_IMAGE_BYTES)     { setImgErr("الصورة كبيرة جداً (الحد الأقصى 600 كيلوبايت)"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(p => ({ ...p, image: String(reader.result || "") }));
    reader.onerror = () => setImgErr("تعذر قراءة الصورة");
    reader.readAsDataURL(file);
  };

  const addTier = () => setForm(p => ({ ...p, hourlyPricing: [...p.hourlyPricing, { hours: "", price: "" }] }));
  const updateTier = (idx: number, key: keyof PriceTier, val: string) =>
    setForm(p => ({
      ...p,
      hourlyPricing: p.hourlyPricing.map((t, i) => i === idx ? { ...t, [key]: val.replace(/[^\d.]/g, "") } : t),
    }));
  const removeTier = (idx: number) =>
    setForm(p => ({ ...p, hourlyPricing: p.hourlyPricing.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-5">
      {/* Add / Edit form */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          {editingId ? <><Pencil size={16} className="text-primary" /> تعديل الطاولة</> : <>➕ إضافة طاولة جديدة</>}
        </h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Inp value={form.number} onChange={(v:string) => setForm(p=>({...p,number:v}))} placeholder="رقم الطاولة *" type="number" />
            <Inp value={form.capacity} onChange={(v:string) => setForm(p=>({...p,capacity:v}))} placeholder="السعة (أشخاص) *" type="number" />
          </div>

          {/* Image picker */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">صورة الطاولة (اختياري)</label>
            <div className="flex items-center gap-3">
              {form.image ? (
                <img src={form.image} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-20 h-20 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-muted-foreground">
                  <ImagePlus size={22} />
                </div>
              )}
              <div className="flex-1 flex flex-col gap-2">
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 bg-card border border-border hover:border-primary/50 rounded-xl px-3 py-2 text-sm text-foreground transition w-fit">
                  <ImagePlus size={15}/> {form.image ? "تغيير الصورة" : "اختيار صورة"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
                </label>
                {form.image && (
                  <button type="button" onClick={() => setForm(p=>({...p,image:""}))} className="text-xs text-red-400 hover:text-red-300 w-fit">
                    إزالة الصورة
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground">حد أقصى 600 كيلوبايت — الصورة اختيارية</p>
                {imgErr && <p className="text-[11px] text-red-400">{imgErr}</p>}
              </div>
            </div>
          </div>

          {/* Hourly pricing tiers */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">⏱️ أسعار التواقيت (اختياري)</label>
                <p className="text-[10px] text-muted-foreground mt-0.5">عدد الساعات والسعر المقابل لها</p>
              </div>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 font-semibold"
              >
                <Plus size={13}/> إضافة سعر
              </button>
            </div>
            {form.hourlyPricing.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">لا توجد أسعار تواقيت — اضغط "إضافة سعر" لبدء التسعير</p>
            )}
            <div className="space-y-2">
              {form.hourlyPricing.map((tier, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Inp value={tier.hours} onChange={(v:string) => updateTier(idx,"hours",v)} placeholder="عدد الساعات (مثال: 1)" type="number" />
                  </div>
                  <span className="text-muted-foreground text-xs">→</span>
                  <div className="flex-1">
                    <Inp value={tier.price} onChange={(v:string) => updateTier(idx,"price",v)} placeholder="السعر (OMR)" type="number" />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTier(idx)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
                    title="حذف"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {formErr && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg py-2 px-3">{formErr}</p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2">
              {editingId ? <><CheckCircle size={16}/>{saving?"جاري الحفظ...":"حفظ التعديلات"}</> : <><Plus size={16}/>{saving?"جاري الإضافة...":"إضافة طاولة"}</>}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-primary/40">
                إلغاء
              </button>
            )}
          </div>
        </form>
      </Card>

      {/* Tables list */}
      {tbls.length === 0 && <Empty icon="🪑" text="لا توجد طاولات مضافة بعد" />}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {tbls.map(t => (
          <Card key={t.id} className={`p-4 flex flex-col items-center gap-2 relative ${editingId === t.id ? "ring-2 ring-primary/40" : ""}`}>
            <div className="absolute top-2 left-2 flex gap-1">
              <button onClick={() => startEdit(t)} title="تعديل" className="p-1 rounded-lg hover:bg-primary/15 text-primary"><Pencil size={13}/></button>
              <button onClick={() => del(t.id)} title="حذف" className="p-1 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={13}/></button>
            </div>
            {t.image ? (
              <img src={t.image} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="text-4xl">🪑</div>
            )}
            <p className="font-bold text-foreground text-lg">طاولة {t.number}</p>
            <p className="text-xs text-muted-foreground">{t.capacity} أشخاص</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${t.available ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
              {t.available ? "متاحة" : "محجوزة"}
            </span>
            {Array.isArray(t.hourlyPricing) && t.hourlyPricing.length > 0 && (
              <div className="w-full mt-1 pt-2 border-t border-border space-y-1">
                {t.hourlyPricing.map((tier: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">⏱️ {tier.hours} ساعة</span>
                    <span className="text-primary font-bold">{tier.price?.toFixed(3)} OMR</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Aggregated invoice helpers (daily / monthly / yearly) ────
function aggregateOrders(orderList: any[], from: Date, to: Date) {
  const inRange = orderList.filter(o => {
    const t = new Date(o.createdAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const byCat: Record<string, { qty: number; amount: number }> = {};
  let total = 0;
  for (const o of inRange) {
    total += Number(o.total) || 0;
    for (const it of (o.items ?? [])) {
      const cat = classifyItem(String(it.name ?? ""), it.category);
      byCat[cat] ??= { qty: 0, amount: 0 };
      byCat[cat].qty += Number(it.qty) || 0;
      byCat[cat].amount += (Number(it.qty) || 0) * (Number(it.price) || 0);
    }
  }
  return { inRange, byCat, total };
}

function aggregateExpenses(expList: any[], from: Date, to: Date) {
  const inRange = expList.filter(e => {
    const t = new Date(e.date).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const total = inRange.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return { inRange, total };
}

async function loadAggData(id: string) {
  const [{ orders }, { expenses }] = await Promise.all([
    api.cafeOrders(id),
    api.expenses(id).catch(() => ({ expenses: [] })),
  ]);
  return { orders: orders ?? [], expenses: expenses ?? [] };
}

function fmtDateAr(d: Date) { return d.toLocaleDateString("ar-OM"); }
function fmtDateTimeAr(d: string) {
  return new Date(d).toLocaleString("ar-OM", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

async function printDailyInvoice(id: string, dateStr: string) {
  const tpl = (await api.invoiceTemplate(id, "daily").catch(() => ({ template: null }))).template;
  const { orders } = await loadAggData(id);
  const from = new Date(dateStr + "T00:00:00");
  const to   = new Date(from); to.setDate(to.getDate() + 1);
  const { inRange, byCat, total } = aggregateOrders(orders, from, to);

  const ordersRows = inRange.map(o =>
    `<tr><td>#${o.id.slice(-5)}</td><td>${o.customerName ?? "-"}</td><td style="font-size:9.5px">${fmtDateTimeAr(o.createdAt)}</td><td style="text-align:left">${(Number(o.total)||0).toFixed(3)}</td></tr>`
  ).join("");
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");

  const body = `
    ${tplHeaderHtml(tpl, "الفاتورة اليومية", `${fmtDateAr(from)}`)}
    <div class="info-block">
      <div><b>عدد الطلبات:</b> ${inRange.length}</div>
    </div>
    <div class="sec-title">جميع الطلبات</div>
    ${inRange.length === 0
      ? `<div class="empty">لا توجد طلبات في هذا اليوم</div>`
      : `<table><thead><tr><th>رقم</th><th>الزبون</th><th>الوقت</th><th>المبلغ</th></tr></thead><tbody>${ordersRows}</tbody></table>`}
    <div class="sec-title">المجموع حسب التصنيف</div>
    ${Object.keys(byCat).length === 0
      ? `<div class="empty">لا يوجد</div>`
      : `<table><thead><tr><th>التصنيف</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>${catRows}</tbody></table>`}
    <div class="total"><span>إجمالي اليوم</span><span>${total.toFixed(3)} ر.ع</span></div>
    ${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة يومية ${dateStr}`, body);
}

async function printMonthlyInvoice(id: string, year: number, month: number) {
  const tpl = (await api.invoiceTemplate(id, "monthly").catch(() => ({ template: null }))).template;
  const { orders, expenses } = await loadAggData(id);
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month,     1);
  const { inRange: ordersIn, byCat, total: ordersTotal } = aggregateOrders(orders, from, to);
  const { total: expTotal } = aggregateExpenses(expenses, from, to);
  const net = ordersTotal - expTotal;
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");
  const monthName = from.toLocaleDateString("ar-OM", { month: "long", year: "numeric" });

  const body = `
    ${tplHeaderHtml(tpl, "الفاتورة الشهرية", `${monthName}`)}
    <div class="info-block">
      <div><b>الفترة:</b> ${fmtDateAr(from)} — ${fmtDateAr(new Date(to.getTime()-1))}</div>
      <div><b>عدد الطلبات:</b> ${ordersIn.length}</div>
    </div>
    <div class="sec-title">المبالغ حسب التصنيف</div>
    ${Object.keys(byCat).length === 0
      ? `<div class="empty">لا يوجد</div>`
      : `<table><thead><tr><th>التصنيف</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>${catRows}</tbody></table>`}
    <div class="row" style="margin-top:10px;font-weight:600"><span>مجموع الإيرادات</span><b>${ordersTotal.toFixed(3)} ر.ع</b></div>
    ${expTotal > 0 ? `<div class="row" style="color:#a40000;font-weight:600"><span>إجمالي المصاريف</span><b>− ${expTotal.toFixed(3)} ر.ع</b></div>` : ""}
    <div class="total"><span>الصافي</span><span>${net.toFixed(3)} ر.ع</span></div>
    ${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة شهرية ${year}-${String(month).padStart(2,"0")}`, body);
}

async function printYearlyInvoice(id: string, year: number) {
  const tpl = (await api.invoiceTemplate(id, "yearly").catch(() => ({ template: null }))).template;
  const { orders, expenses } = await loadAggData(id);
  const from = new Date(year, 0, 1);
  const to   = new Date(year + 1, 0, 1);
  const { inRange: ordersIn, byCat, total: ordersTotal } = aggregateOrders(orders, from, to);
  const { total: expTotal } = aggregateExpenses(expenses, from, to);
  const net = ordersTotal - expTotal;
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");

  const body = `
    ${tplHeaderHtml(tpl, "الفاتورة السنوية", `سنة ${year}`)}
    <div class="info-block">
      <div><b>الفترة:</b> ${fmtDateAr(from)} — ${fmtDateAr(new Date(to.getTime()-1))}</div>
      <div><b>عدد الطلبات:</b> ${ordersIn.length}</div>
    </div>
    <div class="sec-title">المبالغ حسب التصنيف</div>
    ${Object.keys(byCat).length === 0
      ? `<div class="empty">لا يوجد</div>`
      : `<table><thead><tr><th>التصنيف</th><th>الكمية</th><th>المبلغ</th></tr></thead><tbody>${catRows}</tbody></table>`}
    <div class="row" style="margin-top:10px;font-weight:600"><span>مجموع الإيرادات</span><b>${ordersTotal.toFixed(3)} ر.ع</b></div>
    ${expTotal > 0 ? `<div class="row" style="color:#a40000;font-weight:600"><span>إجمالي المصاريف</span><b>− ${expTotal.toFixed(3)} ر.ع</b></div>` : ""}
    <div class="total"><span>الصافي السنوي</span><span>${net.toFixed(3)} ر.ع</span></div>
    ${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة سنوية ${year}`, body);
}

async function printExpenseInvoice(id: string, exp: any) {
  const tpl = (await api.invoiceTemplate(id, "expense").catch(() => ({ template: null }))).template;
  const body = `
    ${tplHeaderHtml(tpl, `فاتورة مصروف #${exp.id?.slice(-5)}`, "")}
    <div class="info-block">
      <div><b>التاريخ:</b> ${exp.date}</div>
      <div><b>التصنيف:</b> ${exp.category}</div>
    </div>
    <div class="sec-title">تفاصيل المصروف</div>
    <table><thead><tr><th>البيان</th><th>التصنيف</th><th>المبلغ</th></tr></thead><tbody>
      <tr><td>${exp.title}</td><td>${exp.category}</td><td style="text-align:left">${(Number(exp.amount)||0).toFixed(3)}</td></tr>
    </tbody></table>
    ${exp.notes ? `<div class="info-block" style="margin-top:8px"><b>ملاحظات:</b> ${exp.notes}</div>` : ""}
    <div class="total"><span>المجموع</span><span>${(Number(exp.amount)||0).toFixed(3)} ر.ع</span></div>
    ${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة مصروف #${exp.id?.slice(-5)}`, body);
}

// ── Invoices Tab (daily / monthly / yearly print) ────────────
function InvoicesTab({ id }: { id: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,  setDate]  = useState<string>(today);
  const [month, setMonth] = useState<string>(today.slice(0, 7));
  const [year,  setYear]  = useState<string>(String(new Date().getFullYear()));
  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => { api.cafeInvoices(id).then(d => setRecent(d.invoices ?? [])).catch(() => {}); }, [id]);

  const cardRow = (icon: any, title: string, desc: string, controls: React.ReactNode) => (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">{icon}</div>
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {controls}
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        {cardRow(<CalendarDays size={18}/>, "فاتورة يومية", "كل طلبات يوم محدد", (
          <div className="flex gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => printDailyInvoice(id, date)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
              <Printer size={14}/> طباعة
            </button>
          </div>
        ))}
        {cardRow(<CalendarRange size={18}/>, "فاتورة شهرية", "ملخص شهر كامل + خصم المصاريف", (
          <div className="flex gap-2">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => {
              const [y, m] = month.split("-").map(Number);
              if (y && m) printMonthlyInvoice(id, y, m);
            }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
              <Printer size={14}/> طباعة
            </button>
          </div>
        ))}
        {cardRow(<BarChart3 size={18}/>, "فاتورة سنوية", "ملخص سنة كاملة + خصم المصاريف", (
          <div className="flex gap-2">
            <input type="number" min={2020} max={2100} value={year} onChange={e => setYear(e.target.value)}
              className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
            <button onClick={() => { const y = Number(year); if (y) printYearlyInvoice(id, y); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
              <Printer size={14}/> طباعة
            </button>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">آخر الفواتير المسجلة</h3>
        {recent.length === 0 && <Empty icon="🧾" text="لا توجد فواتير بعد" />}
        <div className="space-y-3">
          {recent.map(inv => (
            <Card key={inv.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-foreground text-sm">فاتورة #{inv.id.slice(-5)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{inv.customerName} • {fmtDateTimeAr(inv.createdAt)}</p>
                </div>
                <span className="text-base font-bold text-primary">{inv.total?.toFixed(3)} OMR</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Expenses Tab ─────────────────────────────────────────────
const EXPENSE_CATS = ["إيجار", "رواتب", "مواد خام", "صيانة", "كهرباء وماء", "تسويق", "أخرى"];
function ExpensesTab({ id }: { id: string }) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", amount: "", category: EXPENSE_CATS[0], notes: "", date: new Date().toISOString().slice(0,10) });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.expenses(id).then(d => setList(d.expenses ?? [])).catch(() => {}), [id]);
  useEffect(() => { load(); }, [load]);
  const total = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const submit = async () => {
    if (!form.title.trim() || !form.amount || Number(form.amount) <= 0) return;
    setBusy(true);
    try {
      await api.addExpense(id, { ...form, amount: Number(form.amount) });
      setForm({ title:"", amount:"", category: EXPENSE_CATS[0], notes:"", date: new Date().toISOString().slice(0,10) });
      await load();
    } finally { setBusy(false); }
  };
  const remove = async (eid: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المصروف؟")) return;
    await api.deleteExpense(id, eid);
    setList(prev => prev.filter(e => e.id !== eid));
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2"><Plus size={16}/> إضافة مصروف</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Inp value={form.title}  onChange={(v: string) => setForm(f => ({ ...f, title: v }))}  placeholder="البيان (مثال: إيجار شهر مارس)" />
          <Inp value={form.amount} onChange={(v: string) => setForm(f => ({ ...f, amount: v }))} placeholder="المبلغ (OMR)" type="number" />
          <Sel value={form.category} onChange={(v: string) => setForm(f => ({ ...f, category: v }))}
               options={EXPENSE_CATS.map(c => ({ value: c, label: c }))} />
          <Inp value={form.date} onChange={(v: string) => setForm(f => ({ ...f, date: v }))} type="date" />
          <Inp value={form.notes} onChange={(v: string) => setForm(f => ({ ...f, notes: v }))} placeholder="ملاحظات (اختياري)" className="md:col-span-2" />
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={submit} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50">
            <Save size={14}/> {busy ? "جاري الحفظ..." : "حفظ المصروف"}
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">إجمالي المصاريف المسجلة</span>
          <span className="text-xl font-bold text-red-400">{total.toFixed(3)} OMR</span>
        </div>
      </Card>

      {list.length === 0 && <Empty icon="💸" text="لا توجد مصاريف مسجلة" />}
      <div className="space-y-3">
        {list.map(e => (
          <Card key={e.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-semibold text-foreground text-sm">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{e.category} • {e.date}</p>
                {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
              </div>
              <span className="text-base font-bold text-red-400">{Number(e.amount).toFixed(3)} OMR</span>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button onClick={() => printExpenseInvoice(id, e)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:bg-muted/30">
                <Printer size={13}/> طباعة فاتورة
              </button>
              <button onClick={() => remove(e.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">
                <Trash2 size={13}/> حذف
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Templates Tab (تعديل الفواتير) ───────────────────────────
const TEMPLATE_TYPES: { key: "expense" | "order" | "daily" | "monthly" | "yearly"; label: string; icon: any }[] = [
  { key: "expense", label: "فواتير المصاريف", icon: Wallet },
  { key: "order",   label: "فواتير الطلبات",   icon: ShoppingBag },
  { key: "daily",   label: "فواتير يومية",     icon: CalendarDays },
  { key: "monthly", label: "فواتير شهرية",     icon: CalendarRange },
  { key: "yearly",  label: "فواتير سنوية",     icon: BarChart3 },
];

function TemplatesTab({ id }: { id: string }) {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-1">تعديل بيانات الفواتير</h3>
        <p className="text-xs text-muted-foreground mb-4">
          اختر نوع الفاتورة لتعديل البيانات التي تظهر في الترويسة (الشعار، الاسم، السجل التجاري، رقم التواصل، الكلام الترويجي).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TEMPLATE_TYPES.map(t => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button key={t.key}
                onClick={() => setActive(isActive ? null : t.key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all
                  ${isActive
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                <Icon size={22}/>
                <span className="text-xs font-semibold text-center">{t.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {active && <TemplateForm id={id} type={active} key={active} />}
    </div>
  );
}

function TemplateForm({ id, type }: { id: string; type: string }) {
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const fileRef = (typeof window !== "undefined") ? null : null;

  useEffect(() => {
    api.invoiceTemplate(id, type).then(d => setForm(d.template)).catch(() => setForm({
      logo: "", cafeName: "", commercialReg: "", contactPhone: "", promoText: "شكراً لزيارتكم",
    }));
  }, [id, type]);

  if (!form) return <Loader />;

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 700_000) { alert("الصورة كبيرة جداً (الحد الأقصى ~700KB)"); return; }
    const r = new FileReader();
    r.onload = () => setForm((f: any) => ({ ...f, logo: String(r.result) }));
    r.readAsDataURL(file);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.updateInvoiceTemplate(id, type, {
        logo: form.logo, cafeName: form.cafeName, commercialReg: form.commercialReg,
        contactPhone: form.contactPhone, promoText: form.promoText,
      });
      setSavedAt(new Date().toLocaleTimeString("ar-OM"));
    } finally { setBusy(false); }
  };

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Pencil size={16}/> {INVOICE_TYPE_LABEL[type]}
      </h3>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Logo column */}
        <div className="md:col-span-1 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground">شعار الكوفي</p>
          <div className="aspect-square w-full rounded-2xl border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
            {form.logo
              ? <img src={form.logo} className="w-full h-full object-cover" alt=""/>
              : <ImagePlus size={42} className="text-muted-foreground"/>}
          </div>
          <label className="block">
            <span className="sr-only">choose file</span>
            <input type="file" accept="image/*" onChange={e => onLogoFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-muted-foreground file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-semibold file:cursor-pointer" />
          </label>
          {form.logo && (
            <button onClick={() => setForm((f: any) => ({ ...f, logo: "" }))}
              className="text-xs text-red-400 hover:underline">إزالة الشعار</button>
          )}
        </div>

        {/* Fields column */}
        <div className="md:col-span-2 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">اسم الكوفي</label>
            <Inp value={form.cafeName} onChange={(v: string) => setForm((f: any) => ({ ...f, cafeName: v }))} placeholder="مثال: كوفي كوبوينتو" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">السجل التجاري</label>
            <Inp value={form.commercialReg} onChange={(v: string) => setForm((f: any) => ({ ...f, commercialReg: v }))} placeholder="رقم السجل التجاري" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">رقم التواصل</label>
            <Inp value={form.contactPhone} onChange={(v: string) => setForm((f: any) => ({ ...f, contactPhone: v }))} placeholder="مثال: 99999999" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">كلام ترويجي للكوفي</label>
            <textarea value={form.promoText}
              onChange={e => setForm((f: any) => ({ ...f, promoText: e.target.value }))}
              placeholder="مثال: شكراً لزيارتكم — نتطلع لرؤيتكم مجدداً"
              rows={3}
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground">
          {savedAt ? `✅ تم الحفظ في ${savedAt}` : "غير محفوظ بعد"}
        </span>
        <button onClick={save} disabled={busy}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50">
          <Save size={14}/> {busy ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </Card>
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
        {tab === "invoices"  && <InvoicesTab  id={id} />}
        {tab === "expenses"  && <ExpensesTab  id={id} />}
        {tab === "templates" && <TemplatesTab id={id} />}
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
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api.discountCodes(id).then(d => setCodes(d.codes ?? [])).catch(() => setCodes([]));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setErr("");
    const trimmed = code.trim();
    if (!/^\d+$/.test(trimmed)) { setErr("الكود يجب أن يكون أرقام فقط"); return; }
    setLoading(true);
    try {
      // expiresAt input is YYYY-MM-DD; treat as end-of-day local. Optional.
      const expiry = expiresAt ? new Date(expiresAt + "T23:59:59").toISOString() : null;
      await api.addDiscountCode(id, { code: trimmed, percent, expiresAt: expiry });
      setCode("");
      setPercent(10);
      setExpiresAt("");
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
      {/* List (top) */}
      <div className="space-y-3">
        {codes.length === 0 && <Empty icon="🏷️" text="لا توجد أكواد تخفيض حتى الآن" />}
        {codes.map(c => {
          const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
          const expiryLabel = c.expiresAt
            ? `ينتهي: ${new Date(c.expiresAt).toLocaleDateString("ar-OM")}`
            : "ساري دائماً";
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
                    {expiryLabel} • مرات الاستخدام: {c.usedCount}
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

      {/* Create card (bottom) */}
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">ينتهي في (اختياري)</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={expiresAt}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setExpiresAt(e.target.value)}
                className="flex-1 bg-input border border-border rounded-xl px-3 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {expiresAt && (
                <button
                  type="button"
                  onClick={() => setExpiresAt("")}
                  className="px-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 text-xs"
                  title="إزالة التاريخ"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">اتركه فارغاً ليبقى الكود ساري دائماً</p>
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

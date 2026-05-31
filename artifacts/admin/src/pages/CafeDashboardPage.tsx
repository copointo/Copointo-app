import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import {
  ArrowLeft, ArrowRight, LayoutDashboard, ShoppingBag, CalendarDays, UtensilsCrossed,
  MessageCircle, Armchair, Receipt, Plus, Trash2, CheckCircle, Clock, ChevronDown, ChevronUp,
  Lock, ShieldCheck, X, TrendingUp, Eye, Users, Crown, Trophy, Coffee, Car,
  CalendarRange, BarChart3, Tag, Percent, Pencil, ImagePlus,
  Wallet, FileText, Printer, Save, Package, Minus, AlertTriangle, XCircle,
  GlassWater, Cookie, Gift, Video, Heart, MessageSquare, Upload, MapPin, Link2,
  QrCode, Copy, Download, Share2, Search, Banknote, CreditCard, Phone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { Link } from "wouter";
import copointoLogoUrl from "@/assets/copointo-logo.png";

type Tab = "stats" | "orders" | "direct" | "bookings" | "menu" | "chat" | "tables" | "invoices" | "expenses" | "inventory" | "templates" | "reels" | "barcode" | "vouchers";

// ── Bell sound (Web Audio API — repeats for ~3s) ─────────────
function playSyntheticBell() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const start = ctx.currentTime;
    // 6 short bell-like tones over 3 seconds (every 0.5s).
    for (let i = 0; i < 6; i++) {
      const t = start + i * 0.5;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.35);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    }
    setTimeout(() => { ctx.close().catch(() => {}); }, 3500);
  } catch { /* ignore — sound is best-effort */ }
}

// ── New-order sound (Web Audio API, zero-latency) ──────────────────
// We pre-fetch the MP3, decode it once into an AudioBuffer, and then play
// each chime via a fresh AudioBufferSourceNode. This bypasses all the
// latency sources that plague HTMLAudioElement.play():
//   • no buffering delay on each play
//   • no codec re-init
//   • no currentTime=0 seek
//   • leading silence in the source MP3 is trimmed via `start(when, offset)`
// The result: chime begins on the very next audio frame after detection.
//
// IMPORTANT (browser autoplay policy): Chrome/Safari put the AudioContext
// in a "suspended" state until the user interacts with the page. We install
// a one-time global gesture listener that resumes it. After that first
// click anywhere on the dashboard, every poll-detected order rings instantly.
const ORDER_SOUND_LEADING_SILENCE_SEC = 0.16; // measured with ffmpeg silencedetect
let _audioCtx: AudioContext | null = null;
let _orderBuffer: AudioBuffer | null = null;
let _orderBufferLoading = false;
let _orderHtmlFallback: HTMLAudioElement | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  } catch { return null; }
}

function loadOrderBuffer() {
  if (_orderBuffer || _orderBufferLoading) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  _orderBufferLoading = true;
  // BASE_URL already ends with "/" (e.g. "/admin/"). Asset:
  // artifacts/admin/public/sounds/new-order.mp3
  const url = `${import.meta.env.BASE_URL}sounds/new-order.mp3`;
  fetch(url)
    .then((r) => r.arrayBuffer())
    .then((buf) => new Promise<AudioBuffer>((res, rej) => {
      // decodeAudioData callback form for Safari compatibility.
      try {
        const p = ctx.decodeAudioData(buf, res, rej);
        if (p && typeof (p as any).then === "function") (p as Promise<AudioBuffer>).then(res, rej);
      } catch (e) { rej(e); }
    }))
    .then((decoded) => { _orderBuffer = decoded; })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[order-sound] decode failed, falling back to <audio>:", err);
      try {
        _orderHtmlFallback = new Audio(url);
        _orderHtmlFallback.preload = "auto";
        _orderHtmlFallback.load();
      } catch { /* ignore */ }
    })
    .finally(() => { _orderBufferLoading = false; });
}

/** Install once: on the very first user gesture anywhere on the page,
 *  resume the AudioContext (Chrome/Safari autoplay block) and warm up
 *  the buffer cache. After this, ringing is instant. */
function installAudioUnlock() {
  if (typeof window === "undefined") return;
  if ((window as any).__copointoAudioUnlockInstalled) return;
  (window as any).__copointoAudioUnlockInstalled = true;
  // Kick off the MP3 fetch immediately — doesn't need a gesture.
  loadOrderBuffer();
  const unlock = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {/* ignore */});
    }
    // Also try to "tickle" the HTML fallback in case decode failed.
    if (_orderHtmlFallback) {
      try {
        _orderHtmlFallback.muted = true;
        const p = _orderHtmlFallback.play();
        const reset = () => { try { _orderHtmlFallback!.pause(); _orderHtmlFallback!.currentTime = 0; _orderHtmlFallback!.muted = false; } catch {/*ignore*/} };
        if (p && typeof p.then === "function") p.then(reset).catch(reset);
        else reset();
      } catch { /* ignore */ }
    }
  };
  const opts: AddEventListenerOptions = { once: true, capture: true };
  window.addEventListener("pointerdown", unlock, opts);
  window.addEventListener("keydown",     unlock, opts);
  window.addEventListener("touchstart",  unlock, opts);
  window.addEventListener("click",       unlock, opts);
}

function playOrderSound(times: number = 1) {
  const ctx = getAudioCtx();
  // Try Web Audio first — zero-latency path.
  if (ctx && _orderBuffer) {
    if (ctx.state === "suspended") {
      // Best-effort resume; if it fails the catch below covers the fallback.
      ctx.resume().catch(() => {/* ignore */});
    }
    const ringOnce = (when: number) => {
      try {
        const src = ctx.createBufferSource();
        src.buffer = _orderBuffer!;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        src.connect(gain).connect(ctx.destination);
        // start(when, offset) skips the leading silence in the source MP3.
        src.start(when, ORDER_SOUND_LEADING_SILENCE_SEC);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[order-sound] webaudio start failed:", err);
      }
    };
    const t0 = ctx.currentTime;
    const count = Math.min(Math.max(times, 1), 4);
    for (let i = 0; i < count; i++) {
      // 1.2s spacing between consecutive chimes for bursts.
      ringOnce(t0 + i * 1.2);
    }
    return;
  }
  // Buffer not ready yet (first poll after refresh) — kick off load and
  // use the HTML <audio> fallback (or synthetic bell) so we still ring NOW.
  if (!_orderBuffer && !_orderBufferLoading) loadOrderBuffer();
  if (_orderHtmlFallback) {
    try {
      _orderHtmlFallback.currentTime = ORDER_SOUND_LEADING_SILENCE_SEC;
      const p = _orderHtmlFallback.play();
      if (p && typeof p.then === "function") p.catch(() => playSyntheticBell());
    } catch { playSyntheticBell(); }
    return;
  }
  playSyntheticBell();
}

/** Generic notification bell — used for bookings / reels. Orders use the
 *  dedicated MP3 chime via playOrderSound() below. */
function playNotificationBell() {
  playSyntheticBell();
}

// ── Tab notifications hook ───────────────────────────────────
// Polls orders + bookings every 5s. Whenever new IDs appear, increments the
// badge for that tab and plays the bell. Marks them seen when the user opens
// the tab. Persists seen-IDs in localStorage so badges don't re-trigger after
// a refresh.
function useTabNotifications(cafeId: string, activeTab: Tab) {
  const [counts, setCounts] = useState<Record<string, number>>({ orders: 0, bookings: 0, reels: 0 });
  const seenRef = useRef<Record<string, Set<string>>>({ orders: new Set(), bookings: new Set(), reels: new Set() });
  const initedRef = useRef<Record<string, boolean>>({ orders: false, bookings: false, reels: false });

  // Install the audio-unlock listener as soon as the dashboard mounts so
  // the first user gesture (any click anywhere) primes the order chime
  // and bypasses the browser's autoplay block.
  useEffect(() => { installAudioUnlock(); }, []);

  // Hydrate seen IDs from localStorage on mount / cafe change.
  useEffect(() => {
    const load = (k: string): Set<string> => {
      try {
        const raw = localStorage.getItem(`notif_seen:${cafeId}:${k}`);
        return new Set(raw ? JSON.parse(raw) : []);
      } catch { return new Set(); }
    };
    seenRef.current = { orders: load("orders"), bookings: load("bookings"), reels: load("reels") };
    initedRef.current = { orders: false, bookings: false, reels: false };
    setCounts({ orders: 0, bookings: 0, reels: 0 });
  }, [cafeId]);

  const persist = (k: string) => {
    try {
      localStorage.setItem(
        `notif_seen:${cafeId}:${k}`,
        JSON.stringify(Array.from(seenRef.current[k] ?? new Set())),
      );
    } catch { /* ignore */ }
  };

  // Poll loop.
  useEffect(() => {
    if (!cafeId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [oRes, bRes, rRes] = await Promise.all([
          api.cafeOrders(cafeId).catch(() => ({ orders: [] })),
          api.cafeBookings(cafeId).catch(() => ({ bookings: [] })),
          api.reelsNotifications(cafeId, "").catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        // Reel notif IDs: synthesize stable id per like/comment.
        const reelEventIds = (rRes.items ?? []).map((it: any) =>
          it.kind === "like"
            ? `like:${it.reelId}:${it.userName}:${it.at}`
            : `cmt:${it.commentId}`,
        );
        const buckets: Record<string, any[]> = {
          orders:   oRes.orders   ?? [],
          bookings: bRes.bookings ?? [],
          reels:    reelEventIds.map((id: string) => ({ id })),
        };
        // Compute per-tab new-counts without depending on the stale `counts`
        // closure — apply via functional update at the end.
        const additions: Record<string, number> = {};
        let newCount = 0;
        for (const k of ["orders", "bookings", "reels"] as const) {
          const seen = seenRef.current[k];
          const ids: string[] = buckets[k].map((x: any) => String(x.id));
          if (!initedRef.current[k]) {
            ids.forEach((id) => seen.add(id));
            initedRef.current[k] = true;
            persist(k);
            continue;
          }
          let added = 0;
          let addedWhileViewing = 0;
          for (const id of ids) {
            if (!seen.has(id)) {
              seen.add(id);
              if (activeTab === k) {
                // User is already inside this tab — don't bump the badge,
                // but still count it so we can play the chime (orders only).
                addedWhileViewing += 1;
              } else {
                added += 1;
              }
            }
          }
          if (added > 0) {
            additions[k] = added;
            newCount += added;
            persist(k);
          } else if (addedWhileViewing > 0) {
            persist(k);
          }
          // For ORDERS specifically: even when the cashier is already on
          // the "طلبات القهوة" tab, we still want the chime to fire so they
          // notice the new order without having to stare at the screen.
          // Bookings/reels keep the silent behaviour (no chime when viewing).
          if (k === "orders" && addedWhileViewing > 0) {
            additions["__ordersSoundOnly"] =
              (additions["__ordersSoundOnly"] ?? 0) + addedWhileViewing;
          }
        }
        // Sound-only path: cashier is on the orders tab and a new order
        // arrived. Play the order chime without touching the badge counts.
        const soundOnlyOrders = additions["__ordersSoundOnly"] ?? 0;
        if (newCount > 0) {
          // Fire the sound FIRST — synchronously, before any React state
          // update — so the cashier hears the chime the exact instant the
          // order is detected (no render-batching delay).
          const newOrders = (additions["orders"] ?? 0) + soundOnlyOrders;
          if (newOrders > 0) {
            playOrderSound(newOrders);
          } else {
            playNotificationBell();
          }
          setCounts((prev) => {
            const out = { ...prev };
            for (const k of Object.keys(additions)) {
              if (k.startsWith("__")) continue;
              out[k] = (out[k] ?? 0) + additions[k]!;
            }
            return out;
          });
        } else if (soundOnlyOrders > 0) {
          playOrderSound(soundOnlyOrders);
        }
      } catch { /* ignore */ }
    };
    tick();
    // Poll every 1.5s so new orders feel instantaneous (max ~1.5s lag
    // between an order being placed and the chime + badge appearing).
    // The endpoints are tiny and respond with HTTP 304 when nothing
    // changed, so this is cheap.
    const id = setInterval(tick, 1500);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeId, activeTab]);

  // When the user opens a tab, mark all current items as seen + clear badge.
  const markSeen = (k: string) => {
    if (counts[k]) setCounts((p) => ({ ...p, [k]: 0 }));
    api.cafeOrders(cafeId).catch(() => null).then((d) => {
      if (k !== "orders" || !d) return;
      d.orders?.forEach((o: any) => seenRef.current.orders.add(String(o.id)));
      persist("orders");
    });
    api.cafeBookings(cafeId).catch(() => null).then((d) => {
      if (k !== "bookings" || !d) return;
      d.bookings?.forEach((b: any) => seenRef.current.bookings.add(String(b.id)));
      persist("bookings");
    });
    api.reelsNotifications(cafeId, "").catch(() => null).then((d) => {
      if (k !== "reels" || !d) return;
      (d.items ?? []).forEach((it: any) => {
        const id = it.kind === "like"
          ? `like:${it.reelId}:${it.userName}:${it.at}`
          : `cmt:${it.commentId}`;
        seenRef.current.reels.add(id);
      });
      persist("reels");
    });
  };

  return { counts, markSeen };
}

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id:"stats",     label:"الإحصائيات",       icon: LayoutDashboard  },
  { id:"orders",    label:"طلبات القهوة",      icon: ShoppingBag      },
  { id:"direct",    label:"اطلب مباشر",        icon: Plus             },
  { id:"bookings",  label:"حجوزات الطاولة",    icon: CalendarDays     },
  { id:"menu",      label:"القائمة",           icon: UtensilsCrossed  },
  { id:"chat",      label:"معلومات الشات",     icon: MessageCircle    },
  { id:"tables",    label:"إدارة حجوزات الطاولات", icon: Armchair       },
  { id:"invoices",  label:"الفواتير",          icon: Receipt          },
  { id:"expenses",  label:"المصاريف",          icon: Wallet           },
  { id:"inventory", label:"المخزن",            icon: Package          },
  { id:"templates", label:"تعديل الفواتير",    icon: FileText         },
  { id:"reels",     label:"Copointo ريلز",     icon: Video            },
  { id:"barcode",   label:"الباركود",          icon: QrCode           },
  { id:"vouchers",  label:"القسائم الشرائية",  icon: Gift             },
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

// Full-card colour theme for a coffee order, driven by its lifecycle stage:
//   • not received yet (pending)          → RED
//   • received / being prepared           → ORANGE
//   • ready/done but not paid yet         → BLUE
//   • paid (any payment method set)       → GREEN
// Paid always wins, so a finished+paid order reads green regardless of stage.
type OrderTheme = {
  ring: string; bg: string; glow: string; bar: string;
  pill: string; dot: string; label: string;
};
function orderTheme(o: any): OrderTheme {
  if (o?.paymentMethod) return {
    ring: "border-emerald-500/55",
    bg: "bg-gradient-to-bl from-emerald-500/12 via-emerald-500/[0.03] to-transparent",
    glow: "shadow-lg shadow-emerald-500/10",
    bar: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    pill: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/45",
    dot: "bg-emerald-400",
    label: "تم الدفع",
  };
  if (o?.status === "pending") return {
    ring: "border-red-500/55",
    bg: "bg-gradient-to-bl from-red-500/12 via-red-500/[0.03] to-transparent",
    glow: "shadow-lg shadow-red-500/10",
    bar: "bg-gradient-to-b from-red-400 to-red-600",
    pill: "bg-red-500/20 text-red-300 border border-red-500/45",
    dot: "bg-red-400",
    label: "غير مستلم",
  };
  if (o?.status === "preparing") return {
    ring: "border-orange-500/55",
    bg: "bg-gradient-to-bl from-orange-500/12 via-orange-500/[0.03] to-transparent",
    glow: "shadow-lg shadow-orange-500/10",
    bar: "bg-gradient-to-b from-orange-400 to-orange-600",
    pill: "bg-orange-500/20 text-orange-300 border border-orange-500/45",
    dot: "bg-orange-400",
    label: "تم الاستلام",
  };
  // ready / done but no payment recorded yet
  return {
    ring: "border-blue-500/55",
    bg: "bg-gradient-to-bl from-blue-500/12 via-blue-500/[0.03] to-transparent",
    glow: "shadow-lg shadow-blue-500/10",
    bar: "bg-gradient-to-b from-blue-400 to-blue-600",
    pill: "bg-blue-500/20 text-blue-300 border border-blue-500/45",
    dot: "bg-blue-400",
    label: "لم يُدفع بعد",
  };
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-gradient-to-b from-card to-[#0a0606] border border-[#E8B86D]/15 rounded-2xl shadow-lg shadow-black/40 ${className}`}>{children}</div>;
}
function StatBox({ label, value, Icon }: { label:string; value:any; Icon: any }) {
  return (
    <Card className="group p-5 flex items-start gap-4 transition-all duration-200 hover:border-[#E8B86D]/40 hover:shadow-[#E8B86D]/10">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-gradient-to-br from-primary/25 to-primary/5 border border-primary/40 shadow-inner shadow-primary/10 transition-transform duration-200 group-hover:scale-105">
        <Icon size={21} className="text-primary" strokeWidth={1.9} />
      </div>
      <div><p className="text-muted-foreground text-sm">{label}</p><p className="text-2xl font-extrabold text-foreground mt-0.5 tracking-tight">{value}</p></div>
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
        <StatBox label="إجمالي الطلبات"   value={data.totalOrders}   Icon={ShoppingBag} />
        <StatBox label="الحجوزات"          value={data.totalBookings} Icon={CalendarDays} />
        <StatBox label="عناصر القائمة"    value={data.totalMenuItems} Icon={UtensilsCrossed} />
        <StatBox label="إجمالي مبيعات اليوم" value={`${(() => {
          // Today's revenue only — derived from chartData (server already
          // groups orders by YYYY-MM-DD day). Falls back to 0 if today has
          // no orders yet so the box reads "0.000 OMR" instead of blank.
          const today = new Date().toISOString().substring(0, 10);
          const row = (data.chartData || []).find((d: any) => d.date === today);
          return (Number(row?.revenue) || 0).toFixed(3);
        })()} OMR`} Icon={Wallet} />
        <StatBox label="إجمالي المبيعات كاش" value={`${(data.salesCash ?? 0).toFixed(3)} OMR`} Icon={Wallet} />
        <StatBox label="إجمالي المبيعات فيزا" value={`${(data.salesVisa ?? 0).toFixed(3)} OMR`} Icon={CreditCard} />
        <StatBox label="طلبات بانتظار"    value={data.pendingOrders}  Icon={Clock} />
        <StatBox label="حجوزات مؤكدة"    value={data.confirmedBookings} Icon={CheckCircle} />
        <StatBox label="القسائم الشرائية"        value={data.totalVouchers ?? 0} Icon={Gift} />
        <StatBox label="قسائم بانتظار"           value={data.pendingVouchers ?? 0} Icon={Clock} />
        <StatBox label="منها قسائم (مُحتسبة بالإيرادات)" value={`${(data.voucherRevenue ?? 0).toFixed(3)} OMR`} Icon={Gift} />
      </div>

      {data.chartData?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">📈 الإيرادات اليومية</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3044" />
              <XAxis dataKey="date" tick={{ fill:"#888", fontSize:11 }} />
              <YAxis tick={{ fill:"#888", fontSize:11 }} />
              <Tooltip contentStyle={{ background:"#1a1f2e", border:"1px solid #2a3044", borderRadius:8 }} labelStyle={{ color:"#ccc" }} />
              <Line type="monotone" dataKey="revenue" stroke="#C67C4E" strokeWidth={2.5} dot={{ r: 3, fill: "#C67C4E" }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {topItems.length > 0 && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">🏆 أكثر العناصر طلباً</h3>
          <ResponsiveContainer width="100%" height={Math.max(220, [...topItems].sort((a, b) => Number(b.qty) - Number(a.qty)).slice(0, 8).length * 44)}>
            <BarChart
              data={[...topItems].sort((a, b) => Number(b.qty) - Number(a.qty)).slice(0, 8)}
              layout="vertical"
              margin={{ top: 8, right: 36, bottom: 8, left: 12 }}
              barCategoryGap="28%"
            >
              <defs>
                <linearGradient id="topItemsBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#C99654" />
                  <stop offset="100%" stopColor="#E8B86D" />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#2a3044" />
              <XAxis type="number" tick={{ fill:"#888", fontSize:11 }} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fill:"#ccc", fontSize:12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill:"rgba(232,184,109,0.08)" }}
                contentStyle={{ background:"#1a1f2e", border:"1px solid #2a3044", borderRadius:8 }}
                labelStyle={{ color:"#E8B86D" }}
                formatter={(v: any) => [`${v} طلب`, "الكمية"]}
              />
              <Bar dataKey="qty" fill="url(#topItemsBar)" radius={[0, 6, 6, 0]} maxBarSize={26}>
                <LabelList dataKey="qty" position="right" fill="#E8B86D" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
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
    ? `<img src="${tpl.logo}" style="display:inline-block;width:38mm;height:auto;max-width:38mm;max-height:40mm;object-fit:contain;filter:brightness(0) saturate(100%);-webkit-filter:brightness(0) saturate(100%);vertical-align:top" alt="">`
    : `<div style="display:inline-block;width:38mm;height:38mm;font-size:96px;line-height:38mm;text-align:center;color:#000;vertical-align:top">☕</div>`;
  return `
<tr><td class="cell" style="text-align:center;padding:2mm 0 1mm 0 !important;width:58mm;direction:ltr">
  <div style="display:block;width:100%;text-align:center;direction:ltr;padding-right:3mm">${logoHtml}</div>
</td></tr>
<tr><td class="cell" style="text-align:center;font-size:17px;font-weight:bold;padding:2mm 0 0">
  ${tpl?.cafeName ?? ""}
</td></tr>
${tpl?.commercialReg ? `<tr><td class="cell" style="text-align:center;font-size:11px;padding:1mm 0 0">س.ت / CR • ${tpl.commercialReg}</td></tr>` : ""}
${tpl?.contactPhone  ? `<tr><td class="cell" style="text-align:center;font-size:11px;padding:0">${tpl.contactPhone}</td></tr>` : ""}
<tr><td class="cell" style="text-align:center;font-size:11px;padding:2mm 0;letter-spacing:1px">— — — — ✦ — — — —</td></tr>
<tr><td class="cell" style="text-align:center;font-size:15px;font-weight:bold;padding:1mm 0">${title}</td></tr>
${subtitle ? `<tr><td class="cell" style="text-align:center;font-size:12px;padding:0 0 1mm">${subtitle}</td></tr>` : ""}
<tr><td class="cell" style="text-align:center;font-size:11px;padding:1mm 0 2mm;letter-spacing:1px">— — — — ✦ — — — —</td></tr>
  `;
}

function tplFooterHtml(tpl: any): string {
  const rawPromo = (tpl?.promoText ?? "شكراً لزيارتكم / Thank you for visiting");
  const promo = rawPromo.replace(/\n/g, "<br>");
  const stamp = new Date().toLocaleString("ar-OM", {
    year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit",
  });
  return `
<tr><td class="cell" style="text-align:center;font-size:11px;padding:2mm 0 1mm;letter-spacing:1px">— — — — ✦ — — — —</td></tr>
<tr><td class="cell" style="text-align:center;font-size:12px;font-style:italic;padding:1mm 0;line-height:1.5">${promo}</td></tr>
<tr><td class="cell" style="text-align:center;font-size:10px;padding:1mm 0 0">طُبعت في / Printed: ${stamp}</td></tr>
<tr><td class="cell" style="text-align:center;font-size:11px;padding:2mm 0 1mm;letter-spacing:1px">✂ — — — — — — — — — — ✂</td></tr>
  `;
}

function openPrintWindow(title: string, body: string) {
  const w = window.open("", "_blank", "width=360,height=760");
  if (!w) {
    alert("الرجاء السماح بفتح النوافذ المنبثقة لعرض الفاتورة");
    return;
  }
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    /* ── MHT-POS58 thermal printer: 58mm wide paper, auto height = exact content size ── */
    @page { size: 58mm auto; margin: 0; }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    html, body {
      background: #fff;
      color: #000;
      font-family: 'Tahoma','Arial','Segoe UI',sans-serif;
      font-size: 13px;
      line-height: 1.5;
      visibility: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body.ready { visibility: visible; }

    /* ── Receipt is a TABLE: rows render top→bottom, period. ── */
    table.receipt {
      width: 58mm;
      max-width: 58mm;
      margin: 0 auto;          /* horizontal centering on any page */
      border-collapse: collapse;
      border-spacing: 0;
      table-layout: fixed;
      direction: rtl;
      background: #fff;
      color: #000;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    table.receipt > tbody > tr > td.cell {
      width: 100%;
      padding: 0 1.5mm;
      vertical-align: top;
      color: #000;
      background: #fff;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ── Section cells ── */
    .info-cell {
      font-size: 12px;
      line-height: 1.7;
      text-align: right;
      padding: 2mm 1.5mm !important;
    }
    .info-cell > div { margin: 0.3mm 0; text-align: right; }
    .info-cell b { font-weight: bold; }

    .sec-title-cell {
      font-size: 13px;
      font-weight: bold;
      text-align: center;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 1.5mm 1.5mm !important;
      margin: 0;
    }

    .items-cell {
      padding: 1mm 1mm !important;
    }

    /* ── Inner items table (full receipt width) ── */
    table.items {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
    }
    table.items thead th {
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding: 2px 1px;
      text-align: center;
      font-size: 11px;
      color: #000;
    }
    table.items tbody td {
      padding: 2px 1px;
      vertical-align: top;
      font-size: 11px;
      color: #000;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    table.items tbody tr {
      border-bottom: 1px dashed #888;
    }
    table.items tbody tr:last-child { border-bottom: none; }

    .empty-inner {
      text-align: center;
      font-size: 11px;
      padding: 3mm 0;
      font-style: italic;
    }

    /* ── Row cell: label + value (sub-table for guaranteed two-column) ── */
    .row-cell {
      font-size: 12px;
      font-weight: 600;
      padding: 1mm 1.5mm !important;
    }
    .row-cell .lbl, .row-cell .val {
      display: inline-block;
      width: 49%;
      vertical-align: middle;
    }
    .row-cell .lbl { text-align: right; }
    .row-cell .val { text-align: left; }

    /* ── Total cell ── */
    .total-cell {
      font-size: 14px;
      font-weight: bold;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 2.5mm 1.5mm !important;
    }
    .total-cell .lbl, .total-cell .val {
      display: inline-block;
      width: 49%;
      vertical-align: middle;
    }
    .total-cell .lbl { text-align: right; }
    .total-cell .val { text-align: left; font-size: 15px; }

    @media print {
      body { visibility: visible !important; }
      table.receipt { width: 58mm !important; }
    }
  </style></head><body>
    <table class="receipt"><tbody>${body}</tbody></table>
    <script>
      (function() {
        var printed = false;
        function doPrint() {
          if (printed) return;
          printed = true;
          document.body.classList.add('ready');
          try { window.focus(); } catch(e) {}
          setTimeout(function() {
            try { window.print(); } catch(e) {}
          }, 100);
        }
        function whenReady() {
          var fontsP = (document.fonts && document.fonts.ready)
                        ? document.fonts.ready : Promise.resolve();
          var imgs   = Array.prototype.slice.call(document.images || []);
          var imgsP  = imgs.map(function(img) {
            if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
            return new Promise(function(resolve) {
              var done = false;
              function fin() { if (!done) { done = true; resolve(); } }
              img.addEventListener('load',  fin, { once: true });
              img.addEventListener('error', fin, { once: true });
              setTimeout(fin, 4000);
            });
          });
          Promise.all([fontsP].concat(imgsP)).then(function() {
            requestAnimationFrame(function() {
              requestAnimationFrame(function() {
                setTimeout(doPrint, 800);
              });
            });
          });
        }
        if (document.readyState === 'complete') whenReady();
        else window.addEventListener('load', whenReady);
      })();
    </script>
  </body></html>`);
  w.document.close();
}

// ── Free-coffee redemption modal (used inside OrdersTab) ──────
function FreeCoffeeModal({
  cafeId, order, onClose, onPrinted,
}: {
  cafeId: string;
  order: any;
  onClose: () => void;
  onPrinted: (order: any) => void;
}) {
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState<null | {
    code: string; userName?: string; earnedAtLevel?: number;
  }>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pickedIdx, setPickedIdx] = useState<number>(-1);
  const [printing, setPrinting] = useState(false);

  // Drinks only (exclude طعام + حلى). Each row = one cup.
  const drinkRows: { idx: number; name: string; price: number }[] = [];
  (order.items ?? []).forEach((it: any, i: number) => {
    const cat = String(it.category ?? "");
    if (cat === "طعام" || cat === "حلى") return;
    for (let k = 0; k < (it.qty ?? 1); k++) {
      drinkRows.push({ idx: drinkRows.length, name: it.name, price: Number(it.price) || 0 });
    }
  });

  const validate = async () => {
    setErr(null);
    const c = code.trim().toUpperCase();
    if (!c) { setErr("أدخل الكود"); return; }
    setValidating(true);
    try {
      const res = await api.validateFreeCoffee(cafeId, c);
      setValidated({ code: res.code, userName: res.userName, earnedAtLevel: res.earnedAtLevel });
    } catch (e: any) {
      let msg = "الكود غير صالح";
      try { msg = JSON.parse(e?.message ?? "{}").error ?? msg; } catch {}
      setErr(msg);
    } finally { setValidating(false); }
  };

  const printAndRedeem = async () => {
    if (!validated || pickedIdx < 0) return;
    const drink = drinkRows[pickedIdx];
    if (!drink) return;
    setPrinting(true);
    try {
      // Redeem on server (marks code used + tags order with freeCoffeeCode/Level).
      await api.redeemFreeCoffee(cafeId, validated.code, order.id);
      // Also mark order done (idempotent — same as regular print flow).
      api.cafeOrderPrint(cafeId, order.id).catch(() => {});
      const updated = {
        ...order,
        status: "done",
        pointsAwarded: true,
        freeCoffeeCode: validated.code,
        freeCoffeeLevel: validated.earnedAtLevel,
      };
      onPrinted(updated);
      await printOrderInvoice(cafeId, order, {
        code: validated.code,
        itemName: drink.name,
        itemPrice: drink.price,
      });
      onClose();
    } catch (e: any) {
      let msg = "تعذّر استرداد الكود";
      try { msg = JSON.parse(e?.message ?? "{}").error ?? msg; } catch {}
      setErr(msg);
    } finally { setPrinting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <Gift size={18}/> كوفي مجاني
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
        </div>

        {!validated && (
          <>
            <p className="text-xs text-muted-foreground">أدخل كود الكوفي المجاني الذي يحمله الزبون.</p>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="مثال: A1B2C3"
              className="w-full px-3 py-2.5 rounded-lg bg-muted/30 border border-border text-foreground tracking-widest text-center font-mono"
              maxLength={12}
            />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              disabled={validating || !code.trim()}
              onClick={validate}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {validating ? "جارٍ التحقق…" : "تحقّق من الكود"}
            </button>
          </>
        )}

        {validated && (
          <>
            <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold">
                <CheckCircle size={14}/> الكود صالح: <span className="font-mono">{validated.code}</span>
              </div>
              {validated.userName && (
                <div className="text-muted-foreground">المستخدم: {validated.userName}</div>
              )}
              {validated.earnedAtLevel != null && (
                <div className="text-muted-foreground">مكتسب عند المستوى {validated.earnedAtLevel}</div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">اختر المشروب الذي سيُحتسب مجاناً:</p>
              {drinkRows.length === 0 ? (
                <div className="text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg p-3">
                  لا توجد مشروبات في هذا الطلب — لا يمكن تطبيق كوفي مجاني على الطعام أو الحلى.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {drinkRows.map((d) => (
                    <button
                      key={d.idx}
                      onClick={() => setPickedIdx(d.idx)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        pickedIdx === d.idx
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted/20 text-foreground hover:bg-muted/30"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Coffee size={14}/> {d.name}
                      </span>
                      <span className="text-xs">− {d.price.toFixed(3)} OMR</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {err && <p className="text-xs text-red-400">{err}</p>}
            <button
              disabled={printing || pickedIdx < 0 || drinkRows.length === 0}
              onClick={printAndRedeem}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              <Printer size={14}/> {printing ? "جارٍ الطباعة…" : "طباعة الفاتورة"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Direct (in-cafe) Order Tab ───────────────────────────────
// Lets the cafe staff place a walk-in order on behalf of a customer.
// Only the customer's name is captured — no phone, no game progress.
// The created order flows through the normal pending → preparing → ready → done
// pipeline and shows up in the regular "طلبات القهوة" tab marked as "مباشر".
function DirectOrderTab({ id, onCreated }: { id: string; onCreated: () => void }) {
  const [items, setItems]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  // Quick-find search box: matches against the menu item name and (as a
  // fallback) the description, case-insensitively. When the box is empty
  // the full menu is shown. Categories with zero matches are hidden
  // automatically because the grouping below filters by `visibleItems`.
  const [search, setSearch]         = useState("");
  const [customerName, setCustomerName] = useState("");
  // Optional Copointo-Hub phone lookup. When the cashier types a phone, we
  // probe the server and (if matched) lock the player so loyalty points are
  // awarded on this direct order.
  const [customerPhone, setCustomerPhone] = useState("");
  const [matchedUser, setMatchedUser] = useState<null | { id: string; username: string; phone: string; level: number; totalOrders: number }>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupTried, setLookupTried] = useState(false);
  const [cart, setCart]             = useState<Record<string, number>>({});
  const [notes, setNotes]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]               = useState("");
  // Discount code (optional) — validated against the server's registered codes
  // before submit so the cashier sees the % immediately and the totals update
  // live. Mirrors the same validate endpoint used on the mobile cart.
  const [discountInput, setDiscountInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<null | { code: string; percent: number }>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discountErr, setDiscountErr] = useState("");
  // Free toggle ("على حساب الكوفي") — the order is created normally then
  // immediately marked paymentMethod="free" so cash/visa totals stay at 0
  // for accounting while the order itself still goes through the pipeline.
  const [freeOrder, setFreeOrder] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.cafeMenu(id)
      .then(d => setItems((d.menu ?? d.items ?? []).filter((m: any) => m.available !== false)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [id]);

  const inc = (mid: string, max: number | null | undefined) => {
    setCart(prev => {
      const cur = prev[mid] ?? 0;
      if (max != null && cur >= max) return prev;
      return { ...prev, [mid]: cur + 1 };
    });
  };
  const dec = (mid: string) => {
    setCart(prev => {
      const cur = prev[mid] ?? 0;
      if (cur <= 1) {
        const { [mid]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [mid]: cur - 1 };
    });
  };

  const cartLines = items
    .filter(it => (cart[it.id] ?? 0) > 0)
    .map(it => ({ ...it, qty: cart[it.id] }));
  const itemCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const subtotal  = cartLines.reduce((s, l) => s + (Number(l.price) || 0) * l.qty, 0);
  // Only hot/cold drinks count toward game level / coffee tally.
  // Allow-list (not deny-list) so legacy items with missing/typo'd category
  // never accidentally bump the player's level. Must stay in sync with the
  // server's `awardOrderProgress` drink count in cafe-dashboard.ts.
  const drinkCount = cartLines.reduce(
    (s, l) => s + (l.category === "مشروب ساخن" || l.category === "مشروبات باردة" ? l.qty : 0),
    0,
  );

  const reset = () => {
    setCart({}); setCustomerName(""); setCustomerPhone("");
    setMatchedUser(null); setLookupTried(false); setNotes(""); setErr("");
    setDiscountInput(""); setAppliedDiscount(null); setDiscountErr("");
    setFreeOrder(false);
  };

  // Computed totals: subtotal → after-code discount → free toggle override.
  const discountAmt = appliedDiscount
    ? +((subtotal * appliedDiscount.percent) / 100).toFixed(3)
    : 0;
  const afterDiscount = +(subtotal - discountAmt).toFixed(3);
  const finalTotal    = freeOrder ? 0 : afterDiscount;

  const applyDiscount = async () => {
    setDiscountErr("");
    const code = discountInput.trim();
    if (!code) { setDiscountErr("أدخل الكود"); return; }
    setValidatingDiscount(true);
    try {
      const res = await api.validateDiscountCode(id, code);
      if (res.valid && typeof res.percent === "number") {
        setAppliedDiscount({ code, percent: res.percent });
      } else {
        setDiscountErr(res.error || "كود غير صالح");
        setAppliedDiscount(null);
      }
    } catch (e: any) {
      setDiscountErr(e?.message ? String(e.message).slice(0, 120) : "تعذّر التحقق");
      setAppliedDiscount(null);
    } finally {
      setValidatingDiscount(false);
    }
  };
  const removeDiscount = () => {
    setAppliedDiscount(null); setDiscountInput(""); setDiscountErr("");
  };

  // Debounced auto-lookup when the cashier finishes typing the phone.
  useEffect(() => {
    const phone = customerPhone.trim();
    if (!phone) { setMatchedUser(null); setLookupTried(false); return; }
    setLookingUp(true);
    const t = window.setTimeout(async () => {
      try {
        const { user } = await api.cafeLookupUser(id, phone);
        setMatchedUser(user);
        if (user && !customerName.trim()) setCustomerName(user.username);
      } catch {
        setMatchedUser(null);
      } finally {
        setLookingUp(false);
        setLookupTried(true);
      }
    }, 400);
    return () => { window.clearTimeout(t); setLookingUp(false); };
    // We intentionally omit customerName from deps — we only seed it once on lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone, id]);

  const submit = async () => {
    setErr("");
    const name = customerName.trim();
    if (!name)               { setErr("أدخل اسم الزبون"); return; }
    if (cartLines.length === 0) { setErr("اختر منتجاً واحداً على الأقل"); return; }
    // If a phone was typed but does not match a registered player, ask the
    // cashier to either clear it or correct it before sending. (Awarding only
    // happens when phone matches; an unmatched phone is just dead weight.)
    const phone = customerPhone.trim();
    if (phone && !matchedUser) {
      setErr("الرقم غير مسجَّل في Copointo Hub — امسحه أو صحّحه قبل الإرسال");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.addCafeOrder(id, {
        customerName: name,
        // Only attach phone when it matched a real game user — that's the trigger
        // for the server to credit loyalty points for this direct order.
        customerPhone: matchedUser ? matchedUser.phone : "",
        source: "direct",
        type: "dine",
        tableNumber: "",
        items: cartLines.map(l => ({
          name: l.name,
          qty: l.qty,
          price: Number(l.price) || 0,
          category: l.category,
        })),
        total: +subtotal.toFixed(3),
        drinkCount,
        notes: notes.trim() || undefined,
        // Server will validate the code, compute discountAmount, and recompute
        // total. We pass the code in the create payload so the order is born
        // with the discount baked in (consistent with mobile cart flow).
        discountCode: appliedDiscount?.code,
      });
      // If the cashier marked it free, stamp paymentMethod="free" right after
      // creation so the order shows up as paid (with 0 collected) and won't
      // block on the cash/visa form.
      if (freeOrder && created?.order?.id) {
        try {
          await api.cafeOrderPayment(id, created.order.id, { paymentMethod: "free" });
        } catch (e: any) {
          // Order was created — surface a non-blocking warning but still reset.
          setErr("تم إنشاء الطلب لكن تعذّر تثبيته كمجاني: " + (e?.message ?? ""));
        }
      }
      reset();
      onCreated();
    } catch (e: any) {
      setErr(e?.message ? String(e.message).slice(0, 200) : "تعذّر إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Empty icon="⏳" text="جارٍ تحميل القائمة…" />;
  }
  if (items.length === 0) {
    return <Empty icon="📋" text="لا توجد منتجات في القائمة بعد. أضِف منتجات من تبويب «القائمة» أولاً." />;
  }

  const q = search.trim().toLowerCase();
  const visibleItems = q
    ? items.filter(i => {
        const name = String(i.name ?? "").toLowerCase();
        const desc = String(i.description ?? "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      })
    : items;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:items-start">
      {/* ── Always-visible sticky running total bar (full width on top) ── */}
      {cartLines.length > 0 && (
        <div className="lg:col-span-3 sticky top-2 z-30">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-primary/60 bg-gradient-to-l from-primary/15 via-primary/10 to-primary/15 backdrop-blur shadow-lg">
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
              <ShoppingBag size={20} />
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="text-xs text-muted-foreground">عدد القطع</span>
              <span className="font-bold text-foreground tabular-nums">{itemCount}</span>
              {appliedDiscount && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">قبل الخصم</span>
                  <span className="line-through text-muted-foreground tabular-nums text-sm">{subtotal.toFixed(3)}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">-{appliedDiscount.percent}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">المستحق</span>
              {freeOrder ? (
                <span className="text-lg font-bold text-amber-400 tabular-nums flex items-center gap-1.5">
                  <span className="line-through text-muted-foreground text-sm font-normal">{afterDiscount.toFixed(3)}</span>
                  0.000 OMR <span className="text-[10px]">(مجاني)</span>
                </span>
              ) : (
                <span className="text-lg font-bold text-primary tabular-nums">{finalTotal.toFixed(3)} OMR</span>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !customerName.trim()}
              title={!customerName.trim() ? "أدخل اسم الزبون أولاً" : "تأكيد الطلب"}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:opacity-90 shrink-0"
            >
              <CheckCircle size={14} />
              {submitting ? "…" : "تأكيد"}
            </button>
          </div>
        </div>
      )}

      {/* ── Right column: menu picker (2/3) — independent scroll on desktop ── */}
      <div className="lg:col-span-2 space-y-5 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-2">
        {/* Quick search bar */}
        <Card className="p-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن منتج بالاسم…"
              className="w-full bg-background border border-border rounded-lg pr-9 pl-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/40"
                aria-label="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {q && (
            <p className="text-xs text-muted-foreground mt-2">
              {visibleItems.length === 0
                ? "لا توجد نتائج مطابقة"
                : `${visibleItems.length} منتج مطابق`}
            </p>
          )}
        </Card>

        {MENU_CATEGORIES.map(({ value: cat, label, Icon }) => {
          const list = visibleItems.filter(i => i.category === cat);
          if (list.length === 0) return null;
          return (
            <Card key={cat} className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon size={18} className="text-primary" />
                <h3 className="font-bold text-foreground">{label}</h3>
                <span className="text-xs text-muted-foreground">({list.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map(it => {
                  const qty = cart[it.id] ?? 0;
                  const outOfStock = it.stockQty != null && it.stockQty <= 0;
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        qty > 0 ? "border-primary bg-primary/5" : "border-border bg-input/30"
                      } ${outOfStock ? "opacity-50" : ""}`}
                    >
                      {it.image ? (
                        <img src={it.image} alt={it.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-muted/40 flex items-center justify-center text-2xl shrink-0">☕</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{it.name}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">{Number(it.price).toFixed(3)} OMR</p>
                        {it.stockQty != null && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            المتبقّي: {it.stockQty}
                          </p>
                        )}
                      </div>
                      {outOfStock ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-500/15 text-red-400">نفد</span>
                      ) : qty === 0 ? (
                        <button
                          onClick={() => inc(it.id, it.stockQty)}
                          className="w-9 h-9 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center"
                          aria-label="إضافة"
                        >
                          <Plus size={16} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => dec(it.id)}
                            className="w-8 h-8 rounded-lg bg-muted/40 text-foreground hover:bg-muted/60 flex items-center justify-center"
                            aria-label="إنقاص"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-7 text-center font-bold text-foreground">{qty}</span>
                          <button
                            onClick={() => inc(it.id, it.stockQty)}
                            className="w-8 h-8 rounded-lg bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center"
                            aria-label="زيادة"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Left column: summary (1/3) — independent scroll on desktop ── */}
      <div className="lg:col-span-1 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:pr-1">
        <Card className="p-5">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            ملخص الطلب المباشر
          </h3>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                اسم الزبون *
              </label>
              <Inp value={customerName} onChange={setCustomerName} placeholder="مثال: أحمد" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block flex items-center gap-1.5">
                <span>📱 رقم Copointo Hub (اختياري)</span>
                {lookingUp && <span className="text-[10px] text-muted-foreground">جارٍ البحث…</span>}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="مثال: 99887766"
                className={`w-full bg-input border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 placeholder:text-muted-foreground ${
                  matchedUser
                    ? "border-emerald-500/60 focus:ring-emerald-500/50"
                    : customerPhone.trim() && lookupTried && !lookingUp
                    ? "border-orange-500/60 focus:ring-orange-500/50"
                    : "border-border focus:ring-primary"
                }`}
              />
              {matchedUser ? (
                <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold shrink-0">✓</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-300 truncate">{matchedUser.username}</p>
                      <p className="text-[10px] text-emerald-300/70 tabular-nums" dir="ltr">{matchedUser.phone} · Lv {matchedUser.level} · ☕ {matchedUser.totalOrders}</p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-1 rounded-md">سيُحتسب</span>
                  </div>
                  {drinkCount > 0 ? (
                    <div className="text-[11px] text-emerald-200 bg-emerald-500/10 rounded-md px-2 py-1.5 leading-tight">
                      🎮 سيُضاف لمستواه <b className="text-emerald-300">+{drinkCount}</b> {drinkCount === 1 ? "كوب" : "كوب"} من هذا الطلب
                      <span className="block text-emerald-300/70 tabular-nums mt-0.5" dir="ltr">
                        Lv {matchedUser.level} → Lv {Math.min(999, matchedUser.level + drinkCount)} · ☕ {matchedUser.totalOrders} → {matchedUser.totalOrders + drinkCount}
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-emerald-300/70">اختر منتجات (مشروبات) ليُحتسب لها مستوى.</p>
                  )}
                </div>
              ) : customerPhone.trim() && lookupTried && !lookingUp ? (
                <p className="mt-1 text-[11px] text-orange-400">⚠️ غير مسجَّل في Copointo Hub — لن تُحتسب نقاط</p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">إذا كان الزبون لاعب مسجَّل، اكتب رقمه ليُربط بالطلب وتُحتسب له النقاط.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="مثال: بدون سكر"
                rows={2}
                className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground resize-none"
              />
            </div>
          </div>

          {/* ── Discount code + free toggle ── */}
          <div className="border-t border-border pt-3 mb-3 space-y-2">
            {appliedDiscount ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-emerald-300">
                    🏷️ كود {appliedDiscount.code} مفعّل
                  </p>
                  <p className="text-[10px] text-emerald-300/80 tabular-nums">
                    خصم {appliedDiscount.percent}% = -{discountAmt.toFixed(3)} OMR
                  </p>
                </div>
                <button
                  type="button"
                  onClick={removeDiscount}
                  className="text-[10px] text-emerald-200 hover:text-white px-2 py-1 rounded-md hover:bg-emerald-500/20"
                  aria-label="إزالة الكود"
                >
                  ✕ إزالة
                </button>
              </div>
            ) : (
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  🏷️ كود تخفيض (اختياري)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={discountInput}
                    onChange={(e) => { setDiscountInput(e.target.value.replace(/[^\d]/g, "")); setDiscountErr(""); }}
                    placeholder="مثال: 1234"
                    disabled={freeOrder}
                    className="flex-1 bg-input border border-border rounded-xl px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={applyDiscount}
                    disabled={validatingDiscount || !discountInput.trim() || freeOrder}
                    className="px-3 py-2 rounded-xl bg-primary/20 text-primary border border-primary/40 text-xs font-bold hover:bg-primary/30 disabled:opacity-50"
                  >
                    {validatingDiscount ? "…" : "تطبيق"}
                  </button>
                </div>
                {discountErr && (
                  <p className="mt-1 text-[10px] text-red-400">{discountErr}</p>
                )}
              </div>
            )}

            <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none transition ${
              freeOrder
                ? "bg-amber-500/15 border-amber-500/50"
                : "bg-input/40 border-border hover:border-amber-500/40"
            }`}>
              <input
                type="checkbox"
                checked={freeOrder}
                onChange={(e) => setFreeOrder(e.target.checked)}
                className="w-4 h-4 accent-amber-400"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${freeOrder ? "text-amber-300" : "text-foreground"}`}>
                  🎁 على حساب الكوفي (مجاني)
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  لا يتم تحصيل أي مبلغ من الزبون.
                </p>
              </div>
            </label>
          </div>

          <div className="border-t border-border pt-3 mb-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>عدد القطع</span>
              <span className="tabular-nums">{itemCount}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>المجموع الفرعي</span>
              <span className="tabular-nums">{subtotal.toFixed(3)} OMR</span>
            </div>
            {appliedDiscount && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>خصم ({appliedDiscount.percent}%)</span>
                <span className="tabular-nums">-{discountAmt.toFixed(3)} OMR</span>
              </div>
            )}
            {freeOrder && (
              <div className="flex justify-between text-xs text-amber-400">
                <span>على حساب الكوفي</span>
                <span className="tabular-nums">-{afterDiscount.toFixed(3)} OMR</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1">
              <span className="text-foreground">المستحق</span>
              {freeOrder ? (
                <span className="tabular-nums text-amber-400 flex items-center gap-2">
                  <span className="line-through text-muted-foreground text-sm font-normal">
                    {afterDiscount.toFixed(3)} OMR
                  </span>
                  <span>0.000 OMR</span>
                  <span className="text-[10px]">(مجاني)</span>
                </span>
              ) : (
                <span className="tabular-nums text-primary">
                  {finalTotal.toFixed(3)} OMR
                </span>
              )}
            </div>
          </div>

          {err && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs">
              {err}
            </div>
          )}

          <div className={`rounded-lg px-3 py-2 mb-4 border ${
            matchedUser
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-amber-500/10 border-amber-500/30"
          }`}>
            <p className={`text-[11px] leading-relaxed ${matchedUser ? "text-emerald-300" : "text-amber-300"}`}>
              {matchedUser
                ? `✅ سيُربط هذا الطلب بـ ${matchedUser.username} وستُضاف له نقاط Copointo Hub حسب عدد المشروبات.`
                : "ℹ️ هذا طلب مباشر من داخل الكوفي — بدون رقم لن يحتسب أي تقدّم في اللعبة، وستظهر الفاتورة بصيغة «طلب مباشر من الكوفي»."}
            </p>
          </div>

          <button
            onClick={submit}
            disabled={submitting || cartLines.length === 0 || !customerName.trim()}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
          >
            <CheckCircle size={16} />
            {submitting ? "جارٍ التأكيد…" : "تأكيد الطلب"}
          </button>
          {cartLines.length > 0 && !submitting && (
            <button
              onClick={reset}
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-1"
            >
              تفريغ السلة
            </button>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Orders Tab ────────────────────────────────────────────────
// Small live countdown shown in the corner of each pending/preparing
// order card. Counts down from `createdAt + prepMinutes`:
//   • > 50%  remaining → green
//   • ≤ 50%  remaining → orange (amber)
//   • ≤ 25%  remaining → red
// After the deadline passes it shows "-mm:ss" in red. The timer is
// hidden entirely when the order has no prepMinutes (legacy orders)
// or when the cashier has marked it ready/done.
function OrderTimer({ createdAt, prepMinutes }: { createdAt?: string; prepMinutes?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!createdAt || !prepMinutes || prepMinutes <= 0) return null;
  const startMs = new Date(createdAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const totalMs = prepMinutes * 60_000;
  const remainingMs = startMs + totalMs - now;
  const ratio = remainingMs / totalMs; // 1 → just started, 0 → due, <0 → late
  const overdue = remainingMs < 0;
  const absSec = Math.max(0, Math.ceil(Math.abs(remainingMs) / 1000));
  const mm = String(Math.floor(absSec / 60)).padStart(2, "0");
  const ss = String(absSec % 60).padStart(2, "0");
  const tone =
    overdue || ratio <= 0.25 ? "bg-red-500/20 text-red-400 border-red-500/50"
    : ratio <= 0.5            ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
    :                           "bg-emerald-500/20 text-emerald-400 border-emerald-500/50";
  return (
    <div
      className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold tabular-nums ${tone}`}
      dir="ltr"
      title="الوقت المتبقي لتحضير الطلب"
    >
      <Clock size={11} />
      {overdue ? "-" : ""}{mm}:{ss}
    </div>
  );
}

function OrdersTab({ id }: { id: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(
    () =>
      api.cafeOrders(id).then(d => {
        const sorted = [...(d.orders ?? [])].sort((a, b) => {
          const ta = new Date(a.createdAt).getTime();
          const tb = new Date(b.createdAt).getTime();
          return tb - ta; // newest first
        });
        setOrders(sorted);
      }),
    [id],
  );
  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 5s so a brand-new order from the mobile app shows up
  // in the list without the cashier needing to leave/re-enter the tab. The
  // notification chime is handled by `useNewItems` (it now fires even when
  // the orders tab is already active), so the audible "ding" and the new
  // order row appear at roughly the same time.
  useEffect(() => {
    const t = setInterval(() => { load(); }, 5000);
    return () => clearInterval(t);
  }, [load]);
  // Reload when daily-invoice flow clears orders so the tab updates immediately.
  useEffect(() => {
    const onCleared = () => { load(); };
    window.addEventListener("orders:cleared", onCleared);
    return () => window.removeEventListener("orders:cleared", onCleared);
  }, [load]);
  const confirmPrep = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "preparing");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "preparing" } : o));
  };
  // Delete a pending order — allowed only before the cashier confirms
  // preparation (server enforces the same rule). Asks the cashier to
  // confirm first so accidental clicks don't drop a real order.
  const deletePendingOrder = async (oid: string) => {
    const o = orders.find(x => x.id === oid);
    if (!o || o.status !== "pending") return;
    const ok = window.confirm(
      `هل أنت متأكد من حذف هذا الطلب؟\nالزبون: ${o.customerName ?? "—"}\nالإجمالي: ${Number(o.total ?? 0).toFixed(3)} ر.ع\n\nلا يمكن التراجع عن هذا الإجراء.`
    );
    if (!ok) return;
    try {
      await api.cafeDeleteOrder(id, oid);
      setOrders(prev => prev.filter(x => x.id !== oid));
    } catch (e: any) {
      window.alert(e?.message ? String(e.message).slice(0, 200) : "تعذّر حذف الطلب");
    }
  };
  const markReady = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "ready");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "ready" } : o));
  };
  const markDone = async (oid: string) => {
    await api.cafeOrderStatus(id, oid, "done");
    setOrders(prev => prev.map(o => o.id === oid ? { ...o, status: "done" } : o));
  };
  // Per-order in-progress payment form: { cash, visa } as strings while editing.
  // Opening this form replaces the cash/visa choice buttons with inputs.
  const [payForms, setPayForms] = useState<Record<string, { cash: string; visa: string } | undefined>>({});
  // Order currently open in the free-coffee redemption modal (cashier clicks
  // "🎟️ كود كوفي مجاني" next to كاش/فيزا). When set, <FreeCoffeeModal/> opens
  // for that order; on success the modal stamps the code onto the order,
  // marks it printed/done, and notifies the code owner that it's been used.
  const [freeCoffeeOrder, setFreeCoffeeOrder] = useState<any | null>(null);
  // Order currently open in the "تعديل الطلب" editor modal (add/remove items).
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  // Order currently open in the "إضافة رقم الهاتف" modal (attach a player phone
  // to a direct in-cafe order so they get loyalty/game points at print time).
  const [phoneOrder, setPhoneOrder] = useState<any | null>(null);
  // Status filter for the orders list. The four states mirror orderTheme()'s
  // label exactly: غير مستلم (pending) → تم الاستلام (preparing) → لم يُدفع بعد
  // (ready/done, no payment) → تم الدفع (paymentMethod set). The cashier taps a
  // button to view only that state; acting on an order moves it to the next
  // state and it leaves the current view automatically.
  const [statusFilter, setStatusFilter] = useState<string>("غير مستلم");
  const openPayForm = (oid: string, prefer: "cash" | "visa") => {
    const o = orders.find(x => x.id === oid);
    const tot = Number(o?.total ?? 0).toFixed(3);
    setPayForms(prev => ({
      ...prev,
      [oid]: prefer === "cash" ? { cash: tot, visa: "0.000" } : { cash: "0.000", visa: tot },
    }));
  };
  const closePayForm = (oid: string) => {
    setPayForms(prev => { const next = { ...prev }; delete next[oid]; return next; });
  };
  const updatePayForm = (oid: string, field: "cash" | "visa", value: string) => {
    setPayForms(prev => ({ ...prev, [oid]: { ...(prev[oid] ?? { cash: "0.000", visa: "0.000" }), [field]: value } }));
  };
  const fillPayForm = (oid: string, mode: "all-cash" | "all-visa" | "half") => {
    const o = orders.find(x => x.id === oid);
    const tot = Number(o?.total ?? 0);
    if (mode === "all-cash") setPayForms(p => ({ ...p, [oid]: { cash: tot.toFixed(3), visa: "0.000" } }));
    else if (mode === "all-visa") setPayForms(p => ({ ...p, [oid]: { cash: "0.000", visa: tot.toFixed(3) } }));
    else setPayForms(p => ({ ...p, [oid]: { cash: (tot / 2).toFixed(3), visa: (tot / 2).toFixed(3) } }));
  };
  const confirmPayment = async (oid: string) => {
    const form = payForms[oid];
    if (!form) return;
    const o = orders.find(x => x.id === oid);
    const tot = +Number(o?.total ?? 0).toFixed(3);
    const cashAmount = +Number(form.cash || 0).toFixed(3);
    const visaAmount = +Number(form.visa || 0).toFixed(3);
    if (!Number.isFinite(cashAmount) || !Number.isFinite(visaAmount) || cashAmount < 0 || visaAmount < 0) {
      window.alert("❌ المبالغ يجب أن تكون أرقاماً موجبة");
      return;
    }
    const sum = +(cashAmount + visaAmount).toFixed(3);
    if (Math.abs(sum - tot) > 0.005) {
      window.alert(`❌ مجموع المدفوع (${sum.toFixed(3)}) لا يساوي إجمالي الطلب (${tot.toFixed(3)})`);
      return;
    }
    let method: "cash" | "visa" | "split" = "split";
    if (cashAmount > 0 && visaAmount === 0) method = "cash";
    else if (visaAmount > 0 && cashAmount === 0) method = "visa";
    try {
      const { order } = await api.cafeOrderPayment(id, oid, { paymentMethod: method, cashAmount, visaAmount });
      setOrders(prev => prev.map(x => x.id === oid ? { ...x, ...order } : x));
      closePayForm(oid);
    } catch (e: any) {
      window.alert(`❌ ${e?.message ?? "تعذّر تثبيت الدفع"}`);
    }
  };
  const setFreePayment = async (oid: string) => {
    if (!window.confirm("⚠️ تأكيد: هل تريد جعل هذا الطلب على حساب الكوفي (مجاناً)؟\nسيتم خصم كامل المبلغ من الفاتورة وإظهارها كـ 0.000 ر.ع، ولن تُحتسب في الإيرادات.")) return;
    try {
      const { order } = await api.cafeOrderPayment(id, oid, { paymentMethod: "free" });
      setOrders(prev => prev.map(x => x.id === oid ? { ...x, ...order } : x));
    } catch (e: any) {
      window.alert(`❌ ${e?.message ?? "تعذّر التثبيت"}`);
    }
  };
  const applyDiscountCode = async (oid: string) => {
    const code = window.prompt("🏷️ أدخل كود التخفيض المسجَّل:");
    if (!code) return;
    try {
      const { order } = await api.cafeOrderDiscount(id, oid, { code: code.trim() });
      setOrders(prev => prev.map(o => o.id === oid ? { ...o, ...order } : o));
      window.alert(`✅ تم تطبيق الكود ${order.discountCode} (${order.discountPercent}%)\nالخصم: −${Number(order.discountAmount).toFixed(3)} ر.ع\nالإجمالي الجديد: ${Number(order.total).toFixed(3)} ر.ع`);
    } catch (e: any) {
      window.alert(`❌ ${e?.message ?? "تعذّر تطبيق الكود"}`);
    }
  };
  const applyDiscountAmount = async (oid: string) => {
    const amtStr = window.prompt("💰 أدخل مبلغ الخصم بالريال العماني:");
    if (!amtStr) return;
    const amount = Number(amtStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("❌ أدخل مبلغ صحيح أكبر من صفر");
      return;
    }
    try {
      const { order } = await api.cafeOrderDiscount(id, oid, { amount });
      setOrders(prev => prev.map(o => o.id === oid ? { ...o, ...order } : o));
      window.alert(`✅ تم تطبيق خصم: −${Number(order.discountAmount).toFixed(3)} ر.ع\nالإجمالي الجديد: ${Number(order.total).toFixed(3)} ر.ع`);
    } catch (e: any) {
      window.alert(`❌ ${e?.message ?? "تعذّر تطبيق الخصم"}`);
    }
  };
  const printInvoice = async (o: any) => {
    // Award points + mark order as done (idempotent on server) — fire and forget.
    api.cafeOrderPrint(id, o.id).then(() => {
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: "done", pointsAwarded: true } : x));
    }).catch(() => { /* swallow — print still happens */ });
    await printOrderInvoice(id, o);
  };
  // Customer receipt: same content as the official invoice, but DOES NOT
  // mark the order as printed/done, does NOT award loyalty points, and is
  // tagged as "نسخة الزبون / Customer Copy" so it never gets confused with
  // the cashier's official invoice in audits/reports. Available right after
  // the cashier confirms the order so the customer can take a copy with
  // their selected bean/size details.
  const printCustomerReceipt = async (o: any) => {
    await printOrderInvoice(id, o, undefined, { customerCopy: true });
  };

  // "Start a new day" — wipes the orders panel only. Invoices are stored
  // in a separate server-side collection (`invoices`) and are untouched
  // by `cafeOrdersClear`, so revenue history and the daily/monthly/yearly
  // reports remain intact. Asks for a clear confirmation first because
  // this cannot be undone.
  const [clearing, setClearing] = useState(false);
  const clearAllOrders = async () => {
    if (orders.length === 0) return;
    const ok = window.confirm(
      `هل تريد حذف جميع الطلبات (${orders.length}) من قسم «طلبات القهوة» لبدء يوم جديد؟\n\n` +
      `• الطلبات سترفع من هذا القسم.\n` +
      `• الفواتير المحفوظة لن تتأثر — الإيرادات والتقارير تبقى كما هي.\n\n` +
      `لا يمكن التراجع عن هذا الإجراء.`
    );
    if (!ok) return;
    setClearing(true);
    try {
      await api.cafeOrdersClear(id);
      setOrders([]);
      window.dispatchEvent(new CustomEvent("orders:cleared"));
    } catch (e: any) {
      window.alert(e?.message ? String(e.message).slice(0, 200) : "تعذّر حذف الطلبات");
    } finally {
      setClearing(false);
    }
  };

  // ── Status filter buttons ───────────────────────────────────────────
  // Each order belongs to exactly one of the four states via orderTheme().label.
  // We count per state for the badge above each button, and filter the list to
  // the selected state.
  const STATUS_DEFS: { t: string; dot: string; active: string; badge: string }[] = [
    { t: "غير مستلم",   dot: "bg-red-500",     active: "border-red-500/60 bg-red-500/15 text-red-300",         badge: "bg-red-500 text-white" },
    { t: "تم الاستلام", dot: "bg-orange-500",  active: "border-orange-500/60 bg-orange-500/15 text-orange-300", badge: "bg-orange-500 text-white" },
    { t: "لم يُدفع بعد", dot: "bg-blue-500",    active: "border-blue-500/60 bg-blue-500/15 text-blue-300",       badge: "bg-blue-500 text-white" },
    { t: "تم الدفع",    dot: "bg-emerald-500", active: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300", badge: "bg-emerald-500 text-white" },
  ];
  const statusCounts: Record<string, number> = {};
  orders.forEach(o => { const l = orderTheme(o).label; statusCounts[l] = (statusCounts[l] || 0) + 1; });
  const filteredOrders = statusFilter === "الكل"
    ? orders
    : orders.filter(o => orderTheme(o).label === statusFilter);
  const isFinalFilter = statusFilter === "تم الدفع";

  return (
    <div className="space-y-4">
      {orders.length > 0 && (
        <Card className="p-4 flex items-center justify-between gap-3 bg-gradient-to-l from-red-500/5 to-card border-red-500/30">
          <div className="min-w-0">
            <p className="font-bold text-sm text-foreground">🌅 بدء يوم جديد</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              يحذف جميع طلبات هذا القسم ({orders.length}) لاستقبال طلبات جديدة — الفواتير المحفوظة لا تتأثر.
            </p>
          </div>
          <button
            onClick={clearAllOrders}
            disabled={clearing}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/40 text-xs font-bold hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14}/> {clearing ? "جارٍ الحذف…" : "احذف الطلبات كاملة"}
          </button>
        </Card>
      )}
      {orders.length > 0 && (
        <div className="rounded-2xl border border-[#E8B86D]/15 bg-gradient-to-b from-card to-[#0a0606] px-4 pt-5 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {(() => {
              const active = statusFilter === "الكل";
              return (
                <button
                  onClick={() => setStatusFilter("الكل")}
                  className={`relative flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${active ? "border-[#E8B86D]/60 bg-[#E8B86D]/15 text-[#E8B86D] shadow-md" : "border-border/40 bg-card/60 text-foreground/70 hover:border-[#E8B86D]/40 hover:text-foreground"}`}
                >
                  <span className={`absolute -top-2.5 -left-2.5 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full text-xs font-extrabold tabular-nums shadow ${orders.length > 0 ? "bg-[#E8B86D] text-black" : "bg-muted text-muted-foreground"}`}>
                    {orders.length}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-500 via-blue-500 to-emerald-500" aria-hidden />
                    الكل
                  </span>
                </button>
              );
            })()}
            {STATUS_DEFS.map(s => {
              const count = statusCounts[s.t] ?? 0;
              const active = statusFilter === s.t;
              return (
                <button
                  key={s.t}
                  onClick={() => setStatusFilter(s.t)}
                  className={`relative flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border transition-all ${active ? `${s.active} shadow-md` : "border-border/40 bg-card/60 text-foreground/70 hover:border-[#E8B86D]/40 hover:text-foreground"}`}
                >
                  <span className={`absolute -top-2.5 -left-2.5 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full text-xs font-extrabold tabular-nums shadow ${count > 0 ? s.badge : "bg-muted text-muted-foreground"}`}>
                    {count}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} aria-hidden />
                    {s.t}
                  </span>
                </button>
              );
            })}
          </div>
          <div className={`mt-3 rounded-xl border px-4 py-2.5 text-xs font-bold flex items-center gap-2 ${isFinalFilter ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
            {isFinalFilter
              ? "✅ تم اتخاذ الإجراء النهائي لهذه الطلبات — للعرض فقط"
              : "🔔 يرجى اتخاذ إجراء للطلبات في هذه الحالة"}
          </div>
        </div>
      )}
      {orders.length === 0 && <Empty icon="📦" text="لا توجد طلبات قهوة بعد" />}
      {orders.length > 0 && filteredOrders.length === 0 && (
        <Empty icon="📭" text={`لا توجد طلبات في حالة «${statusFilter}»`} />
      )}
      {filteredOrders.map(o => { const th = orderTheme(o); return (
        <div key={o.id} className={`relative overflow-hidden p-5 pr-7 rounded-2xl border-2 ${th.ring} ${th.bg} ${th.glow} bg-card transition-shadow duration-200`}>
          <span className={`absolute top-0 bottom-0 right-0 w-1.5 ${th.bar}`} aria-hidden />
          {(o.status === "pending" || o.status === "preparing") && (
            <OrderTimer createdAt={o.createdAt} prepMinutes={o.prepMinutes} />
          )}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <p className="font-semibold text-foreground">
                {o.customerName}
                {o.customerNameEn ? (
                  <span className="ml-2 text-xs text-muted-foreground" dir="ltr">({o.customerNameEn})</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {o.source === "direct"
                  ? "☕ طلب مباشر من الكوفي"
                  : <>
                      {o.customerPhone} •{" "}
                      {o.type === "dine"
                        ? `🪑 طاولة ${o.tableNumber}`
                        : `🚗 ${o.plateNumber} ${o.plateSymbol ?? ""}`}
                    </>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {o.source === "direct" && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                  مباشر
                </span>
              )}
              <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${th.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${th.dot} animate-pulse`} aria-hidden />
                {th.label}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 mb-3">
            {o.items?.map((item: any, i: number) => {
              const variantBits: string[] = [];
              if (item.selectedBean) variantBits.push(`☕ ${item.selectedBean}`);
              if (item.selectedSize) variantBits.push(`📏 ${item.selectedSize}`);
              const hasOldPrice = Number(item.originalPrice) > 0 && Number(item.originalPrice) > Number(item.price);
              const bonusN = Number(item.bonusQty) || 0;
              return (
                <div key={i} className="flex justify-between items-start text-sm gap-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">
                      {item.name} <span className="text-foreground/80">×{item.qty}</span>
                      {bonusN > 0 && <span className="text-primary"> (+{bonusN})</span>}
                    </span>
                    {variantBits.length > 0 && (
                      <div className="text-[11px] text-primary/85 mt-0.5">
                        {variantBits.join(" • ")}
                      </div>
                    )}
                    {bonusN > 0 && (
                      <div className="text-[11px] text-primary mt-0.5">
                        🎁 +{bonusN} مجاني (عرض اشترِ {item.promoBuyQty} احصل على {item.promoGetQty})
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {hasOldPrice && (
                      <div className="text-[10px] text-muted-foreground/70 line-through">
                        {(Number(item.originalPrice) * item.qty).toFixed(3)}
                      </div>
                    )}
                    <span className="text-foreground font-medium">{(item.price * item.qty).toFixed(3)} OMR</span>
                  </div>
                </div>
              );
            })}
          </div>
          {o.notes && (
            <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <p className="text-[11px] font-semibold text-primary mb-0.5">📝 ملاحظات الزبون</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{o.notes}</p>
            </div>
          )}
          {Array.isArray(o.freeCoffeeRedemptions) && o.freeCoffeeRedemptions.length > 0 && (
            <div className="mb-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
              <p className="text-[11px] font-semibold text-primary mb-1 flex items-center gap-1.5">
                <Gift size={12}/> كوفي مجاني مُستخدَم ({o.freeCoffeeRedemptions.length})
              </p>
              <div className="space-y-0.5">
                {o.freeCoffeeRedemptions.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-foreground">
                      {r.itemName} <span className="text-muted-foreground">· كود {r.code}</span>
                    </span>
                    <span className="text-primary font-semibold">− {Number(r.itemPrice).toFixed(3)} OMR</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                الخصم: −{Number(o.freeCoffeeDiscount ?? 0).toFixed(3)} OMR
              </p>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3 gap-3 flex-wrap">
            <span className="font-bold text-primary">{o.total?.toFixed(3)} OMR</span>
            <div className="flex gap-2 flex-wrap">
              {/* Existing badges (always visible once set) */}
              {o.freeCoffeeCode && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-xs font-semibold">
                  <Gift size={13}/> كوفي مجاني: {o.freeCoffeeCode}
                </span>
              )}
              {Number(o.discountAmount) > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-semibold">
                  {o.discountCode
                    ? `🏷️ ${o.discountCode}${o.discountPercent ? ` ${o.discountPercent}%` : ""}`
                    : `💰 خصم`}
                  {" "}−{Number(o.discountAmount).toFixed(3)}
                </span>
              )}
              {o.paymentMethod && (
                <span className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                  o.paymentMethod === "cash"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : o.paymentMethod === "visa"
                    ? "bg-blue-500/15 text-blue-400"
                    : o.paymentMethod === "split"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/40"
                    : "bg-primary/20 text-primary border border-primary/40"
                }`}>
                  {o.paymentMethod === "cash"
                    ? `💵 كاش${Number(o.cashAmount) > 0 ? ` ${Number(o.cashAmount).toFixed(3)}` : ""}`
                   : o.paymentMethod === "visa"
                    ? `💳 فيزا${Number(o.visaAmount) > 0 ? ` ${Number(o.visaAmount).toFixed(3)}` : ""}`
                   : o.paymentMethod === "split"
                    ? `💵 ${Number(o.cashAmount).toFixed(3)} + 💳 ${Number(o.visaAmount).toFixed(3)}`
                   : "🎁 الحساب مجاناً"}
                </span>
              )}

              {/* Edit order — add/remove items. Allowed while no payment is
                  locked and the order isn't done. Recomputes total + invoice. */}
              {!o.paymentMethod && o.status !== "done" && (
                <button
                  onClick={() => setEditingOrder(o)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/25"
                  title="إضافة منتج للطلب أو حذف منتج — يتعدّل المبلغ والفاتورة"
                >
                  <Pencil size={14}/> التعديل على الطلب
                </button>
              )}

              {/* Add a phone to an order that has none (e.g. a direct in-cafe
                  order placed without one) so the customer is credited points.
                  Shown only before the invoice is printed (no payment, not done). */}
              {!o.customerPhone && !o.paymentMethod && o.status !== "done" && (
                <button
                  onClick={() => setPhoneOrder(o)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/25"
                  title="أضف رقم هاتف الزبون ليُسجَّل الطلب باسمه ويستلم نقاط اللعبة"
                >
                  <Phone size={14}/> إضافة رقم الهاتف
                </button>
              )}

              {/* Step 1 — pending: confirm-prep + delete (delete vanishes once confirmed) */}
              {o.status === "pending" && (
                <>
                  <button
                    onClick={() => confirmPrep(o.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                  >
                    <CheckCircle size={14}/> تأكيد تحضير الطلب
                  </button>
                  <button
                    onClick={() => deletePendingOrder(o.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 text-red-400 border border-red-500/40 text-xs font-bold hover:bg-red-500/25"
                    title="حذف الطلب — متاح فقط قبل تأكيد التحضير"
                  >
                    <Trash2 size={14}/> حذف الطلب
                  </button>
                </>
              )}

              {/* Step 2 — preparing: only the order-ready button */}
              {o.status === "preparing" && (
                <button
                  onClick={() => markReady(o.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold hover:bg-green-500/30"
                >
                  <CheckCircle size={14}/> طلبك جاهز
                </button>
              )}

              {/* Step 3 — ready, no payment yet: choose cash/visa.
                  Free-coffee redemption is now done by the customer in the mobile app at checkout
                  (and arrives baked into the order), so no manual button here. */}
              {o.status === "ready" && !o.paymentMethod && !payForms[o.id] && (
                <>
                  <button
                    onClick={() => openPayForm(o.id, "cash")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30"
                  >
                    💵 كاش
                  </button>
                  <button
                    onClick={() => openPayForm(o.id, "visa")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/30"
                  >
                    💳 فيزا
                  </button>
                  <button
                    onClick={() => setFreeCoffeeOrder(o)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold hover:bg-purple-500/30"
                    title="استخدام كود قهوة مجانية يملكه الزبون (من نظام المكافآت كل 7 مشروبات)"
                  >
                    🎟️ كود كوفي مجاني
                  </button>
                  <button
                    onClick={() => setFreePayment(o.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 text-primary border border-primary/40 text-xs font-bold hover:bg-primary/30"
                  >
                    🎁 الحساب مجاناً
                  </button>
                  <button
                    onClick={() => applyDiscountCode(o.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30"
                  >
                    🏷️ كود تخفيض
                  </button>
                  <button
                    onClick={() => applyDiscountAmount(o.id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/40 text-xs font-bold hover:bg-orange-500/30"
                  >
                    💰 خصم بالسعر
                  </button>
                </>
              )}

              {/* Step 3b — split-payment form: opened by clicking كاش or فيزا.
                  Cashier enters how much was paid in cash and how much in visa.
                  Sum must equal the order total. Quick presets fill the inputs. */}
              {o.status === "ready" && !o.paymentMethod && payForms[o.id] && (() => {
                const f = payForms[o.id]!;
                const tot = +Number(o.total ?? 0).toFixed(3);
                const sum = +(Number(f.cash || 0) + Number(f.visa || 0)).toFixed(3);
                const ok = Math.abs(sum - tot) < 0.005;
                return (
                  <div className="w-full mt-2 p-3 rounded-xl bg-card border border-border/60 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">💳 تثبيت الدفع — الإجمالي: {tot.toFixed(3)} ر.ع</span>
                      <button onClick={() => closePayForm(o.id)} className="text-[11px] text-muted-foreground hover:text-foreground">إلغاء ✕</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => fillPayForm(o.id, "all-cash")} className="px-3 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 hover:bg-emerald-500/20">كل المبلغ كاش</button>
                      <button onClick={() => fillPayForm(o.id, "all-visa")} className="px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[11px] font-semibold border border-blue-500/30 hover:bg-blue-500/20">كل المبلغ فيزا</button>
                      <button onClick={() => fillPayForm(o.id, "half")} className="px-3 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-semibold border border-primary/30 hover:bg-primary/20">نص-نص</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-emerald-400 font-semibold">💵 كاش (ر.ع)</span>
                        <input
                          type="number" step="0.001" min="0"
                          value={f.cash}
                          onChange={(e) => updatePayForm(o.id, "cash", e.target.value)}
                          className="px-3 py-2 rounded-md bg-background border border-emerald-500/30 text-emerald-300 text-sm font-mono"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-blue-400 font-semibold">💳 فيزا (ر.ع)</span>
                        <input
                          type="number" step="0.001" min="0"
                          value={f.visa}
                          onChange={(e) => updatePayForm(o.id, "visa", e.target.value)}
                          className="px-3 py-2 rounded-md bg-background border border-blue-500/30 text-blue-300 text-sm font-mono"
                        />
                      </label>
                    </div>
                    <div className={`flex items-center justify-between text-xs font-semibold ${ok ? "text-emerald-400" : "text-orange-400"}`}>
                      <span>المجموع: {sum.toFixed(3)} ر.ع</span>
                      <span>{ok ? "✓ مطابق" : `الفرق: ${(sum - tot).toFixed(3)}`}</span>
                    </div>
                    <button
                      onClick={() => confirmPayment(o.id)}
                      disabled={!ok}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
                    >
                      ✔ تثبيت الدفع
                    </button>
                  </div>
                );
              })()}

              {/* Step 4 — payment set (or already done): show print invoice */}
              {((o.status === "ready" && o.paymentMethod) || o.status === "done") && (
                <button
                  onClick={() => printInvoice(o)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                >
                  🖨️ طباعة الفاتورة
                </button>
              )}

              {/* Customer copy — visible from "preparing" onwards (i.e. right
                  after the cashier confirms the order). Uses the same layout
                  as the official invoice but is tagged "نسخة الزبون" and
                  does NOT mark the order as printed/done or award points,
                  so it never affects revenue or the daily/monthly invoices. */}
              {o.status !== "pending" && (
                <button
                  onClick={() => printCustomerReceipt(o)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/25"
                  title="طباعة نسخة للزبون — لا تُحتسب من فواتير الكوفي"
                >
                  📄 نسخة الزبون
                </button>
              )}
            </div>
          </div>
        </div>
      ); })}
      {freeCoffeeOrder && (
        <FreeCoffeeModal
          cafeId={id}
          order={freeCoffeeOrder}
          onClose={() => setFreeCoffeeOrder(null)}
          onPrinted={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
          }}
        />
      )}
      {editingOrder && (
        <OrderEditor
          cafeId={id}
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
            setEditingOrder(null);
          }}
        />
      )}
      {phoneOrder && (
        <AddPhoneModal
          cafeId={id}
          order={phoneOrder}
          onClose={() => setPhoneOrder(null)}
          onSaved={(updated) => {
            setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o));
            setPhoneOrder(null);
          }}
        />
      )}
    </div>
  );
}

// ── Add Phone Modal ("إضافة رقم الهاتف") ──────────────────────────
// Lets the cashier attach a registered player's phone to an order that has none
// (typically a direct in-cafe order). Looks the number up live (debounced) and
// shows the matched player's name before saving. On save, the server registers
// the order under that player and credits loyalty/game points when the invoice
// is printed. An unmatched number cannot be saved (it would award nothing).
function AddPhoneModal({
  cafeId, order, onClose, onSaved,
}: {
  cafeId: string;
  order: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}) {
  const [phone, setPhone] = useState("");
  const [matched, setMatched] = useState<null | { id: string; username: string; phone: string; level: number; banned: boolean; gameBanned: boolean }>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupTried, setLookupTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Debounced auto-lookup (mirrors the "اطلب مباشر" tab behaviour).
  useEffect(() => {
    const p = phone.trim();
    if (!p) { setMatched(null); setLookupTried(false); return; }
    setLookingUp(true);
    const t = window.setTimeout(async () => {
      try {
        const { user } = await api.cafeLookupUser(cafeId, p);
        setMatched(user);
      } catch {
        setMatched(null);
      } finally {
        setLookingUp(false);
        setLookupTried(true);
      }
    }, 400);
    return () => { window.clearTimeout(t); setLookingUp(false); };
  }, [phone, cafeId]);

  const save = async () => {
    setErr("");
    const p = phone.trim();
    if (!p) { setErr("أدخل رقم هاتف الزبون"); return; }
    if (!matched) { setErr("الرقم غير مسجَّل في Copointo Hub — تأكد من الرقم"); return; }
    setSaving(true);
    try {
      const { order: updated } = await api.cafeOrderPhone(cafeId, order.id, p);
      onSaved(updated);
    } catch (e: any) {
      setErr(e?.message ? String(e.message).slice(0, 200) : "تعذّر إضافة الرقم");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Phone size={16} className="text-emerald-400"/> إضافة رقم الهاتف
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            أضف رقم هاتف الزبون المسجَّل في Copointo ليُسجَّل الطلب باسمه ويستلم نقاط اللعبة عند طباعة الفاتورة.
          </p>

          <div>
            <label className="text-xs font-bold text-foreground mb-1.5 block">رقم الهاتف</label>
            <input
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9XXXXXXX"
              className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground text-left placeholder:text-muted-foreground focus:border-emerald-500/60 outline-none"
            />
            <div className="mt-2 min-h-[1.25rem] text-xs">
              {lookingUp ? (
                <span className="text-muted-foreground">⏳ جارٍ البحث…</span>
              ) : matched ? (
                <span className="text-emerald-400 font-semibold">
                  ✓ {matched.username} — المستوى {matched.level}
                  {matched.banned ? " ⛔ محظور" : ""}
                </span>
              ) : phone.trim() && lookupTried ? (
                <span className="text-amber-400">⚠️ الرقم غير مسجَّل في Copointo Hub</span>
              ) : null}
            </div>
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border text-foreground text-sm font-semibold hover:bg-background"
            >
              إلغاء
            </button>
            <button
              onClick={save}
              disabled={saving || !matched}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 hover:opacity-90"
            >
              <CheckCircle size={15}/> {saving ? "…" : "حفظ الرقم"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Order Editor Modal ("التعديل على الطلب") ──────────────────────
// Lets the cashier add a product from the cafe menu or remove/adjust an
// existing line on a not-yet-paid order. The running total is computed live;
// on save it PATCHes the full items list to the server, which recomputes the
// order total (and rescales any active discount) and returns the updated order
// — so the printed invoice reflects the edit automatically.
function OrderEditor({
  cafeId, order, onClose, onSaved,
}: {
  cafeId: string;
  order: any;
  onClose: () => void;
  onSaved: (updated: any) => void;
}) {
  const [menu, setMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [items, setItems] = useState<any[]>(
    () => (order.items ?? []).map((it: any) => ({ ...it })),
  );
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    api.cafeMenu(cafeId)
      .then(d => { if (alive) setMenu((d.items ?? []).filter((m: any) => m.available !== false)); })
      .catch(() => { if (alive) setMenu([]); })
      .finally(() => { if (alive) setMenuLoading(false); });
    return () => { alive = false; };
  }, [cafeId]);

  // A line is "plain" (mergeable) when it has no variant/promo specifics — so
  // tapping the same menu item twice just bumps the qty instead of duplicating.
  const isPlain = (it: any) =>
    !it.selectedBean && !it.selectedSize && !it.originalPrice && !it.bonusQty;

  const addFromMenu = (m: any) => {
    setItems(prev => {
      const idx = prev.findIndex(it => it.name === m.name && Number(it.price) === Number(m.price) && isPlain(it));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Number(next[idx].qty) + 1 };
        return next;
      }
      return [...prev, { name: m.name, price: Number(m.price), qty: 1, category: m.category }];
    });
  };
  const incQty = (i: number, delta: number) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, Number(it.qty) + delta) } : it));
  };
  const removeLine = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);
  const freeCoffeeDisc = Math.min(Number(order.freeCoffeeDiscount ?? 0), subtotal);
  const discountAmount = order.discountPercent
    ? Math.min(+(subtotal * Number(order.discountPercent) / 100), Math.max(0, subtotal - freeCoffeeDisc))
    : Math.min(Number(order.discountAmount ?? 0), Math.max(0, subtotal - freeCoffeeDisc));
  const total = Math.max(0, subtotal - discountAmount - freeCoffeeDisc);

  const filteredMenu = menu.filter(m =>
    !search.trim() || String(m.name).toLowerCase().includes(search.trim().toLowerCase()),
  );

  const save = async () => {
    if (items.length === 0) {
      window.alert("❌ يجب أن يحتوي الطلب على منتج واحد على الأقل");
      return;
    }
    setSaving(true);
    try {
      const { order: updated } = await api.cafeOrderItems(cafeId, order.id, items);
      onSaved(updated);
    } catch (e: any) {
      window.alert(`❌ ${e?.message ?? "تعذّر حفظ التعديل"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-card">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Pencil size={16} className="text-primary"/> التعديل على الطلب — {order.customerName}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Current items */}
          <div>
            <p className="text-xs font-bold text-foreground mb-2">🧾 منتجات الطلب الحالية</p>
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center border border-dashed border-border rounded-lg">
                لا توجد منتجات — أضف منتجاً من القائمة بالأسفل
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{it.name}</p>
                      <div className="text-[11px] text-muted-foreground">
                        {Number(it.price).toFixed(3)} ر.ع
                        {(it.selectedBean || it.selectedSize) && (
                          <span className="text-primary/85">
                            {" • "}{[it.selectedBean ? `☕ ${it.selectedBean}` : "", it.selectedSize ? `📏 ${it.selectedSize}` : ""].filter(Boolean).join(" • ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => incQty(i, -1)} className="w-7 h-7 rounded-md bg-muted text-foreground font-bold hover:bg-muted/70">−</button>
                      <span className="w-8 text-center text-sm font-bold text-foreground tabular-nums">{it.qty}</span>
                      <button onClick={() => incQty(i, +1)} className="w-7 h-7 rounded-md bg-muted text-foreground font-bold hover:bg-muted/70">+</button>
                      <span className="w-16 text-right text-sm font-semibold text-foreground tabular-nums">{(Number(it.price) * Number(it.qty)).toFixed(3)}</span>
                      <button onClick={() => removeLine(i)} title="حذف المنتج" className="w-7 h-7 rounded-md bg-red-500/15 text-red-400 border border-red-500/40 hover:bg-red-500/25 flex items-center justify-center">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add product from menu */}
          <div>
            <p className="text-xs font-bold text-foreground mb-2">➕ إضافة منتج من قائمة الكوفي</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 ابحث عن منتج…"
              className="w-full mb-2 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground"
            />
            {menuLoading ? (
              <p className="text-xs text-muted-foreground py-3 text-center">جارٍ تحميل القائمة…</p>
            ) : filteredMenu.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">لا توجد منتجات مطابقة</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {filteredMenu.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addFromMenu(m)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-right hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="min-w-0 flex-1 text-sm text-foreground truncate">{m.name}</span>
                    <span className="text-xs text-primary font-semibold shrink-0">{Number(m.price).toFixed(3)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer — live total + save */}
        <div className="sticky bottom-0 z-10 px-5 py-4 border-t border-border bg-card space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>المجموع الفرعي</span><span className="tabular-nums">{subtotal.toFixed(3)} ر.ع</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>الخصم</span><span className="tabular-nums">−{discountAmount.toFixed(3)} ر.ع</span>
              </div>
            )}
            {freeCoffeeDisc > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>كوفي مجاني</span><span className="tabular-nums">−{freeCoffeeDisc.toFixed(3)} ر.ع</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-primary text-base pt-1 border-t border-border">
              <span>الإجمالي الجديد</span><span className="tabular-nums">{total.toFixed(3)} ر.ع</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg bg-muted text-foreground text-sm font-bold hover:bg-muted/70">إلغاء</button>
            <button
              onClick={save}
              disabled={saving || items.length === 0}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "جارٍ الحفظ…" : "✔ حفظ التعديل"}
            </button>
          </div>
        </div>
      </div>
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
    setBookings(prev => prev.map(b => b.id === bid ? { ...b, status, confirmedAt: status === "confirmed" ? new Date().toISOString() : b.confirmedAt } : b));
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
            <div><p className="text-muted-foreground text-xs">الطاولة</p><p className="text-foreground font-medium">{b.tableNumber} {b.tableCapacity ? <span className="text-muted-foreground text-[10px]">({b.tableCapacity})</span> : null}</p></div>
            <div><p className="text-muted-foreground text-xs">التاريخ</p><p className="text-foreground font-medium">{b.date}</p></div>
            <div><p className="text-muted-foreground text-xs">الوقت</p><p className="text-foreground font-medium">{b.time}</p></div>
            <div><p className="text-muted-foreground text-xs">الأشخاص</p><p className="text-foreground font-medium">👥 {b.guests}</p></div>
          </div>
          {(b.hours || b.totalPrice) && (
            <div className="grid grid-cols-2 gap-3 text-sm mb-3 p-2.5 rounded-lg bg-primary/8 border border-primary/20">
              {b.hours ? (
                <div><p className="text-muted-foreground text-[10px]">⏱️ المدة</p><p className="text-foreground font-semibold">{b.hours} ساعة</p></div>
              ) : null}
              {typeof b.totalPrice === "number" ? (
                <div><p className="text-muted-foreground text-[10px]">💰 سعر الحجز</p><p className="text-primary font-bold">{Number(b.totalPrice).toFixed(3)} OMR</p></div>
              ) : null}
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
            {b.status === "pending" && <>
              <button onClick={() => change(b.id,"confirmed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25"><CheckCircle size={13}/>تأكيد</button>
              <button onClick={() => change(b.id,"cancelled")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">إلغاء</button>
            </>}
            {b.status === "confirmed" && <>
              <button
                onClick={() => printBookingInvoice(id, b)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30"
              >
                <Printer size={13}/> طباعة فاتورة
              </button>
              <button onClick={() => change(b.id,"cancelled")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25">إلغاء الحجز</button>
            </>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// Print a thermal-receipt invoice for a confirmed table booking. Uses the
// existing "order" template (logo, footer) so the look matches food invoices.
async function printBookingInvoice(id: string, b: any) {
  let tpl: any = null;
  try { tpl = (await api.invoiceTemplate(id, "order")).template; } catch { /* fallback */ }
  const total = Number(b.totalPrice ?? 0);
  const dateLabel = b.confirmedAt
    ? new Date(b.confirmedAt).toLocaleString("ar-OM")
    : new Date(b.createdAt).toLocaleString("ar-OM");

  const body = `
${tplHeaderHtml(tpl, `فاتورة حجز / Booking #${String(b.id).slice(-6)}`, "")}
<tr><td class="cell info-cell">
  <div><b>الزبون / Customer:</b> ${b.customerName ?? "-"}</div>
  <div><b>الهاتف / Phone:</b> ${b.customerPhone ?? "-"}</div>
  <div><b>الطاولة / Table:</b> ${b.tableNumber}${b.tableCapacity ? ` (سعة ${b.tableCapacity} أشخاص)` : ""}</div>
  <div><b>التاريخ / Date:</b> ${b.date} • ${b.time ?? "-"}</div>
  <div><b>عدد الأشخاص / Guests:</b> ${b.guests}</div>
  <div><b>تاريخ الإصدار / Issued:</b> ${dateLabel}</div>
</td></tr>
<tr><td class="cell sec-title-cell">تفاصيل الحجز / Booking Details</td></tr>
<tr><td class="cell items-cell"><table class="items">
  <thead><tr><th>البيان<br>Item</th><th>المدة<br>Hours</th><th>السعر<br>Price</th></tr></thead>
  <tbody>
    <tr>
      <td>حجز طاولة ${b.tableNumber}<br>Table booking</td>
      <td style="text-align:center">${b.hours ?? "-"}</td>
      <td style="text-align:left">${total.toFixed(3)}</td>
    </tr>
  </tbody>
</table></td></tr>
<tr><td class="cell total-cell"><span class="lbl">الإجمالي / Total</span><span class="val">${total.toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة حجز / Booking #${String(b.id).slice(-6)}`, body);
}

// ── Menu Tab ──────────────────────────────────────────────────
const MENU_CATEGORIES: { value: string; label: string; Icon: any }[] = [
  { value: "مشروب ساخن",   label: "مشروبات ساخنة",  Icon: Coffee          },
  { value: "مشروبات باردة", label: "مشروبات باردة",  Icon: GlassWater      },
  { value: "طعام",         label: "طعام",           Icon: UtensilsCrossed },
  { value: "حلى",          label: "حلى",            Icon: Cookie          },
];
const DEFAULT_CATEGORY = MENU_CATEGORIES[0].value;
const MAX_IMAGE_BYTES = 600 * 1024; // 600KB cap on upload

type PromoMode = "none" | "discount" | "bundle";
type SizeRow   = { label: string; extraPrice: string };
type MenuForm = {
  name: string; price: string; category: string; description: string; image: string;
  promoMode: PromoMode;
  originalPrice: string;
  promoBuyQty: string;
  promoGetQty: string;
  stockQty: string;          // empty string = not tracked
  beans: string[];           // optional bean types (customer picks at order time)
  beansRequired: boolean;    // when true, customer MUST pick a bean
  sizes: SizeRow[];          // optional sizes with extra price (added to base)
  sizesRequired: boolean;    // when true, customer MUST pick a size
};
const emptyForm = (): MenuForm => ({
  name: "", price: "", category: DEFAULT_CATEGORY, description: "", image: "",
  promoMode: "none", originalPrice: "", promoBuyQty: "", promoGetQty: "",
  stockQty: "",
  beans: [],
  beansRequired: false,
  sizes: [],
  sizesRequired: false,
});

function menuStockStatus(item: { stockQty?: number | null; initialStockQty?: number | null }) {
  if (item.stockQty == null) return "untracked" as const;
  if (item.stockQty <= 0) return "depleted" as const;
  const denom = (item.initialStockQty && item.initialStockQty > 0) ? item.initialStockQty : item.stockQty;
  const ratio = item.stockQty / denom;
  if (ratio <= 0.25) return "critical" as const;
  if (ratio <= 0.5)  return "warning"  as const;
  return "ok" as const;
}

function MenuTab({ id }: { id: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm]   = useState<MenuForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgErr, setImgErr] = useState<string>("");
  // Temp input for the "add bean" chip-builder (kept local so typing doesn't
  // pollute the main form state until the user actually hits "إضافة").
  const [beanDraft, setBeanDraft] = useState<string>("");

  const addBean = () => {
    const t = beanDraft.trim();
    if (!t) return;
    setForm(p => p.beans.includes(t) ? p : ({ ...p, beans: [...p.beans, t] }));
    setBeanDraft("");
  };
  const removeBean = (idx: number) =>
    setForm(p => ({ ...p, beans: p.beans.filter((_, i) => i !== idx) }));
  const addSize = () =>
    setForm(p => ({ ...p, sizes: [...p.sizes, { label: "", extraPrice: "" }] }));
  const updateSize = (idx: number, patch: Partial<SizeRow>) =>
    setForm(p => ({ ...p, sizes: p.sizes.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  const removeSize = (idx: number) =>
    setForm(p => ({ ...p, sizes: p.sizes.filter((_, i) => i !== idx) }));

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
      // Stock: empty string = not tracked (null), otherwise integer >= 0
      let stockQty: number | null = null;
      if (form.stockQty.trim() !== "") {
        const sq = Math.floor(Number(form.stockQty));
        stockQty = (Number.isFinite(sq) && sq >= 0) ? sq : null;
      }
      // Beans: dedupe + drop empty
      const beans = Array.from(new Set(
        form.beans.map(b => b.trim()).filter(b => b.length > 0)
      ));
      // Sizes: keep only rows that have a non-empty label and a valid (≥0) extraPrice
      const sizes = form.sizes
        .map(s => ({ label: s.label.trim(), extraPrice: Number(s.extraPrice) }))
        .filter(s => s.label.length > 0 && Number.isFinite(s.extraPrice) && s.extraPrice >= 0);
      const body = {
        name: form.name,
        price,
        category: form.category,
        description: form.description,
        image: form.image || null,
        originalPrice,
        promoBuyQty,
        promoGetQty,
        stockQty,
        // Send `null` (not undefined) when cleared so PATCH sees the removal
        // and `normalizeVariants` on the server clears the field.
        beans: beans.length > 0 ? beans : null,
        beansRequired: beans.length > 0 ? !!form.beansRequired : false,
        sizes: sizes.length > 0 ? sizes : null,
        sizesRequired: sizes.length > 0 ? !!form.sizesRequired : false,
      };
      // Step 1: actually save the item. Any failure here = real save failure.
      try {
        if (editingId) {
          await api.updateMenuItem(id, editingId, body);
        } else {
          await api.addMenuItem(id, body);
        }
      } catch (err: any) {
        console.error("[menu save] save failed:", err);
        const msg = String(err?.message || err || "");
        if (msg.includes("413") || /too large|payload/i.test(msg)) {
          setFormErr("تعذّر الحفظ: حجم الصورة كبير جداً. جرّب صورة أصغر.");
        } else {
          setFormErr(`تعذّر حفظ المنتج: ${msg || "خطأ غير معروف"}`);
        }
        return; // keep form state so user can retry
      }
      // Step 2: reload list. If this fails the item IS saved, so don't
      // show an error — just log it and reset the form anyway.
      try {
        await load();
      } catch (reloadErr) {
        console.warn("[menu save] reload failed (item saved OK):", reloadErr);
      }
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
      stockQty: (item.stockQty != null) ? String(item.stockQty) : "",
      beans: Array.isArray(item.beans) ? [...item.beans] : [],
      beansRequired: !!item.beansRequired,
      sizes: Array.isArray(item.sizes)
        ? item.sizes.map((s: any) => ({ label: String(s.label ?? ""), extraPrice: String(s.extraPrice ?? 0) }))
        : [],
      sizesRequired: !!item.sizesRequired,
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
  const editStock = async (item: any) => {
    const cur = item.stockQty == null ? "" : String(item.stockQty);
    const v = typeof window !== "undefined"
      ? window.prompt(`الكمية المتوفرة لـ «${item.name}»\n(اتركه فارغاً للإلغاء؛ اكتب "-" للإلغاء التتبّع)`, cur)
      : null;
    if (v === null) return;
    let stockQty: number | null;
    if (v.trim() === "-" || v.trim() === "") {
      stockQty = null;
    } else {
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n) || n < 0) { alert("أدخل رقماً صحيحاً ≥ 0 أو - للإلغاء"); return; }
      stockQty = n;
    }
    await api.updateMenuItem(id, item.id, { stockQty });
    await load();
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgErr("");
    if (!file.type.startsWith("image/")) { setImgErr("الملف ليس صورة"); return; }
    // Auto-downscale large images: huge base64 payloads get rejected by
    // the Replit proxy with an empty 413 body, surfacing as a useless
    // "Error". Compressing to ≤1200px / JPEG 0.75 keeps the payload well
    // under proxy limits while staying sharp for the grid tile.
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = String(reader.result || "");
      if (!rawDataUrl) return;
      // Safe fallback: store the raw URL first so we never lose the pick.
      setForm(p => ({ ...p, image: rawDataUrl }));
      const img = new Image();
      img.onload = () => {
        try {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const MAX = 1200;
            const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1);
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.naturalWidth  * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL("image/jpeg", 0.75);
              if (compressed.length > 5000 && compressed.length < rawDataUrl.length) {
                setForm(p => ({ ...p, image: compressed }));
              }
            }
          }
        } catch { /* keep raw on failure */ }
      };
      img.onerror = () => { /* keep raw on failure */ };
      img.src = rawDataUrl;
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

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              الكمية المتوفرة (اختياري) <span className="text-[10px] font-normal">— اتركه فارغاً إذا كان غير محدود</span>
            </label>
            <Inp
              value={form.stockQty}
              onChange={(v: string) => setForm(p => ({ ...p, stockQty: v.replace(/[^0-9]/g, "") }))}
              placeholder="مثال: 30"
              type="number"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              عند تعيين كمية، ستظهر للزبون في التطبيق وسنُنبّهك تلقائياً عند 50% و25% والنفاد.
            </p>
          </div>

          {/* Image picker */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">صورة المنتج (اختياري — أي حجم مقبول)</label>
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
                <p className="text-[10px] text-muted-foreground">الصورة اختيارية — أي حجم مقبول</p>
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

          {/* ── Bean types (optional) ─────────────────────────── */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              ☕ أنواع البن (اختياري)
              <span className="text-[10px] font-normal"> — يقدر الزبون يختار النوع وقت الطلب</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={beanDraft}
                onChange={(e) => setBeanDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBean(); } }}
                placeholder="مثال: إثيوبي، كولومبي، برازيلي…"
                className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={addBean}
                disabled={!beanDraft.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-40"
              >
                <Plus size={14} className="inline -mt-0.5 mr-1" /> إضافة
              </button>
            </div>
            {form.beans.length > 0 && (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.beans.map((b, i) => (
                    <span key={`${b}-${i}`} className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold rounded-full pl-3 pr-2 py-1.5">
                      {b}
                      <button type="button" onClick={() => removeBean(i)} className="w-5 h-5 rounded-full bg-primary/20 hover:bg-red-500/30 hover:text-red-300 flex items-center justify-center" aria-label="حذف">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <label className="mt-2 inline-flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={form.beansRequired}
                    onChange={(e) => setForm(p => ({ ...p, beansRequired: e.target.checked }))}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-muted-foreground">
                    اختيار البن <b className="text-primary">إلزامي</b> عند الطلب
                    <span className="text-[10px] font-normal"> (لو ما اخترت → اختياري)</span>
                  </span>
                </label>
              </>
            )}
          </div>

          {/* ── Sizes (optional, with extra price) ────────────── */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              📏 الأحجام (اختياري)
              <span className="text-[10px] font-normal"> — السعر الإضافي يُضاف فوق السعر الأساسي</span>
            </label>
            {form.sizes.length === 0 && (
              <p className="text-[11px] text-muted-foreground/70 mb-2">لا توجد أحجام — اضغط «إضافة حجم» لإضافة أول حجم.</p>
            )}
            <div className="space-y-2">
              {form.sizes.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-primary/5 border border-primary/20">
                  <input
                    type="text"
                    value={s.label}
                    onChange={(e) => updateSize(i, { label: e.target.value })}
                    placeholder="اسم الحجم (مثال: صغير / وسط / كبير)"
                    className="col-span-6 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                  />
                  <div className="col-span-5 relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={s.extraPrice}
                      onChange={(e) => updateSize(i, { extraPrice: e.target.value.replace(/[^0-9.]/g, "") })}
                      placeholder="0.000"
                      className="w-full bg-card border border-border rounded-lg pl-3 pr-12 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">+OMR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSize(i)}
                    className="col-span-1 w-8 h-8 mx-auto rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 flex items-center justify-center"
                    aria-label="حذف الحجم"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addSize}
              className="mt-2 text-xs font-semibold text-primary hover:text-primary/80 inline-flex items-center gap-1"
            >
              <Plus size={13} /> إضافة حجم
            </button>
            {form.sizes.length > 0 && (
              <label className="mt-2 inline-flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={form.sizesRequired}
                  onChange={(e) => setForm(p => ({ ...p, sizesRequired: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-muted-foreground">
                  اختيار الحجم <b className="text-primary">إلزامي</b> عند الطلب
                  <span className="text-[10px] font-normal"> (لو ما اخترت → اختياري)</span>
                </span>
              </label>
            )}
            {form.sizes.length > 0 && form.price && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                السعر الأساسي: <b className="text-primary">{(+form.price).toFixed(3)} OMR</b>
                {" — "}
                مع الأحجام: {form.sizes.filter(s => s.label.trim()).map((s, i) => {
                  const ep = Number(s.extraPrice) || 0;
                  return <span key={i} className="ml-1 mr-1">{s.label.trim()} <b className="text-primary">{((+form.price) + ep).toFixed(3)}</b></span>;
                })}
              </p>
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

      {/* Stock alerts */}
      {(() => {
        const tracked = items.filter(i => i.stockQty != null);
        const depleted = tracked.filter(i => menuStockStatus(i) === "depleted");
        const critical = tracked.filter(i => menuStockStatus(i) === "critical");
        const warning  = tracked.filter(i => menuStockStatus(i) === "warning");
        if (depleted.length + critical.length + warning.length === 0) return null;
        return (
          <div className="space-y-2">
            {depleted.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl border bg-red-500/15 border-red-500/50 text-red-300">
                <XCircle size={16} className="mt-0.5"/>
                <div className="text-xs">
                  <p className="font-bold mb-0.5">منتجات نَفِدت — يرجى إعادة التعبئة</p>
                  <p className="opacity-90">{depleted.map(i => i.name).join(" • ")}</p>
                </div>
              </div>
            )}
            {critical.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl border bg-red-500/10 border-red-500/40 text-red-300">
                <AlertTriangle size={16} className="mt-0.5"/>
                <div className="text-xs">
                  <p className="font-bold mb-0.5">كميات قريبة من النفاد (≤ 25%) — أضف المزيد</p>
                  <p className="opacity-90">
                    {critical.map(i => `${i.name} (${i.stockQty}/${i.initialStockQty ?? i.stockQty})`).join(" • ")}
                  </p>
                </div>
              </div>
            )}
            {warning.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl border bg-yellow-500/15 border-yellow-500/40 text-yellow-300">
                <AlertTriangle size={16} className="mt-0.5"/>
                <div className="text-xs">
                  <p className="font-bold mb-0.5">كميات وصلت إلى النصف</p>
                  <p className="opacity-90">
                    {warning.map(i => `${i.name} (${i.stockQty}/${i.initialStockQty ?? i.stockQty})`).join(" • ")}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Items grouped by category (4 fixed sections — always visible) */}
      {MENU_CATEGORIES.map(({ value: cat, label, Icon }) => {
        const list = items.filter(i => i.category === cat);
        return (
          <Card key={cat} className="overflow-hidden">
            <div className="px-5 py-3 bg-muted/30 border-b border-border flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Icon size={15} className="text-primary" strokeWidth={2} />
              </span>
              <span className="font-semibold text-foreground text-sm">{label}</span>
              <span className="ms-auto text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                {list.length} منتج
              </span>
            </div>
            {list.length === 0 ? (
              <div className="px-5 py-6 text-center text-xs text-muted-foreground">
                لا توجد منتجات في هذا القسم بعد — اختر "{label}" من قائمة التصنيف عند إضافة منتج جديد.
              </div>
            ) : (
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
                      {item.originalPrice != null && item.originalPrice !== "" && Number.isFinite(Number(item.originalPrice)) && (
                        <span className="text-[10px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded">
                          🏷️ خصم من {Number(item.originalPrice).toFixed(3)} OMR
                        </span>
                      )}
                      {item.promoBuyQty && item.promoGetQty && (
                        <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded font-semibold">
                          🎁 اشترِ {item.promoBuyQty} احصل على {item.promoGetQty}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-primary font-bold text-sm whitespace-nowrap">{Number(item.price ?? 0).toFixed(3)} OMR</span>
                  {(() => {
                    const st = menuStockStatus(item);
                    if (st === "untracked") {
                      return (
                        <button onClick={() => editStock(item)} title="تعيين كمية"
                          className="text-[10px] px-2 py-1 rounded-lg font-medium border border-border text-muted-foreground hover:border-primary/40 hover:text-primary whitespace-nowrap">
                          ∞ غير محدود
                        </button>
                      );
                    }
                    const cls =
                      st === "depleted" ? "bg-red-500/20 text-red-400 border-red-500/40" :
                      st === "critical" ? "bg-red-500/15 text-red-300 border-red-500/30" :
                      st === "warning"  ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" :
                                          "bg-primary/15 text-primary border-primary/30";
                    return (
                      <button onClick={() => editStock(item)} title="تعديل الكمية"
                        className={`text-[10px] px-2 py-1 rounded-lg font-bold border whitespace-nowrap ${cls}`}>
                        {st === "depleted"
                          ? "نَفِد"
                          : <>متبقّي {item.stockQty}{item.initialStockQty ? ` / ${item.initialStockQty}` : ""}</>}
                      </button>
                    );
                  })()}
                  <button onClick={() => toggleAvail(item)} className={`text-xs px-2.5 py-1 rounded-lg font-medium ${item.available ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                    {item.available ? "متاح" : "غير متاح"}
                  </button>
                  <button onClick={() => startEdit(item)} title="تعديل" className="p-1.5 rounded-lg hover:bg-primary/15 text-primary"><Pencil size={14}/></button>
                  <button onClick={() => del(item.id)} title="حذف" className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
            )}
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
                  <span className="text-primary font-bold text-sm whitespace-nowrap">{Number(item.price ?? 0).toFixed(3)} OMR</span>
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
  /** Admin-defined fixed list of time slots customers can book at this table. */
  availableTimes: string[];
};
// Sensible default — covers the common 16-hour day in 1-hour intervals. The
// admin can toggle individual slots on/off in the form below; the customer
// app uses this same list as a fallback for legacy tables that don't have
// `availableTimes` set yet.
const DEFAULT_TIME_SLOTS = [
  "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];
const emptyTableForm = (): TableForm => ({
  number: "", capacity: "", image: "", hourlyPricing: [],
  availableTimes: DEFAULT_TIME_SLOTS.slice(),
});

// ── Per-date slot management modal ────────────────────────────
// Opens from each table card. Shows the table's `availableTimes` for the
// chosen date, with a status badge per slot (متاح / محجوز من زبون / مغلق من
// الإدارة) and a one-click toggle that calls the dedicated block/unblock
// endpoints. Booked slots cannot be force-blocked from here — the cafe must
// cancel that booking first via the bookings tab.
function SlotsModal({
  cafeId, table, onClose, onUpdated,
}: {
  cafeId: string;
  table: any;
  onClose: () => void;
  onUpdated: (updatedTable: any) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const slots: string[] = (Array.isArray(table.availableTimes) && table.availableTimes.length > 0)
    ? table.availableTimes
    : DEFAULT_TIME_SLOTS;

  const blockedSet = new Set(
    (Array.isArray(table.blockedSlots) ? table.blockedSlots : [])
      .filter((s: any) => s.date === date)
      .map((s: any) => s.time),
  );
  const bookedMap = new Map<string, any>();
  for (const b of bookings) {
    if (b.tableId === table.id && b.date === date && b.status !== "cancelled") {
      bookedMap.set(b.time, b);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.cafeBookings(cafeId)
      .then((d: any) => { if (!cancelled) setBookings(d.bookings ?? []); })
      .catch(() => { if (!cancelled) setBookings([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cafeId, date]);

  const toggle = async (time: string) => {
    if (bookedMap.has(time)) return; // can't block a booked slot from here
    setBusySlot(time);
    try {
      const isBlocked = blockedSet.has(time);
      const res = isBlocked
        ? await api.unblockTableSlot(cafeId, table.id, { date, time })
        : await api.blockTableSlot(cafeId, table.id, { date, time });
      onUpdated(res.table);
    } catch (e: any) {
      alert("تعذّر تحديث الحالة: " + (e?.message ?? ""));
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-foreground text-base">⏰ مواعيد طاولة {table.number}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              فعّل/أغلق أي وقت في هذا اليوم — الزبائن سيرونه مباشرة
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">📅 اختر التاريخ</label>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-6">جاري تحميل الحجوزات...</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-red-400 text-center py-6">
              لم تحدّد أي توقيت متاح لهذه الطاولة بعد — عدّل الطاولة أولاً
            </p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => {
                const isBlocked = blockedSet.has(slot);
                const booking = bookedMap.get(slot);
                const status = booking ? "booked" : isBlocked ? "blocked" : "available";
                return (
                  <div
                    key={slot}
                    className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${
                      status === "booked"
                        ? "border-yellow-500/40 bg-yellow-500/5"
                        : status === "blocked"
                          ? "border-red-500/40 bg-red-500/5"
                          : "border-green-500/40 bg-green-500/5"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground text-sm">{slot}</div>
                      <div className="text-[11px] mt-0.5">
                        {status === "available" && (
                          <span className="text-green-400 font-semibold">✅ متاح للحجز</span>
                        )}
                        {status === "blocked" && (
                          <span className="text-red-400 font-semibold">🚫 مغلق من الإدارة</span>
                        )}
                        {status === "booked" && (
                          <span className="text-yellow-500 font-semibold truncate block">
                            📋 محجوز — {booking.customerName} ({booking.status === "pending" ? "بانتظار التأكيد" : "مؤكّد"})
                          </span>
                        )}
                      </div>
                    </div>
                    {status !== "booked" ? (
                      <button
                        onClick={() => toggle(slot)}
                        disabled={busySlot === slot}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${
                          status === "blocked"
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        }`}
                      >
                        {busySlot === slot ? "..." : status === "blocked" ? "✅ افتح" : "🚫 أغلق"}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        من حجز عميل
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TablesTab({ id }: { id: string }) {
  const [tbls, setTbls]   = useState<any[]>([]);
  const [form, setForm]   = useState<TableForm>(emptyTableForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgErr, setImgErr] = useState<string>("");
  const [formErr, setFormErr] = useState<string>("");
  const [managingTable, setManagingTable] = useState<any | null>(null);

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

    // Hourly pricing is now MANDATORY — at least one tier with valid values.
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
    if (tiers.length === 0) {
      setFormErr("أسعار التواقيت مطلوبة — أضف على الأقل سعر ساعة واحدة");
      return;
    }
    tiers.sort((a, b) => a.hours - b.hours);

    setSaving(true);
    try {
      const body: any = {
        number: +form.number,
        capacity: +form.capacity,
        image: form.image || null,
        hourlyPricing: tiers,
        availableTimes: form.availableTimes,
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
      availableTimes: Array.isArray(t.availableTimes) && t.availableTimes.length > 0
        ? t.availableTimes.slice()
        : DEFAULT_TIME_SLOTS.slice(),
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
    // Image size cap removed for table images per request — any size accepted.
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
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">صورة الطاولة (اختياري — أي حجم مقبول)</label>
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
                <p className="text-[10px] text-muted-foreground">الصورة اختيارية — أي حجم مقبول</p>
                {imgErr && <p className="text-[11px] text-red-400">{imgErr}</p>}
              </div>
            </div>
          </div>

          {/* Available time slots */}
          <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/30">
            <label className="block text-xs font-semibold text-foreground mb-1">
              ⏰ التواقيت المتاحة للحجز
            </label>
            <p className="text-[10px] text-muted-foreground mb-2">
              اختر الأوقات التي تسمح للزبائن بالحجز فيها — سيرى الزبون فقط هذه الأوقات.
              يمكنك بعد ذلك إغلاق تواريخ محدّدة من زر "⏰ المواعيد" على بطاقة الطاولة.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_TIME_SLOTS.map((slot) => {
                const on = form.availableTimes.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        availableTimes: on
                          ? p.availableTimes.filter((s) => s !== slot)
                          : [...p.availableTimes, slot],
                      }))
                    }
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                      on
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-muted-foreground">
                {form.availableTimes.length} وقت محدّد
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, availableTimes: DEFAULT_TIME_SLOTS.slice() }))}
                  className="text-[10px] px-2 py-1 rounded-md text-primary hover:bg-primary/10 font-semibold"
                >
                  تحديد الكل
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, availableTimes: [] }))}
                  className="text-[10px] px-2 py-1 rounded-md text-red-400 hover:bg-red-500/10 font-semibold"
                >
                  مسح الكل
                </button>
              </div>
            </div>
            {form.availableTimes.length === 0 && (
              <p className="text-[11px] text-red-400 mt-2">
                ⚠️ لم تختر أي وقت — لن يتمكّن الزبائن من الحجز على هذه الطاولة
              </p>
            )}
          </div>

          {/* Hourly pricing tiers */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-semibold text-foreground">⏱️ أسعار التواقيت <span className="text-red-400">*</span></label>
                <p className="text-[10px] text-muted-foreground mt-0.5">مطلوب — عدد الساعات والسعر المقابل لها (الزبون يختار من بين هذه التسعيرات)</p>
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
              <p className="text-[11px] text-red-400 text-center py-2">⚠️ مطلوب — اضغط "إضافة سعر" لبدء التسعير</p>
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
            <button
              onClick={() => setManagingTable(t)}
              className="w-full mt-2 px-2 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-[11px] font-bold flex items-center justify-center gap-1"
            >
              <Clock size={12} /> إدارة المواعيد
            </button>
          </Card>
        ))}
      </div>

      {managingTable && (
        <SlotsModal
          cafeId={id}
          table={managingTable}
          onClose={() => setManagingTable(null)}
          onUpdated={(updated) => {
            setTbls((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setManagingTable(updated);
          }}
        />
      )}
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
  let cashTotal = 0;
  let visaTotal = 0;
  let unspecifiedTotal = 0;
  let cashCount = 0;
  let visaCount = 0;
  let unspecifiedCount = 0;
  let freeTotal = 0;   // المبلغ الإجمالي المجاني (المتنازَل عنه)
  let freeCount = 0;
  for (const o of inRange) {
    const amt = Number(o.total) || 0;
    const pm = String(o.paymentMethod ?? "").toLowerCase();
    if (pm === "free") {
      // الحساب مجاناً → لا يُحتسب في الإيرادات لكن يُتتبَّع كقيمة متنازَل عنها.
      freeTotal += amt; freeCount++;
    } else {
      total += amt;
      if (pm === "split") {
        // مدفوع بشكل مقسوم: نُوزِّع المبلغ بدقة على كاش/فيزا حسب ما أدخله الكاشير.
        // العدّاد يحسب طلباً واحداً لكل قناة استُخدمت فيها.
        const c = Number(o.cashAmount) || 0;
        const v = Number(o.visaAmount) || 0;
        cashTotal += c; if (c > 0) cashCount++;
        visaTotal += v; if (v > 0) visaCount++;
      } else if (pm === "cash") {
        // إذا كان الكاشير سجَّل مبلغاً صريحاً نأخذه؛ وإلا الإجمالي.
        cashTotal += (Number(o.cashAmount) || amt); cashCount++;
      } else if (pm === "visa") {
        visaTotal += (Number(o.visaAmount) || amt); visaCount++;
      } else {
        unspecifiedTotal += amt; unspecifiedCount++;
      }
    }
    for (const it of (o.items ?? [])) {
      const cat = classifyItem(String(it.name ?? ""), it.category);
      byCat[cat] ??= { qty: 0, amount: 0 };
      byCat[cat].qty += Number(it.qty) || 0;
      byCat[cat].amount += (Number(it.qty) || 0) * (Number(it.price) || 0);
    }
  }
  return { inRange, byCat, total, cashTotal, visaTotal, unspecifiedTotal, cashCount, visaCount, unspecifiedCount, freeTotal, freeCount };
}

// Render the cash / visa / unspecified / complimentary breakdown rows for an aggregated invoice.
function paymentBreakdownRows(opts: { cashTotal: number; visaTotal: number; unspecifiedTotal: number; cashCount: number; visaCount: number; unspecifiedCount: number; freeTotal: number; freeCount: number }) {
  const { cashTotal, visaTotal, unspecifiedTotal, cashCount, visaCount, unspecifiedCount, freeTotal, freeCount } = opts;
  return `
<tr><td class="cell sec-title-cell">طريقة الدفع / Payment Method</td></tr>
<tr><td class="cell row-cell"><span class="lbl">💵 كاش / Cash (${cashCount})</span><span class="val">${cashTotal.toFixed(3)} ر.ع / OMR</span></td></tr>
<tr><td class="cell row-cell"><span class="lbl">💳 فيزا / Visa (${visaCount})</span><span class="val">${visaTotal.toFixed(3)} ر.ع / OMR</span></td></tr>
${freeCount > 0 ? `<tr><td class="cell row-cell"><span class="lbl">🎁 الحساب مجاناً / On the House (${freeCount})</span><span class="val">− ${freeTotal.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
${unspecifiedCount > 0 ? `<tr><td class="cell row-cell"><span class="lbl">— غير محدد / Unspecified (${unspecifiedCount})</span><span class="val">${unspecifiedTotal.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
`;
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
  const [{ orders }, { expenses }, bk, gv] = await Promise.all([
    api.cafeOrders(id),
    api.expenses(id).catch(() => ({ expenses: [] })),
    api.cafeBookings(id).catch(() => ({ bookings: [] })),
    api.giftVouchers(id).catch(() => ({ vouchers: [] })),
  ]);
  return {
    orders:    orders   ?? [],
    expenses:  expenses ?? [],
    bookings:  bk?.bookings ?? [],
    vouchers:  gv?.vouchers ?? [],
  };
}

// Aggregate confirmed gift vouchers within a date window. Only "confirmed"
// vouchers count toward revenue (matches what the server stores as an Invoice
// on confirmation). Timestamp used is `confirmedAt` if present, otherwise
// falls back to `paidAt` / `createdAt`.
function aggregateVouchers(voucherList: any[], from: Date, to: Date) {
  const inRange = voucherList.filter(v => {
    if (v.status !== "confirmed") return false;
    const ts = v.confirmedAt ?? v.paidAt ?? v.createdAt;
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const total = inRange.reduce((s, v) => s + (Number(v.amount) || 0), 0);
  return { inRange, total };
}

function vouchersBlockHtml(v: { inRange: any[]; total: number }, label: string) {
  if (v.inRange.length === 0) return "";
  const rows = v.inRange.map(x =>
    `<tr><td>#${String(x.id).slice(-5)}</td><td>${x.senderName ?? "-"}</td><td>${x.recipientName ?? "-"}</td><td style="font-size:9.5px">${fmtDateTimeAr(x.confirmedAt ?? x.paidAt ?? x.createdAt)}</td><td style="text-align:left">${(Number(x.amount) || 0).toFixed(3)}</td></tr>`
  ).join("");
  return `
<tr><td class="cell sec-title-cell">قسائم شرائية / Gift Vouchers (${label})</td></tr>
<tr><td class="cell items-cell"><table class="items">
  <thead><tr><th>رقم<br>No.</th><th>المُرسِل<br>Sender</th><th>المُستلِم<br>Recipient</th><th>الوقت<br>Time</th><th>المبلغ<br>Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table></td></tr>
<tr><td class="cell row-cell"><span class="lbl">إجمالي القسائم / Vouchers Total (${v.inRange.length})</span><span class="val">${v.total.toFixed(3)} ر.ع / OMR</span></td></tr>
`;
}

// Aggregate confirmed bookings within a date window. Only "confirmed" bookings
// count toward revenue (matches what the server stores as an Invoice on
// confirmation). The timestamp used is `confirmedAt` if present, otherwise the
// booking's `createdAt`.
function aggregateBookings(bookingList: any[], from: Date, to: Date) {
  const inRange = bookingList.filter(b => {
    if (b.status !== "confirmed") return false;
    const t = new Date(b.confirmedAt ?? b.createdAt).getTime();
    return t >= from.getTime() && t < to.getTime();
  });
  const total = inRange.reduce((s, b) => s + (Number(b.totalPrice) || 0), 0);
  const totalGuests = inRange.reduce((s, b) => s + (Number(b.guests) || 0), 0);
  const totalHours  = inRange.reduce((s, b) => s + (Number(b.hours)  || 0), 0);
  return { inRange, total, totalGuests, totalHours };
}

function bookingsBlockHtml(b: { inRange: any[]; total: number; totalGuests: number; totalHours: number }, label: string) {
  if (b.inRange.length === 0) return "";
  const rows = b.inRange.map(x =>
    `<tr><td>#${String(x.id).slice(-5)}</td><td>${x.customerName ?? "-"}</td><td style="text-align:center">${x.tableNumber}</td><td style="text-align:center">${x.hours ?? "-"}س</td><td style="text-align:center">${x.guests ?? "-"}</td><td style="text-align:left">${(Number(x.totalPrice) || 0).toFixed(3)}</td></tr>`
  ).join("");
  return `
<tr><td class="cell sec-title-cell">حجوزات الطاولات / Table Bookings (${label})</td></tr>
<tr><td class="cell items-cell"><table class="items">
  <thead><tr><th>رقم<br>No.</th><th>الزبون<br>Customer</th><th>الطاولة<br>Tbl</th><th>المدة<br>Hrs</th><th>الأشخاص<br>Pax</th><th>المبلغ<br>Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table></td></tr>
<tr><td class="cell row-cell"><span class="lbl">إجمالي الحجوزات / Bookings Total (${b.inRange.length})</span><span class="val">${b.total.toFixed(3)} ر.ع / OMR</span></td></tr>
`;
}

function fmtDateAr(d: Date) { return d.toLocaleDateString("ar-OM"); }
function fmtDateTimeAr(d: string) {
  return new Date(d).toLocaleString("ar-OM", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

async function printOrderInvoice(
  id: string,
  o: any,
  freeCoffee?: { code: string; itemName: string; itemPrice: number } | null,
  opts?: { customerCopy?: boolean },
) {
  const isCustomerCopy = !!opts?.customerCopy;
  let tpl: any = null;
  try { tpl = (await api.invoiceTemplate(id, "order")).template; } catch { /* fallback */ }

  // Build a per-item-name count of free cups so we can annotate the items list
  // with how many cups of each item were redeemed via free coffee.
  // Source of truth is the order object itself (o.freeCoffeeRedemptions[]),
  // with a fallback to the legacy single-coffee `freeCoffee` arg for old paths.
  const orderRedemptions: Array<{ code: string; itemName: string; itemPrice: number; level?: number }> =
    Array.isArray(o.freeCoffeeRedemptions) && o.freeCoffeeRedemptions.length > 0
      ? o.freeCoffeeRedemptions
      : (freeCoffee ? [{ code: freeCoffee.code, itemName: freeCoffee.itemName, itemPrice: freeCoffee.itemPrice }] : []);
  const freeCountByName = new Map<string, number>();
  for (const r of orderRedemptions) {
    freeCountByName.set(r.itemName, (freeCountByName.get(r.itemName) ?? 0) + 1);
  }

  const rows = (o.items ?? []).map((it: any) => {
    const freeN = freeCountByName.get(it.name) ?? 0;
    const freeNote = freeN > 0
      ? `<div style="margin-top:3px;color:#000;font-weight:bold">🎁 منها ${freeN} مجاني (كوفي مكافأة) / ${freeN} free</div>`
      : "";
    const variantBits: string[] = [];
    if (it.selectedBean) variantBits.push(`☕ ${it.selectedBean}`);
    if (it.selectedSize) variantBits.push(`📏 ${it.selectedSize}`);
    const variantNote = variantBits.length > 0
      ? `<div style="margin-top:3px;color:#000;font-weight:bold">${variantBits.join(" • ")}</div>`
      : "";
    const hasOrigPrice = Number(it.originalPrice) > 0 && Number(it.originalPrice) > Number(it.price);
    const oldPriceCell = hasOrigPrice
      ? `<div style="color:#000;font-weight:bold;text-decoration:line-through">${(Number(it.originalPrice) * it.qty).toFixed(3)}</div>`
      : "";
    const promoNote = (Number(it.bonusQty) > 0)
      ? `<div style="margin-top:3px;color:#000;font-weight:bold">🎁 +${it.bonusQty} مجاني (عرض اشترِ ${it.promoBuyQty} احصل على ${it.promoGetQty}) — الإجمالي ${Number(it.qty) + Number(it.bonusQty)} كوب</div>`
      : "";
    const qtyCell = (Number(it.bonusQty) > 0)
      ? `×${it.qty} <span style="color:#000;font-weight:bold">(+${it.bonusQty})</span>`
      : `×${it.qty}`;
    return `<tr><td>${it.name}${variantNote}${promoNote}${freeNote}</td><td style="text-align:center">${qtyCell}</td><td style="text-align:left">${oldPriceCell}${(it.price * it.qty).toFixed(3)}</td></tr>`;
  }).join("");
  const isDirect = o.source === "direct";
  const where = isDirect
    ? "طلب مباشر من الكوفي / Direct in-cafe order"
    : (o.type === "dine"
        ? `طاولة / Table ${o.tableNumber}`
        : `سيارة / Car: ${o.plateNumber} ${o.plateSymbol ?? ""}`);

  // Pricing breakdown — prefer the persisted order fields when available
  // (new flow), otherwise fall back to legacy single-coffee math.
  const subtotal      = Number(o.subtotal ?? o.total ?? 0);
  const discountAmt   = Number(o.discountAmount ?? 0);
  const discountCode  = o.discountCode as string | undefined;
  const discountPct   = o.discountPercent as number | undefined;
  const freeAmtFromOrder = Number(o.freeCoffeeDiscount ?? 0);
  const legacyFreeAmt    = freeCoffee ? Number(freeCoffee.itemPrice ?? 0) : 0;
  const freeAmt       = orderRedemptions.length > 0
    ? (freeAmtFromOrder > 0 ? freeAmtFromOrder : orderRedemptions.reduce((s, r) => s + Number(r.itemPrice || 0), 0))
    : legacyFreeAmt;
  const isComplimentary = o.paymentMethod === "free";
  const baseFinalTot   = typeof o.total === "number"
    ? Math.max(0, Number(o.total) - (orderRedemptions.length === 0 ? legacyFreeAmt : 0))
    : Math.max(0, subtotal - discountAmt - freeAmt);
  // الحساب مجاناً → الكوفي تكفّل بكامل المبلغ المتبقي.
  const compAmt   = isComplimentary ? baseFinalTot : 0;
  const finalTot  = isComplimentary ? 0 : baseFinalTot;

  const redemptionRows = orderRedemptions.map(r =>
    `<div>• <b>${r.itemName}</b> — كود/Code <span style="font-family:monospace">${r.code}</span> — − ${Number(r.itemPrice || 0).toFixed(3)} ر.ع / OMR</div>`
  ).join("");

  const freeBlock = orderRedemptions.length > 0 ? `
<tr><td class="cell sec-title-cell">🎁 كوفي مجاني مُستخدَم / Free Coffee Redeemed</td></tr>
<tr><td class="cell info-cell">
  ${redemptionRows}
  <div style="margin-top:6px"><b>إجمالي الخصم / Total saved:</b> − ${freeAmt.toFixed(3)} ر.ع / OMR</div>
</td></tr>
` : "";

  const compBlock = isComplimentary ? `
<tr><td class="cell sec-title-cell">🎁 الحساب مجاناً / On the House</td></tr>
<tr><td class="cell info-cell" style="text-align:center;font-weight:bold">
  هذا الطلب على حساب الكوفي — لا يوجد مبلغ مستحق.<br>
  This order is complimentary — no amount due.
</td></tr>
` : "";

  const summaryBlock = (orderRedemptions.length > 0 || discountAmt > 0 || isComplimentary) ? `
<tr><td class="cell row-cell"><span class="lbl">الإجمالي قبل الخصم / Subtotal</span><span class="val">${subtotal.toFixed(3)} ر.ع / OMR</span></td></tr>
${discountAmt > 0 ? `<tr><td class="cell row-cell"><span class="lbl">خصم${discountCode ? ` (${discountCode}${discountPct ? ` ${discountPct}%` : ""})` : ""} / Discount</span><span class="val">− ${discountAmt.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
${freeAmt > 0 ? `<tr><td class="cell row-cell"><span class="lbl">خصم الكوفي المجاني / Free coffee</span><span class="val">− ${freeAmt.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
${compAmt > 0 ? `<tr><td class="cell row-cell"><span class="lbl">🎁 الحساب مجاناً / On the House</span><span class="val">− ${compAmt.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
` : "";

  const cashAmt2 = Number(o.cashAmount) || 0;
  const visaAmt2 = Number(o.visaAmount) || 0;
  const payLabel = o.paymentMethod === "cash"  ? `💵 كاش / Cash${cashAmt2 > 0 ? ` — ${cashAmt2.toFixed(3)} ر.ع` : ""}`
                 : o.paymentMethod === "visa"  ? `💳 فيزا / Visa${visaAmt2 > 0 ? ` — ${visaAmt2.toFixed(3)} ر.ع` : ""}`
                 : o.paymentMethod === "split" ? `💵 كاش ${cashAmt2.toFixed(3)} + 💳 فيزا ${visaAmt2.toFixed(3)} ر.ع / Split`
                 : o.paymentMethod === "free"  ? "🎁 الحساب مجاناً / On the House"
                 : "—";
  // تفصيل قناتي الدفع (يظهر فقط عند التقسيم) — يُضاف داخل خانة بيانات الطلب.
  const splitBreakdownHtml = o.paymentMethod === "split" ? `
  <div style="margin-top:1mm;padding:1mm 2mm;border:1px dashed #000">
    <div><b>تفصيل الدفع / Payment Split:</b></div>
    <div>💵 كاش / Cash: ${cashAmt2.toFixed(3)} ر.ع / OMR</div>
    <div>💳 فيزا / Visa: ${visaAmt2.toFixed(3)} ر.ع / OMR</div>
  </div>` : "";

  const titlePrefix = isCustomerCopy ? "نسخة الزبون / Customer Copy — " : "";
  const customerCopyBanner = isCustomerCopy ? `
<tr><td class="cell info-cell" style="text-align:center;border:2px dashed #b8860b;background:#fff8e7">
  <div style="font-weight:bold;font-size:13px;color:#000">📄 نسخة الزبون / Customer Copy</div>
  <div style="font-size:10.5px;color:#000;margin-top:1mm">
    هذه نسخة للزبون فقط — غير محتسبة في فواتير الكوفي.<br>
    Customer copy only — not counted in cafe invoices.
  </div>
</td></tr>` : "";
  const body = `
${tplHeaderHtml(tpl, `${titlePrefix}فاتورة طلب / Order #${o.id?.slice(-6)}`, "")}
${customerCopyBanner}
<tr><td class="cell info-cell">
  <div><b>الزبون / Customer:</b> ${o.customerName}${o.customerNameEn ? ` <span style="direction:ltr;display:inline-block">(${o.customerNameEn})</span>` : ""}</div>
  ${isDirect
    ? `<div style="margin-top:1mm;padding:1mm 2mm;border:1px dashed #000;text-align:center;font-weight:bold">☕ طلب مباشر من الكوفي / Direct in-cafe order</div>`
    : `<div><b>الهاتف / Phone:</b> ${o.customerPhone}</div>
  <div><b>المكان / Location:</b> ${where}</div>`}
  <div><b>التاريخ / Date:</b> ${new Date(o.createdAt).toLocaleString("ar-OM")}</div>
  <div><b>طريقة الدفع / Payment:</b> ${payLabel}</div>
  ${splitBreakdownHtml}
</td></tr>
<tr><td class="cell sec-title-cell">تفاصيل الطلب / Order Details</td></tr>
<tr><td class="cell items-cell"><table class="items"><thead><tr><th>الصنف<br>Item</th><th>كمية<br>Qty</th><th>السعر<br>Price</th></tr></thead><tbody>${rows}</tbody></table></td></tr>
${o.notes ? `<tr><td class="cell info-cell"><div><b>ملاحظات / Notes:</b></div><div style="white-space:pre-wrap">${String(o.notes).replace(/[<>&]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</div></td></tr>` : ""}
${freeBlock}
${compBlock}
${summaryBlock}
<tr><td class="cell total-cell"><span class="lbl">الإجمالي / Total</span><span class="val">${finalTot.toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`${titlePrefix}فاتورة طلب / Order #${o.id?.slice(-6)}`, body);
}

async function printDailyInvoice(id: string, dateStr: string): Promise<{ from: Date; to: Date; count: number }> {
  const tpl = (await api.invoiceTemplate(id, "daily").catch(() => ({ template: null }))).template;
  const { orders, bookings, vouchers } = await loadAggData(id);
  const from = new Date(dateStr + "T00:00:00");
  const to   = new Date(from); to.setDate(to.getDate() + 1);
  const agg = aggregateOrders(orders, from, to);
  const { inRange, byCat, total } = agg;
  const bookAgg    = aggregateBookings(bookings, from, to);
  const voucherAgg = aggregateVouchers(vouchers, from, to);
  const grandTotal = total + bookAgg.total + voucherAgg.total;

  const ordersRows = inRange.map(o => {
    const pm = o.paymentMethod === "cash" ? "💵"
             : o.paymentMethod === "visa" ? "💳"
             : "—";
    return `<tr><td>#${o.id.slice(-5)}</td><td>${o.customerName ?? "-"}</td><td style="font-size:9.5px">${fmtDateTimeAr(o.createdAt)}</td><td style="text-align:center">${pm}</td><td style="text-align:left">${(Number(o.total)||0).toFixed(3)}</td></tr>`;
  }).join("");
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");

  const body = `
${tplHeaderHtml(tpl, "الفاتورة اليومية / Daily Invoice", `${fmtDateAr(from)}`)}
<tr><td class="cell info-cell">
  <div><b>عدد الطلبات / Orders:</b> ${inRange.length}</div>
</td></tr>
<tr><td class="cell sec-title-cell">جميع الطلبات / All Orders</td></tr>
<tr><td class="cell items-cell">${inRange.length === 0
  ? `<div class="empty-inner">لا توجد طلبات / No orders</div>`
  : `<table class="items"><thead><tr><th>رقم<br>No.</th><th>الزبون<br>Customer</th><th>الوقت<br>Time</th><th>الدفع<br>Pay</th><th>المبلغ<br>Amount</th></tr></thead><tbody>${ordersRows}</tbody></table>`}</td></tr>
<tr><td class="cell sec-title-cell">المجموع حسب التصنيف / Totals by Category</td></tr>
<tr><td class="cell items-cell">${Object.keys(byCat).length === 0
  ? `<div class="empty-inner">لا يوجد / None</div>`
  : `<table class="items"><thead><tr><th>التصنيف<br>Category</th><th>الكمية<br>Qty</th><th>المبلغ<br>Amount</th></tr></thead><tbody>${catRows}</tbody></table>`}</td></tr>
${paymentBreakdownRows(agg)}
<tr><td class="cell row-cell"><span class="lbl">مبيعات الطلبات / Orders Revenue</span><span class="val">${total.toFixed(3)} ر.ع / OMR</span></td></tr>
${bookingsBlockHtml(bookAgg, "اليوم / Today")}
${vouchersBlockHtml(voucherAgg, "اليوم / Today")}
<tr><td class="cell total-cell"><span class="lbl">إجمالي اليوم / Daily Total</span><span class="val">${grandTotal.toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة يومية / Daily ${dateStr}`, body);
  return { from, to, count: inRange.length + bookAgg.inRange.length };
}

async function printMonthlyInvoice(id: string, year: number, month: number) {
  const tpl = (await api.invoiceTemplate(id, "monthly").catch(() => ({ template: null }))).template;
  const { orders, expenses, bookings, vouchers } = await loadAggData(id);
  const from = new Date(year, month - 1, 1);
  const to   = new Date(year, month,     1);
  const agg = aggregateOrders(orders, from, to);
  const { inRange: ordersIn, byCat, total: ordersTotal } = agg;
  const { total: expTotal } = aggregateExpenses(expenses, from, to);
  const bookAgg    = aggregateBookings(bookings, from, to);
  const voucherAgg = aggregateVouchers(vouchers, from, to);
  const revenue = ordersTotal + bookAgg.total + voucherAgg.total;
  const net = revenue - expTotal;
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");
  const monthName = from.toLocaleDateString("ar-OM", { month: "long", year: "numeric" });

  const body = `
${tplHeaderHtml(tpl, "الفاتورة الشهرية / Monthly Invoice", `${monthName}`)}
<tr><td class="cell info-cell">
  <div><b>الفترة / Period:</b> ${fmtDateAr(from)} — ${fmtDateAr(new Date(to.getTime()-1))}</div>
  <div><b>عدد الطلبات / Orders:</b> ${ordersIn.length}</div>
</td></tr>
<tr><td class="cell sec-title-cell">المبالغ حسب التصنيف / Amounts by Category</td></tr>
<tr><td class="cell items-cell">${Object.keys(byCat).length === 0
  ? `<div class="empty-inner">لا يوجد / None</div>`
  : `<table class="items"><thead><tr><th>التصنيف<br>Category</th><th>الكمية<br>Qty</th><th>المبلغ<br>Amount</th></tr></thead><tbody>${catRows}</tbody></table>`}</td></tr>
${paymentBreakdownRows(agg)}
<tr><td class="cell row-cell"><span class="lbl">مبيعات الطلبات / Orders Revenue</span><span class="val">${ordersTotal.toFixed(3)} ر.ع / OMR</span></td></tr>
${bookingsBlockHtml(bookAgg, monthName)}
${vouchersBlockHtml(voucherAgg, monthName)}
<tr><td class="cell row-cell"><span class="lbl">إجمالي الإيرادات / Total Revenue</span><span class="val">${revenue.toFixed(3)} ر.ع / OMR</span></td></tr>
${expTotal > 0 ? `<tr><td class="cell row-cell"><span class="lbl">إجمالي المصاريف / Expenses</span><span class="val">− ${expTotal.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
<tr><td class="cell total-cell"><span class="lbl">الصافي / Net</span><span class="val">${net.toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة شهرية / Monthly ${year}-${String(month).padStart(2,"0")}`, body);
}

async function printYearlyInvoice(id: string, year: number) {
  const tpl = (await api.invoiceTemplate(id, "yearly").catch(() => ({ template: null }))).template;
  const { orders, expenses, bookings, vouchers } = await loadAggData(id);
  const from = new Date(year, 0, 1);
  const to   = new Date(year + 1, 0, 1);
  const agg = aggregateOrders(orders, from, to);
  const { inRange: ordersIn, byCat, total: ordersTotal } = agg;
  const { total: expTotal } = aggregateExpenses(expenses, from, to);
  const bookAgg    = aggregateBookings(bookings, from, to);
  const voucherAgg = aggregateVouchers(vouchers, from, to);
  const revenue = ordersTotal + bookAgg.total + voucherAgg.total;
  const net = revenue - expTotal;
  const catRows = Object.entries(byCat).map(([k, v]) =>
    `<tr><td>${k}</td><td style="text-align:center">${v.qty}</td><td style="text-align:left">${v.amount.toFixed(3)}</td></tr>`
  ).join("");

  const body = `
${tplHeaderHtml(tpl, "الفاتورة السنوية / Yearly Invoice", `سنة / Year ${year}`)}
<tr><td class="cell info-cell">
  <div><b>الفترة / Period:</b> ${fmtDateAr(from)} — ${fmtDateAr(new Date(to.getTime()-1))}</div>
  <div><b>عدد الطلبات / Orders:</b> ${ordersIn.length}</div>
</td></tr>
<tr><td class="cell sec-title-cell">المبالغ حسب التصنيف / Amounts by Category</td></tr>
<tr><td class="cell items-cell">${Object.keys(byCat).length === 0
  ? `<div class="empty-inner">لا يوجد / None</div>`
  : `<table class="items"><thead><tr><th>التصنيف<br>Category</th><th>الكمية<br>Qty</th><th>المبلغ<br>Amount</th></tr></thead><tbody>${catRows}</tbody></table>`}</td></tr>
${paymentBreakdownRows(agg)}
<tr><td class="cell row-cell"><span class="lbl">مبيعات الطلبات / Orders Revenue</span><span class="val">${ordersTotal.toFixed(3)} ر.ع / OMR</span></td></tr>
${bookingsBlockHtml(bookAgg, `سنة / Year ${year}`)}
${vouchersBlockHtml(voucherAgg, `سنة / Year ${year}`)}
<tr><td class="cell row-cell"><span class="lbl">إجمالي الإيرادات / Total Revenue</span><span class="val">${revenue.toFixed(3)} ر.ع / OMR</span></td></tr>
${expTotal > 0 ? `<tr><td class="cell row-cell"><span class="lbl">إجمالي المصاريف / Expenses</span><span class="val">− ${expTotal.toFixed(3)} ر.ع / OMR</span></td></tr>` : ""}
<tr><td class="cell total-cell"><span class="lbl">الصافي السنوي / Yearly Net</span><span class="val">${net.toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة سنوية / Yearly ${year}`, body);
}

async function printExpenseInvoice(id: string, exp: any) {
  const tpl = (await api.invoiceTemplate(id, "expense").catch(() => ({ template: null }))).template;
  const body = `
${tplHeaderHtml(tpl, `فاتورة مصروف / Expense #${exp.id?.slice(-5)}`, "")}
<tr><td class="cell info-cell">
  <div><b>التاريخ / Date:</b> ${exp.date}</div>
  <div><b>التصنيف / Category:</b> ${exp.category}</div>
</td></tr>
<tr><td class="cell sec-title-cell">تفاصيل المصروف / Expense Details</td></tr>
<tr><td class="cell items-cell"><table class="items"><thead><tr><th>البيان<br>Item</th><th>التصنيف<br>Category</th><th>المبلغ<br>Amount</th></tr></thead><tbody>
  <tr><td>${exp.title}</td><td>${exp.category}</td><td style="text-align:left">${(Number(exp.amount)||0).toFixed(3)}</td></tr>
</tbody></table></td></tr>
${exp.notes ? `<tr><td class="cell info-cell"><b>ملاحظات / Notes:</b> ${exp.notes}</td></tr>` : ""}
<tr><td class="cell total-cell"><span class="lbl">المجموع / Total</span><span class="val">${(Number(exp.amount)||0).toFixed(3)} ر.ع / OMR</span></td></tr>
${tplFooterHtml(tpl)}
  `;
  openPrintWindow(`فاتورة مصروف / Expense #${exp.id?.slice(-5)}`, body);
}

// ── Invoices Tab (daily / monthly / yearly print) ────────────
function InvoicesTab({ id }: { id: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date,  setDate]  = useState<string>(today);
  const [month, setMonth] = useState<string>(today.slice(0, 7));
  const [year,  setYear]  = useState<string>(String(new Date().getFullYear()));
  const [recent, setRecent] = useState<any[]>([]);
  // Date-range filter for "آخر الفواتير المسجلة" — list stays empty until the
  // admin picks both ends of the window, so the page is not flooded with
  // every invoice ever generated.
  const [recFrom, setRecFrom] = useState<string>("");
  const [recTo,   setRecTo]   = useState<string>("");
  // Selected invoice for the details modal.
  const [selected, setSelected] = useState<any | null>(null);
  useEffect(() => { api.cafeInvoices(id).then(d => setRecent(d.invoices ?? [])).catch(() => {}); }, [id]);

  // Filter recent invoices by the selected from/to window. We require BOTH
  // ends to be set; if either is missing we render an empty state telling
  // the admin to pick a range first.
  const recRangeReady = !!recFrom && !!recTo;
  const recFiltered = (() => {
    if (!recRangeReady) return [];
    const s = new Date(recFrom + "T00:00:00").getTime();
    const e = new Date(recTo + "T00:00:00").getTime() + 24 * 60 * 60 * 1000;
    return recent
      .filter(inv => {
        const t = new Date(inv.createdAt).getTime();
        return Number.isFinite(t) && t >= s && t < e;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  })();
  const recTotal = recFiltered.reduce((s, i) => s + (Number(i.total) || 0), 0);

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
            <button onClick={async () => {
              const result = await printDailyInvoice(id, date);
              if (result.count === 0) return;
              const ok = window.confirm(
                `تم استخراج الفاتورة اليومية (${result.count} طلب).\nهل تريد حذف هذه الطلبات من قائمة الطلبات؟`
              );
              if (!ok) return;
              try {
                await api.cafeOrdersClear(id, result.from.toISOString(), result.to.toISOString());
                window.dispatchEvent(new CustomEvent("orders:cleared"));
              } catch {
                alert("تعذّر حذف الطلبات. حاول مرة أخرى.");
              }
            }}
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

      <PrintedInvoices id={id} />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Receipt size={18}/>
          </div>
          <div>
            <p className="font-semibold text-foreground">آخر الفواتير المسجلة</p>
            <p className="text-xs text-muted-foreground">حدد نطاق التاريخ لعرض الفواتير، واضغط على أي فاتورة لرؤية تفاصيلها</p>
          </div>
        </div>

        {/* From / To date range */}
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>من / From</span>
            <input type="date" value={recFrom} onChange={e => setRecFrom(e.target.value)}
              className="bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>إلى / To</span>
            <input type="date" value={recTo} onChange={e => setRecTo(e.target.value)}
              className="bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
          </label>
          {(recFrom || recTo) && (
            <button onClick={() => { setRecFrom(""); setRecTo(""); }}
              className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/30">
              مسح / Clear
            </button>
          )}
        </div>

        {recRangeReady && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
              <p className="text-[11px] text-muted-foreground">عدد الفواتير / Count</p>
              <p className="text-xl font-bold text-primary">{recFiltered.length}</p>
            </div>
            <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
              <p className="text-[11px] text-muted-foreground">المجموع / Total</p>
              <p className="text-xl font-bold text-primary">{recTotal.toFixed(3)} <span className="text-xs">OMR</span></p>
            </div>
          </div>
        )}

        {!recRangeReady ? (
          <Empty icon="📅" text="اختر تاريخ البداية والنهاية لعرض الفواتير" />
        ) : recFiltered.length === 0 ? (
          <Empty icon="🧾" text="لا توجد فواتير في هذه الفترة" />
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {recFiltered.map(inv => {
              const typeLabel = INVOICE_TYPE_LABEL[inv.type as keyof typeof INVOICE_TYPE_LABEL] ?? "فاتورة";
              return (
                <button
                  key={inv.id}
                  onClick={() => setSelected(inv)}
                  className="w-full text-right rounded-xl border border-border bg-input/40 p-3 hover:bg-input/70 hover:border-primary/50 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-primary">#{inv.id.slice(-6)}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">{typeLabel}</span>
                        <span className="text-sm font-semibold text-foreground truncate">{inv.customerName}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDateTimeAr(inv.createdAt)}</p>
                    </div>
                    <span className="text-base font-bold text-primary whitespace-nowrap">
                      {Number(inv.total ?? 0).toFixed(3)} OMR
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {selected && <InvoiceDetailsModal invoice={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Invoice Details Modal ────────────────────────────────────
function InvoiceDetailsModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const typeLabel = INVOICE_TYPE_LABEL[invoice.type as keyof typeof INVOICE_TYPE_LABEL] ?? "فاتورة";
  const items: Array<{ name: string; qty: number; price: number }> = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const total = Number(invoice.total ?? 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{typeLabel}</p>
            <p className="text-base font-bold text-primary">فاتورة #{String(invoice.id).slice(-6)}</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-input border border-border text-foreground hover:bg-muted/40 flex items-center justify-center">
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Customer + meta */}
          <div className="rounded-xl bg-input/40 border border-border p-3 space-y-1.5">
            <Row k="الزبون / Customer" v={invoice.customerName ?? "—"} />
            {invoice.customerPhone && <Row k="الهاتف / Phone" v={invoice.customerPhone} />}
            <Row k="التاريخ / Date" v={fmtDateTimeAr(invoice.createdAt)} />
            {invoice.orderId && <Row k="رقم الطلب / Order" v={`#${String(invoice.orderId).slice(-6)}`} />}
            {invoice.bookingId && <Row k="رقم الحجز / Booking" v={`#${String(invoice.bookingId).slice(-6)}`} />}
            <Row k="النوع / Type" v={typeLabel} />
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="rounded-xl bg-input/40 border border-border overflow-hidden">
              <div className="px-3 py-2 bg-primary/10 border-b border-border">
                <p className="text-xs font-semibold text-primary">تفاصيل الأصناف / Items</p>
              </div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-right px-3 py-2 font-semibold">الصنف</th>
                    <th className="text-center px-3 py-2 font-semibold">الكمية</th>
                    <th className="text-left px-3 py-2 font-semibold">السعر</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="text-right px-3 py-2 text-foreground">{it.name}</td>
                      <td className="text-center px-3 py-2 text-foreground">×{it.qty}</td>
                      <td className="text-left px-3 py-2 text-foreground">
                        {((Number(it.price) || 0) * (Number(it.qty) || 0)).toFixed(3)} OMR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 space-y-1.5">
            {items.length > 0 && subtotal !== total && (
              <Row k="الإجمالي قبل الخصم / Subtotal" v={`${subtotal.toFixed(3)} OMR`} />
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-primary/30">
              <span className="text-sm font-bold text-foreground">الإجمالي / Total</span>
              <span className="text-lg font-bold text-primary">{total.toFixed(3)} OMR</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="rounded-xl bg-input/40 border border-border p-3">
              <p className="text-[11px] text-muted-foreground mb-1">ملاحظات / Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground font-semibold text-right">{v}</span>
    </div>
  );
}

// ── Printed Invoices Browser ─────────────────────────────────
type PMode = "range" | "daily" | "monthly" | "yearly";

function PrintedInvoices({ id }: { id: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const yyyy = new Date().getFullYear();
  const [mode, setMode] = useState<PMode>("range");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo]     = useState<string>(today);
  const [day, setDay]   = useState<string>(today);
  const [ym, setYm]     = useState<string>(today.slice(0, 7));
  const [yr, setYr]     = useState<string>(String(yyyy));
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api.cafeOrders(id).then(d => setOrders(d.orders ?? [])).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { reload(); }, [reload]);

  // Filter to printed orders only
  const printed = orders.filter(o => !!o.printedAt);

  const inWindow = (d: Date, start: Date, end: Date) => d >= start && d < end;

  const filtered = (() => {
    if (mode === "range") {
      const s = new Date(from + "T00:00:00");
      const e = new Date(to + "T00:00:00"); e.setDate(e.getDate() + 1);
      return printed.filter(o => inWindow(new Date(o.printedAt), s, e));
    }
    if (mode === "daily") {
      const s = new Date(day + "T00:00:00");
      const e = new Date(s); e.setDate(e.getDate() + 1);
      return printed.filter(o => inWindow(new Date(o.printedAt), s, e));
    }
    if (mode === "monthly") {
      const [y, m] = ym.split("-").map(Number);
      if (!y || !m) return [];
      const s = new Date(y, m - 1, 1);
      const e = new Date(y, m, 1);
      return printed.filter(o => inWindow(new Date(o.printedAt), s, e));
    }
    // yearly
    const y = Number(yr);
    if (!y) return [];
    const s = new Date(y, 0, 1);
    const e = new Date(y + 1, 0, 1);
    return printed.filter(o => inWindow(new Date(o.printedAt), s, e));
  })();

  // Sort newest first by printedAt
  const sorted = [...filtered].sort((a, b) => new Date(b.printedAt).getTime() - new Date(a.printedAt).getTime());
  const total = sorted.reduce((s, o) => s + (Number(o.total) || 0), 0);

  const tabBtn = (m: PMode, label: string, sub: string) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-xl border text-xs font-bold transition ${
        mode === m
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-input border-border text-muted-foreground hover:bg-muted/30"
      }`}
    >
      <div>{label}</div>
      <div className={`text-[10px] font-normal mt-0.5 ${mode === m ? "opacity-90" : "opacity-60"}`}>{sub}</div>
    </button>
  );

  const inp = "bg-input border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          <Printer size={18}/>
        </div>
        <div>
          <p className="font-semibold text-foreground">الفواتير المطبوعة / Printed Invoices</p>
          <p className="text-xs text-muted-foreground">سجل فواتير الزبائن المطبوعة مع تاريخ ووقت الطباعة</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tabBtn("range",   "نطاق تواريخ",   "Date Range")}
        {tabBtn("daily",   "يومي",          "Daily")}
        {tabBtn("monthly", "شهري",          "Monthly")}
        {tabBtn("yearly",  "سنوي",          "Yearly")}
      </div>

      {/* Filter inputs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {mode === "range" && (
          <>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>من / From</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>إلى / To</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
            </label>
          </>
        )}
        {mode === "daily" && (
          <input type="date" value={day} onChange={e => setDay(e.target.value)} className={inp} />
        )}
        {mode === "monthly" && (
          <input type="month" value={ym} onChange={e => setYm(e.target.value)} className={inp} />
        )}
        {mode === "yearly" && (
          <input type="number" min={2020} max={2100} value={yr} onChange={e => setYr(e.target.value)} className={inp} />
        )}
        <button onClick={reload}
          className="ml-auto px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/30">
          تحديث / Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
          <p className="text-[11px] text-muted-foreground">عدد الفواتير / Count</p>
          <p className="text-xl font-bold text-primary">{sorted.length}</p>
        </div>
        <div className="rounded-xl bg-primary/10 border border-primary/30 p-3">
          <p className="text-[11px] text-muted-foreground">المجموع / Total</p>
          <p className="text-xl font-bold text-primary">{total.toFixed(3)} <span className="text-xs">OMR</span></p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-6">جاري التحميل...</p>
      ) : sorted.length === 0 ? (
        <Empty icon="🖨️" text="لا توجد فواتير مطبوعة في هذه الفترة / No printed invoices" />
      ) : (
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
          {sorted.map(o => (
            <div key={o.id} className="rounded-xl border border-border bg-input/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-primary">#{o.id.slice(-6)}</span>
                    <span className="text-sm font-semibold text-foreground truncate">
                      {o.customerName}
                      {o.customerNameEn && (
                        <span className="ml-2 text-[11px] text-muted-foreground" dir="ltr">({o.customerNameEn})</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {o.customerPhone} • {o.type === "dine" ? `🪑 طاولة ${o.tableNumber}` : `🚗 ${o.plateNumber} ${o.plateSymbol ?? ""}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    🖨️ طُبعت / Printed: {fmtDateTimeAr(o.printedAt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {(o.items ?? []).map((it: any) => `${it.name} ×${it.qty}`).join("، ")}
                  </p>
                  {o.notes && (
                    <p className="text-[11px] text-primary/90 mt-1 truncate">
                      📝 {o.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-base font-bold text-primary whitespace-nowrap">
                    {Number(o.total).toFixed(3)} OMR
                  </span>
                  <button onClick={() => printOrderInvoice(id, o)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-[11px] font-semibold text-muted-foreground hover:bg-muted/30">
                    <Printer size={11}/> إعادة طباعة
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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

// ── Inventory Tab (المخزن) ───────────────────────────────────
function inventoryStatus(item: { initialQty: number; currentQty: number }) {
  if (item.currentQty <= 0) return "depleted" as const;
  const ratio = item.currentQty / Math.max(1, item.initialQty);
  if (ratio <= 0.25) return "critical" as const;
  if (ratio <= 0.5)  return "warning"  as const;
  return "ok" as const;
}

const INV_BANNER: Record<"critical" | "warning", { bg: string; text: string; icon: any; msg: (n: string) => string }> = {
  warning:  { bg: "bg-yellow-500/15 border-yellow-500/40 text-yellow-300", text: "text-yellow-300",
    icon: AlertTriangle, msg: (n) => `وصلت كمية «${n}» إلى النصف` },
  critical: { bg: "bg-red-500/15 border-red-500/50 text-red-300",        text: "text-red-300",
    icon: AlertTriangle, msg: (n) => `كمية «${n}» وصلت إلى الربع — يحتاج زيادة المنتج` },
};

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ar-OM", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function InventoryTab({ id }: { id: string }) {
  const [active, setActive] = useState<any[]>([]);
  const [depleted, setDepleted] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", initialQty: "", unitPrice: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const reqSeq = useRef(0);

  const load = useCallback(async () => {
    const my = ++reqSeq.current;
    try {
      const d = await api.inventory(id);
      // Drop stale response if a newer request has started.
      if (my !== reqSeq.current) return;
      setActive(d.active ?? []);
      setDepleted(d.depleted ?? []);
    } catch {/* ignore */}
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const qtyN   = Number(form.initialQty);
  const priceN = Number(form.unitPrice);
  const total  = (Number.isFinite(qtyN) && Number.isFinite(priceN) && qtyN > 0 && priceN >= 0)
    ? qtyN * priceN : 0;

  const submit = async () => {
    setErr("");
    const name = form.name.trim();
    if (!name) { setErr("أدخل اسم المنتج"); return; }
    if (!Number.isFinite(qtyN) || qtyN <= 0)   { setErr("أدخل عدداً صحيحاً موجباً"); return; }
    if (!Number.isFinite(priceN) || priceN < 0) { setErr("أدخل سعراً صالحاً"); return; }
    setBusy(true);
    try {
      await api.addInventoryItem(id, {
        name, initialQty: Math.floor(qtyN), unitPrice: priceN,
      });
      setForm({ name: "", initialQty: "", unitPrice: "" });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "تعذر إضافة المنتج");
    } finally { setBusy(false); }
  };

  const decrement = async (itemId: string) => {
    if (pending[itemId]) return;
    setPending(p => ({ ...p, [itemId]: true }));
    try {
      await api.decrementInventory(id, itemId, 1);
      await load();
    } catch {/* ignore */}
    finally { setPending(p => { const n = { ...p }; delete n[itemId]; return n; }); }
  };

  const banners = active
    .map(it => ({ it, st: inventoryStatus(it) }))
    .filter(x => x.st === "warning" || x.st === "critical");

  return (
    <div className="space-y-5">
      {/* Add product form */}
      <Card className="p-5">
        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
          <Plus size={16}/> إضافة منتج للمخزن
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Inp value={form.name} onChange={(v: string) => setForm(f => ({ ...f, name: v }))}
               placeholder="اسم المنتج (مثال: أكياس بن، سيروب فانيلا)" className="md:col-span-3" />
          <Inp value={form.initialQty} onChange={(v: string) => setForm(f => ({ ...f, initialQty: v }))}
               placeholder="عدد المنتج" type="number" />
          <Inp value={form.unitPrice} onChange={(v: string) => setForm(f => ({ ...f, unitPrice: v }))}
               placeholder="سعر المنتج الواحد (OMR)" type="number" />
          <div className="flex items-center justify-between gap-2 px-4 rounded-xl bg-primary/10 border border-primary/30">
            <span className="text-xs text-muted-foreground">الإجمالي</span>
            <span className="text-base font-bold text-primary">{total.toFixed(3)} OMR</span>
          </div>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end mt-3">
          <button onClick={submit} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50">
            <Save size={14}/> {busy ? "جاري الحفظ..." : "حفظ المنتج"}
          </button>
        </div>
      </Card>

      {/* Alerts */}
      {banners.length > 0 && (
        <div className="space-y-2">
          {banners.map(({ it, st }) => {
            const meta = INV_BANNER[st as "warning" | "critical"];
            const Icon = meta.icon;
            return (
              <div key={it.id} className={`flex items-center gap-2 p-3 rounded-xl border ${meta.bg}`}>
                <Icon size={16} />
                <span className="text-xs font-semibold">{meta.msg(it.name)}</span>
                <span className="text-[11px] opacity-70 mr-auto">
                  المتبقي {it.currentQty} من {it.initialQty}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Active products */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
          <Package size={16} className="text-primary"/> المنتجات الحالية في المخزن
          <span className="text-[11px] text-muted-foreground font-normal">({active.length})</span>
        </h3>
        {active.length === 0 && <Empty icon="📦" text="لا توجد منتجات في المخزن" />}
        <div className="grid md:grid-cols-2 gap-3">
          {active.map(it => {
            const st = inventoryStatus(it);
            const ratio = it.currentQty / Math.max(1, it.initialQty);
            const barColor = st === "critical" ? "bg-red-400"
                           : st === "warning"  ? "bg-yellow-400"
                           : "bg-primary";
            return (
              <Card key={it.id} className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{it.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      أُضيف: {fmtDateTime(it.createdAt)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] text-muted-foreground">سعر الوحدة</p>
                    <p className="text-sm font-bold text-primary">{Number(it.unitPrice).toFixed(3)} OMR</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">المتبقي الآن</span>
                  <span className="font-bold text-foreground">
                    {it.currentQty} <span className="text-muted-foreground font-normal">/ {it.initialQty}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.max(2, ratio * 100)}%` }} />
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">
                    إجمالي الشراء: <span className="text-foreground font-semibold">{Number(it.totalCost).toFixed(3)} OMR</span>
                  </span>
                  <button onClick={() => decrement(it.id)} disabled={!!pending[it.id]}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 disabled:opacity-50 disabled:cursor-wait">
                    <Minus size={13}/> {pending[it.id] ? "..." : "إنقاص بمقدار 1"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Depleted products */}
      <div>
        <h3 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
          <XCircle size={16} className="text-red-400"/> المنتجات المفروغ منها
          <span className="text-[11px] text-muted-foreground font-normal">({depleted.length})</span>
        </h3>
        {depleted.length === 0 && <Empty icon="✅" text="لا توجد منتجات منتهية" />}
        <div className="grid md:grid-cols-2 gap-3">
          {depleted.map(it => (
            <Card key={it.id} className="p-4 opacity-80">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                    {it.name}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-bold">
                      منتهٍ
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    أُضيف: {fmtDateTime(it.createdAt)}
                  </p>
                  {it.depletedAt && (
                    <p className="text-[11px] text-red-400/80 mt-0.5">
                      انتهى: {fmtDateTime(it.depletedAt)}
                    </p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-muted-foreground">الكمية المشتراة</p>
                  <p className="text-sm font-bold text-foreground">{it.initialQty}</p>
                </div>
              </div>
              <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-300 text-center font-semibold">
                تم انتهاء العدد — يرجى شراء عدد أكثر من المنتج
              </div>
            </Card>
          ))}
        </div>
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

  // Print a sample invoice of the requested type so the cafe owner can preview
  // their template (logo + header text + promo text) without needing real data.
  // For order/expense we synthesize a tiny mock object; for daily/monthly/yearly
  // we just call the real aggregation print which will show whatever data
  // exists in the chosen period (or an "empty" notice if there's none).
  const runTest = (key: typeof TEMPLATE_TYPES[number]["key"]) => {
    const now = new Date();
    const ts = now.toISOString();
    switch (key) {
      case "order":
        printOrderInvoice(id, {
          id: "TEST-" + String(Date.now()).slice(-6),
          customerName: "زبون تجريبي",
          customerPhone: "99999999",
          type: "dine",
          tableNumber: 5,
          items: [
            { name: "إسبريسو مزدوج", qty: 2, price: 1.500 },
            { name: "كرواسون", qty: 1, price: 1.200 },
            { name: "v60", qty: 1, price: 2.000 },
          ],
          subtotal: 6.200,
          total: 6.200,
          paymentMethod: "cash",
          createdAt: ts,
          notes: "هذه فاتورة تجريبية لمعاينة قالب الطلب",
        });
        return;
      case "expense":
        printExpenseInvoice(id, {
          id: "TEST-" + String(Date.now()).slice(-6),
          date: ts.slice(0, 10),
          category: "كهرباء",
          title: "فاتورة كهرباء — تجريبية",
          amount: 35.500,
          notes: "هذه فاتورة مصاريف تجريبية لمعاينة القالب",
        });
        return;
      case "daily":
        printDailyInvoice(id, ts.slice(0, 10));
        return;
      case "monthly":
        printMonthlyInvoice(id, now.getFullYear(), now.getMonth() + 1);
        return;
      case "yearly":
        printYearlyInvoice(id, now.getFullYear());
        return;
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-semibold text-foreground mb-1">تعديل بيانات الفواتير</h3>
        <p className="text-xs text-muted-foreground mb-4">
          اختر نوع الفاتورة لتعديل البيانات التي تظهر في الترويسة (الشعار، الاسم، السجل التجاري، رقم التواصل، الكلام الترويجي).
          اضغط <b className="text-primary">«تجربة»</b> لمعاينة شكل الفاتورة قبل الطباعة الفعلية.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {TEMPLATE_TYPES.map(t => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <div key={t.key} className="flex flex-col gap-1.5">
                <button
                  onClick={() => setActive(isActive ? null : t.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all
                    ${isActive
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50"}`}>
                  <Icon size={22}/>
                  <span className="text-xs font-semibold text-center">{t.label}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); runTest(t.key); }}
                  title={`معاينة فاتورة ${t.label} بشكل تجريبي`}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors">
                  <Printer size={11}/> تجربة
                </button>
              </div>
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
            <Inp value={form.cafeName} onChange={(v: string) => setForm((f: any) => ({ ...f, cafeName: v }))} placeholder="مثال: كوفي Copointo" />
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

// ── Barcode / Public Links Tab ─────────────────────────────────
// Shows two scannable QR codes: one for the cafe owner's admin dashboard
// (so the staff can pin the cafe phone/tablet to the right page after a
// reboot), and one for the customer-facing cafe page (printable for in-store
// table tents so guests scan straight into the menu/booking flow).
// Escape user/server-supplied strings before interpolating into raw HTML
// (used by the print window). Prevents XSS if a cafe name ever contains
// "<script>" or other markup.
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function BarcodeTab({ id, cafeName }: { id: string; cafeName?: string }) {
  // Build absolute URLs from the fixed production domain (copointo.com) — NOT
  // from window.location.origin — so QR codes printed in dev/staging keep
  // working after deploy and don't expose the internal Replit dev URL.
  // encodeURIComponent on the id guards against any unexpected characters
  // ever appearing in a cafe id (path-segment safety). The cafe name is
  // appended as a query param so the URL stays human-readable when scanned/
  // copied without breaking the existing `/cafe/:id` route matchers.
  const PROD_DOMAIN = "https://copointo.com";
  const safeId = encodeURIComponent(id);
  const slug = (cafeName ?? "")
    .trim()
    .replace(/[\s/\\?#&=]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const nameQs = slug ? `?name=${encodeURIComponent(slug)}` : "";
  const dashboardUrl = `${PROD_DOMAIN}/admin/cafe/${safeId}${nameQs}`;
  const cafePageUrl  = `${PROD_DOMAIN}/cafe/${safeId}${nameQs}`;
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Fallback for older browsers — select-and-prompt.
      window.prompt("انسخ الرابط:", text);
    }
  };

  // Build a sanitized PNG file name from the cafe name + QR kind.
  const qrFileName = (kind: "cafe" | "dashboard") => {
    const base = (cafeName ?? "copointo").replace(/[\\/:*?"<>|]+/g, "").trim() || "copointo";
    const suffix = kind === "cafe" ? "customer" : "dashboard";
    return `${base}-${suffix}.png`;
  };

  // Fetch the QR as a high-res PNG blob from the qrserver image API.
  const fetchQrBlob = async (url: string): Promise<Blob> => {
    const src = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=0&ecc=M&data=${encodeURIComponent(url)}`;
    const res = await fetch(src);
    if (!res.ok) throw new Error("qr fetch failed");
    return await res.blob();
  };

  // Download the QR image as a PNG file.
  const downloadQr = async (kind: "cafe" | "dashboard", url: string) => {
    try {
      const blob = await fetchQrBlob(url);
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = qrFileName(kind);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
    } catch {
      alert("تعذّر تنزيل الباركود — تحقق من الاتصال بالإنترنت");
    }
  };

  // Share the QR image via the native share sheet, with safe fallbacks.
  const shareQr = async (kind: "cafe" | "dashboard", url: string) => {
    try {
      const blob = await fetchQrBlob(url);
      const file = new File([blob], qrFileName(kind), { type: "image/png" });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: cafeName ?? "Copointo", text: url });
        return;
      }
      if (nav.share) {
        await nav.share({ title: cafeName ?? "Copointo", text: url, url });
        return;
      }
      // Final fallback: copy the link to clipboard.
      await copy(kind, url);
      alert("تم نسخ الرابط — جهازك لا يدعم المشاركة المباشرة");
    } catch {
      // User cancelled or share failed silently — no-op.
    }
  };

  const QrCard = ({ title, subtitle, url, accent, kind }: {
    title: string; subtitle: string; url: string; accent: string; kind: "cafe" | "dashboard";
  }) => (
    <div className="p-6 flex flex-col items-center gap-4 bg-card border-2 rounded-2xl" style={{ borderColor: accent }}>
      <div className="text-center">
        <h3 className="font-extrabold text-foreground text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <QRCodeSVG value={url} size={220} level="M" includeMargin={false} />
      </div>
      <div className="w-full">
        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">الرابط:</p>
        <div className="flex items-center gap-2 bg-input border border-border rounded-lg px-3 py-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 bg-transparent text-foreground text-[11px] outline-none font-mono"
            dir="ltr"
          />
          <button
            onClick={() => copy(kind, url)}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted text-primary"
            title="نسخ الرابط"
            aria-label="نسخ الرابط"
          >
            <Copy size={14} />
          </button>
        </div>
        {copied === kind && (
          <p className="text-[10px] text-green-400 mt-1 font-bold">✓ تم النسخ</p>
        )}
      </div>
      <div className="flex gap-2 w-full flex-wrap">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[80px] px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-bold text-center hover:bg-muted/80"
        >
          🔗 فتح
        </a>
        <button
          onClick={() => downloadQr(kind, url)}
          className="flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1"
          style={{ background: accent, color: "#000" }}
        >
          <Download size={12} /> تنزيل
        </button>
        <button
          onClick={() => shareQr(kind, url)}
          className="flex-1 min-w-[80px] px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 border-2"
          style={{ borderColor: accent, color: accent, background: "transparent" }}
        >
          <Share2 size={12} /> مشاركة
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <QrCode size={22} className="text-primary" /> الباركود
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            أكواد QR لروابط الكوفي — نزّل كود الزبائن أو شاركه ليصل لزبائنك،
            وكود لوحة التحكم احتفظ به لفتح الإدارة بسرعة.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <QrCard
          kind="cafe"
          title="📷 صفحة الزبائن"
          subtitle="يفتح صفحة الكوفي للزبائن — مناسب للطباعة على الطاولات"
          url={cafePageUrl}
          accent="#E8B86D"
        />
        <QrCard
          kind="dashboard"
          title="🔐 لوحة التحكم"
          subtitle="يفتح لوحة إدارة الكوفي — للموظفين فقط"
          url={dashboardUrl}
          accent="#6EA8F3"
        />
      </div>

      <Card className="p-4 bg-yellow-500/5 border border-yellow-500/30">
        <p className="text-xs text-foreground leading-relaxed">
          <strong className="text-yellow-500">💡 نصيحة:</strong>{" "}
          الكود الذهبي هو كود الزبائن — نزّله كصورة وضعه على الطاولات أو شاركه على وسائل التواصل،
          ليفتح الزبون صفحة الكوفي مباشرة ويطلب أو يحجز.
          الكود الأزرق للموظفين فقط — لا تنشره خارج الكوفي.
        </p>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CafeDashboardPage() {
  const params = useParams<{ id: string }>();
  const id     = params.id;
  const [_, navigate] = useLocation();
  const [cafe,    setCafe]    = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab,     setTab]     = useState<Tab>("stats");
  // Collapse the entire tabs panel so the active tab's content takes full screen.
  // Toggle via the chevron strip at the bottom of the panel (or its remnant when collapsed).
  const [tabsCollapsed, setTabsCollapsed] = useState(false);
  const { counts: notifCounts, markSeen: markTabSeen } = useTabNotifications(id, tab);

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
        setNotFound(false);
      } else {
        // Show an inline "not found" screen instead of redirecting to the
        // super-admin cafes list — cafe owners on /cafe/:id should never be
        // pushed into the super-admin area accidentally.
        setNotFound(true);
      }
    }).catch(() => {});
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">☕</div>
          <h1 className="text-xl font-bold text-foreground">هذا الكوفي غير متاح</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            الرابط الذي فتحته لم يعد صالحاً. ربما حُذف الكوفي أو تم تغيير الرابط.
            تواصل مع الإدارة للحصول على رابط الدخول الصحيح.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background" dir="rtl">
      {/* Top bar */}
      <header className="relative flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 border-b border-[#E8B86D]/25 bg-gradient-to-l from-[#E8B86D]/12 via-card to-card shrink-0 shadow-lg shadow-black/30">
        <span className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-l from-transparent via-[#E8B86D]/50 to-transparent" aria-hidden />
        {/* Copointo brand mark — NOT a link: super-admin must only be
            reached by typing the root URL deliberately, never from a cafe
            dashboard or user page. */}
        <img
          src={copointoLogoUrl}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shrink-0 ring-1 ring-[#E8B86D]/30 shadow-md shadow-[#E8B86D]/20"
          alt="Copointo"
          title="كوبوينتو / Copointo"
        />
        {/* Back-to-super-admin button — visible only when this dashboard
            was opened from the super-admin cafes list (flag set in
            sessionStorage by CafesPage). Keeps a return path without
            exposing super-admin to regular cafe staff. */}
        {(() => { try { return sessionStorage.getItem("copointo_from_super_admin") === "1"; } catch { return false; } })() && (
          <Link
            href="/cafes"
            className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 shrink-0"
            title="رجوع إلى السوبر مدير"
          >
            <ArrowRight size={14} /> <span className="hidden sm:inline">السوبر مدير</span>
          </Link>
        )}
        <div className="hidden sm:block w-px h-7 bg-border shrink-0" />
        {cafe?.logo
          ? <img src={cafe.logo} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-cover shrink-0" alt="" />
          : <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">☕</div>}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-foreground text-sm sm:text-base truncate">لوحة التحكم الخاصة بالكوفي Copointo</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{cafe?.address ?? ""}</p>
        </div>
        <div className="mr-auto shrink-0">
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cafe?.active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
            {cafe?.active ? "نشط" : "موقوف"}
          </span>
        </div>
      </header>

      {/* Tabs — square 3D-rotating buttons. Collapsible via chevron at the bottom. */}
      <div className="relative border-b border-border bg-card shrink-0">
        <div
          className={`overflow-hidden transition-[max-height,opacity,padding] duration-300 ease-in-out ${
            tabsCollapsed ? "max-h-0 opacity-0 py-0" : "max-h-[600px] opacity-100 px-6 py-5"
          }`}
        >
        <div
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5"
          style={{ perspective: "900px" }}
        >
          {/* Manager analytics — special king button (now opens full page) */}
          <Link
            href={`/cafe/${id}/analytics`}
            className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 focus:outline-none focus:ring-2 focus:ring-[#E8B86D]/60"
            style={{ perspective: "800px" }}
            title="إحصائيات المدير"
          >
            <div
              className="relative w-full h-full rounded-xl flex flex-col items-center justify-center gap-0.5
                bg-gradient-to-br from-[#E8B86D] via-[#C99654] to-[#7A4F1E]
                border-2 border-[#FFE0A8] shadow-md shadow-[#E8B86D]/40 text-black
                hover:shadow-lg hover:shadow-[#E8B86D]/60 group-hover:scale-[1.05] transition-all duration-200"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0.5 rounded-lg ring-1 ring-black/15 pointer-events-none" />
              <Crown size={16} className="text-black drop-shadow" />
              <Lock size={10} className="text-black/70" />
              <span className="text-[8px] font-extrabold text-center px-0.5 leading-tight text-black">
                إحصائيات المدير
              </span>
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500 border-2 border-card animate-pulse" />
            </div>
          </Link>
          {TABS.map(({ id: tid, label, icon: Icon }, i) => {
            const active     = tab === tid;
            const isSpinning = spinIdx === i;
            const notifCount = notifCounts[tid] ?? 0;
            return (
              <button
                key={tid}
                onClick={() => { setTab(tid); markTabSeen(tid); }}
                className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/60"
                style={{ perspective: "800px" }}
                title={label}
              >
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 z-10 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-card shadow shadow-red-500/40 animate-pulse">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
                <div
                  key={isSpinning ? `spin-${spinIdx}` : "idle"}
                  className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center gap-0.5
                    border transition-all duration-200
                    ${active
                      ? "bg-gradient-to-br from-[#E8B86D] via-[#D4A35A] to-[#B8884A] border-[#E8B86D] shadow-md shadow-[#E8B86D]/30 text-black"
                      : "bg-gradient-to-br from-[#0A0606] via-[#050303] to-black border-[#E8B86D]/30 text-[#E8B86D] hover:border-[#E8B86D]/60 hover:shadow-md hover:shadow-[#E8B86D]/15 group-hover:scale-[1.04]"}
                    ${isSpinning ? "animate-spinY" : ""}`}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Inner gold accent ring */}
                  <div className={`absolute inset-0.5 rounded-lg pointer-events-none ${active ? "ring-1 ring-black/20" : "ring-1 ring-[#E8B86D]/15"}`} />

                  <Icon size={20} strokeWidth={1.75} className={active ? "text-black" : "text-[#E8B86D]"} />
                  <span className={`text-[9px] font-bold leading-tight text-center px-0.5 ${active ? "text-black" : "text-[#F5E6CC]"}`}>
                    {label}
                  </span>

                  {/* Active indicator dot */}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#E8B86D] shadow shadow-[#E8B86D]/60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        </div>

        {/* Collapse / expand chevron — pinned to the bottom edge of the tabs strip.
            Slides up to hide the panel, slides down to bring it back. */}
        <button
          type="button"
          onClick={() => setTabsCollapsed(v => !v)}
          title={tabsCollapsed ? "إظهار البانل" : "إخفاء البانل"}
          aria-label={tabsCollapsed ? "إظهار البانل" : "إخفاء البانل"}
          className="absolute left-1/2 -translate-x-1/2 -bottom-3 z-20 w-12 h-7 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-[#E8B86D] hover:bg-[#E8B86D]/10 hover:border-[#E8B86D]/60 transition-colors"
        >
          {tabsCollapsed ? <ChevronDown size={16} strokeWidth={2.5} /> : <ChevronUp size={16} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,rgba(232,184,109,0.06),transparent_70%)]">
        {tab === "stats"    && <StatsTab    id={id} />}
        {tab === "orders"   && <OrdersTab   id={id} />}
        {tab === "direct"   && <DirectOrderTab id={id} onCreated={() => setTab("orders")} />}
        {tab === "bookings" && <BookingsTab id={id} />}
        {tab === "menu"     && <MenuTab     id={id} />}
        {tab === "chat"     && <ChatTab     id={id} />}
        {tab === "tables"   && <TablesTab   id={id} />}
        {tab === "invoices"  && <InvoicesTab  id={id} />}
        {tab === "expenses"  && <ExpensesTab  id={id} />}
        {tab === "inventory" && <InventoryTab id={id} />}
        {tab === "templates" && <TemplatesTab id={id} />}
        {tab === "reels"     && <ReelsTab     id={id} />}
        {tab === "barcode"   && <BarcodeTab   id={id} cafeName={cafe?.name} />}
        {tab === "vouchers"  && <VouchersTab  id={id} cafeName={cafe?.name} />}
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
  const [cafe, setCafe] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
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
        if (found) { setCafe(found); setNotFound(false); }
        else setNotFound(true);
      })
      .catch(() => {});
  }, [cafeId]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">📊</div>
          <h1 className="text-xl font-bold text-foreground">لوحة التحليلات غير متاحة</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            هذا الكوفي لم يعد موجوداً. تواصل مع الإدارة للحصول على رابط صحيح.
          </p>
        </div>
      </div>
    );
  }

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
      <header className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 border-b border-[#E8B86D]/20 bg-gradient-to-l from-[#E8B86D]/10 to-card shrink-0 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          {/* Copointo brand mark — NOT a link (super-admin is reached only
              by typing the root URL deliberately). */}
          <img
            src={copointoLogoUrl}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain shrink-0"
            alt="Copointo"
            title="كوبوينتو / Copointo"
          />
          <div className="hidden sm:block w-px h-5 bg-border" />
          <Link href={`/cafe/${cafeId}`}
            className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm shrink-0">
            <ArrowLeft size={18}/> <span className="hidden sm:inline">العودة للوحة الكوفي</span>
          </Link>
          <div className="hidden sm:block w-px h-5 bg-border" />
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#E8B86D] to-[#7A4F1E] flex items-center justify-center shadow-lg shadow-[#E8B86D]/30 shrink-0">
              <Crown size={18} className="text-black sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-extrabold text-[#F5E6CC] truncate">إحصائيات المدير</h2>
              <p className="text-[11px] sm:text-xs text-[#E8B86D]/70 truncate">{cafe?.name ?? "..."}</p>
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
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
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
          <p className="text-base sm:text-lg lg:text-xl font-extrabold text-[#F5E6CC] mt-1 leading-tight break-words tabular-nums" style={{ overflowWrap: "anywhere" }}>{value}</p>
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

      {/* Cash / Visa breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <GoldStat label="إجمالي المبيعات كاش" value={`${(r.cash ?? 0).toFixed(3)} OMR`} sub="مدفوعات الطلبات فقط" icon={<Banknote size={18} />} accent="#10B981" />
        <GoldStat label="إجمالي المبيعات فيزا" value={`${(r.visa ?? 0).toFixed(3)} OMR`} sub="مدفوعات الطلبات فقط" icon={<CreditCard size={18} />} accent="#60A5FA" />
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <GoldStat label="إجمالي الطلبات"    value={o.total}     icon={<ShoppingBag size={18} />} />
        <GoldStat label="داخل الكوفي"       value={o.dineIn}    icon={<Coffee size={18} />} />
        <GoldStat label="خارج الكوفي"       value={o.carOut}    icon={<Car size={18} />} />
        <GoldStat label="حجوزات الطاولات"   value={b.total}     icon={<Armchair size={18} />} />
        <GoldStat label="مشاهدات الكوفي"    value={v.total}     icon={<Eye size={18} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order type bar */}
        <SectionCard title="نوع الطلب" icon={<Coffee size={16} />}>
          {(o.dineIn + o.carOut) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={orderTypeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
                <XAxis dataKey="name" tick={{ fill: "#E8B86D", fontSize: 11 }} />
                <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#E8B86D11" }} contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {orderTypeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد طلبات بعد</p>}
        </SectionCard>

        {/* Order source bar */}
        <SectionCard title="مصدر الطلب (مباشر / شات)" icon={<MessageCircle size={16} />}>
          {(o.direct + o.viaChat) > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={orderSourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
                <XAxis dataKey="name" tick={{ fill: "#E8B86D", fontSize: 11 }} />
                <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#E8B86D11" }} contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {orderSourceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
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

        {/* Bookings status bar */}
        <SectionCard title="حالة الحجوزات" icon={<Armchair size={16} />}>
          {b.total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={bookingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
                <XAxis dataKey="name" tick={{ fill: "#E8B86D", fontSize: 11 }} />
                <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#E8B86D11" }} contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {bookingData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-muted-foreground py-10 text-sm">لا توجد حجوزات بعد</p>}
        </SectionCard>
      </div>

      {/* Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="المنتجات الأكثر طلباً" icon={<Trophy size={16} />}>
          {data.topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-[#E8B86D]/70 border-b border-[#E8B86D]/20">
                    <th className="text-right py-2 px-2 font-bold">#</th>
                    <th className="text-right py-2 px-2 font-bold">المنتج</th>
                    <th className="text-right py-2 px-2 font-bold">الكمية</th>
                    <th className="text-left py-2 px-2 font-bold">الإيراد</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((p: any, i: number) => (
                    <tr key={p.name} className="border-b border-[#E8B86D]/10 hover:bg-[#E8B86D]/5">
                      <td className="py-2.5 px-2">
                        <span className="inline-flex w-6 h-6 rounded-md items-center justify-center text-[11px] font-extrabold"
                          style={{ background: i === 0 ? "#E8B86D" : i === 1 ? "#C99654" : "#3A2410", color: i < 2 ? "#000" : "#E8B86D" }}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-[#F5E6CC] font-semibold">{p.name}</td>
                      <td className="py-2.5 px-2 text-[#E8B86D] font-bold whitespace-nowrap">{p.qty}×</td>
                      <td className="py-2.5 px-2 text-left text-muted-foreground whitespace-nowrap tabular-nums">{p.revenue} OMR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-center text-muted-foreground py-6 text-sm">لا توجد بيانات</p>}
        </SectionCard>

        {/* Top categories */}
        <SectionCard title="الفئة الأكثر طلباً" icon={<UtensilsCrossed size={16} />}>
          {data.topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.topCategories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8B86D22" />
                <XAxis dataKey="name" tick={{ fill: "#E8B86D", fontSize: 11 }} />
                <YAxis tick={{ fill: "#E8B86D", fontSize: 11 }} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#E8B86D11" }} contentStyle={{ background: "#0A0606", border: "1px solid #E8B86D55", borderRadius: 8, color: "#F5E6CC" }} />
                <Bar dataKey="qty" radius={[6, 6, 0, 0]}>
                  {data.topCategories.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
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

// ─── Reels Tab ───────────────────────────────────────────────────────
function ReelsTab({ id }: { id: string }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [commentsByReel, setCommentsByReel] = useState<Record<string, any[]>>({});
  const [notifs, setNotifs] = useState<any[]>([]);
  // Upload phases: idle | uploading. Downscaling/re-encoding was removed —
  // we now upload the source video at its original resolution & quality so
  // the user sees the same frame they recorded.
  const [phase, setPhase] = useState<"idle" | "uploading">("idle");
  const [progress, setProgress] = useState(0); // 0..1
  const [origInfo, setOrigInfo] = useState<{ w: number; h: number; sizeMB: number; durationSec: number } | null>(null);
  // Two-step wizard: "pick" (choose file + write description) → "preview" (full-size
  // preview + confirm publish). The user must explicitly confirm in "preview" before
  // any processing/upload starts, so they can verify the video is the right one.
  const [stepView, setStepView] = useState<"pick" | "preview">("pick");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.reels(id);
      const reels = r.reels ?? [];
      setList(reels);
      const entries = await Promise.all(
        reels.map(async (rl: any) => {
          try {
            const c = await api.reelComments(id, rl.id);
            return [rl.id, c.comments ?? []] as const;
          } catch { return [rl.id, []] as const; }
        }),
      );
      setCommentsByReel(Object.fromEntries(entries));
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  const refreshNotifs = useCallback(async () => {
    try {
      const r = await api.reelsNotifications(id, "");
      setNotifs(r.items ?? []);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { refresh(); refreshNotifs(); }, [refresh, refreshNotifs]);
  useEffect(() => {
    const t = setInterval(refreshNotifs, 7000);
    return () => clearInterval(t);
  }, [refreshNotifs]);

  const handleFile = (f: File | null) => {
    setError("");
    setOrigInfo(null);
    if (!f) { setVideoFile(null); setVideoDataUrl(""); return; }
    // Accept any file the user picked. Browsers don't always populate `type`
    // for less-common containers (mkv, ts, flv, 3gp, m4v, …), so we also fall
    // back to the file extension before refusing.
    const VIDEO_EXTS = /\.(mp4|mov|m4v|webm|mkv|avi|wmv|flv|3gp|3g2|mpg|mpeg|mts|m2ts|ts|ogv|ogg|qt|hevc|h264|h265|asf|f4v|vob|mxf)$/i;
    const looksLikeVideo = f.type.startsWith("video/") || VIDEO_EXTS.test(f.name);
    if (!looksLikeVideo) { setError("يرجى اختيار ملف فيديو"); return; }
    setVideoFile(f);
    setVideoDataUrl(URL.createObjectURL(f));
    // Probe dimensions + duration for the user-facing info card.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = URL.createObjectURL(f);
    probe.onloadedmetadata = () => {
      setOrigInfo({
        w: probe.videoWidth,
        h: probe.videoHeight,
        sizeMB: f.size / (1024 * 1024),
        durationSec: probe.duration || 0,
      });
      URL.revokeObjectURL(probe.src);
    };
  };

  const goToPreview = () => {
    setError("");
    if (!videoFile) { setError("يرجى اختيار فيديو أولاً"); return; }
    if (!description.trim()) { setError("يرجى كتابة وصف للريل"); return; }
    setStepView("preview");
  };
  const backToPick = () => {
    setStepView("pick");
  };
  const cancelForm = () => {
    setShowForm(false);
    setStepView("pick");
    setVideoFile(null);
    setVideoDataUrl("");
    setDescription("");
    setOrigInfo(null);
    setError("");
    setPhase("idle");
    setProgress(0);
  };

  const xhrUploadFile = (path: string, fd: FormData, onP: (p: number) => void) =>
    new Promise<any>((res, rej) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", path);
      // Don't set Content-Type — the browser supplies it with the multipart boundary.
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onP(e.loaded / e.total); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { res(JSON.parse(xhr.responseText)); } catch { res({}); }
        } else {
          // Try to extract a JSON error first; otherwise surface the raw
          // response text + status so the user can see the real reason
          // instead of a generic "فشل الرفع".
          let msg = "";
          try {
            const j = JSON.parse(xhr.responseText);
            msg = j.error || j.message || "";
          } catch { /* not JSON */ }
          if (!msg) {
            const raw = (xhr.responseText || "").trim().slice(0, 200);
            msg = raw
              ? `فشل الرفع (${xhr.status}): ${raw}`
              : `فشل الرفع — رمز الخطأ ${xhr.status}`;
          }
          rej(new Error(msg));
        }
      };
      xhr.onerror = () => rej(new Error("خطأ في الشبكة — تأكد من الاتصال"));
      xhr.ontimeout = () => rej(new Error("انتهت مهلة الرفع — جرّب فيديو أصغر"));
      xhr.send(fd);
    });

  const submit = async () => {
    setError("");
    if (!videoFile) { setError("يرجى رفع فيديو"); return; }
    if (!description.trim()) { setError("الوصف مطلوب"); return; }
    setSubmitting(true);
    try {
      // Upload the source file as-is via multipart/form-data — no downscaling,
      // no base64 in JSON. The bytes stream straight to disk on the server,
      // so even large videos (hundreds of MB) upload reliably without the
      // "0 bytes" failure that base64-in-JSON used to hit.
      setPhase("uploading");
      setProgress(0);
      const fd = new FormData();
      fd.append("video", videoFile, videoFile.name || "reel.mp4");
      fd.append("description", description.trim());
      await xhrUploadFile(`/api/cafe/${id}/reels`, fd, setProgress);
      setShowForm(false);
      setStepView("pick");
      setVideoFile(null); setVideoDataUrl("");
      setDescription("");
      setOrigInfo(null);
      setPhase("idle"); setProgress(0);
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "حدث خطأ أثناء الرفع");
      setPhase("idle"); setProgress(0);
    }
    setSubmitting(false);
  };

  const remove = async (rid: string) => {
    if (!confirm("حذف هذا الريل وجميع تعليقاته؟")) return;
    await api.deleteReel(id, rid);
    await refresh();
  };

  const deleteComment = async (rid: string, cid: string) => {
    setCommentsByReel((p) => ({
      ...p,
      [rid]: (p[rid] ?? []).filter((c: any) => c.id !== cid),
    }));
    try {
      await api.deleteReelComment(id, rid, cid);
    } catch { /* ignore */ }
    try {
      const r = await api.reelComments(id, rid);
      setCommentsByReel((p) => ({ ...p, [rid]: r.comments ?? [] }));
    } catch { /* ignore */ }
    setList((prev) =>
      prev.map((rl) =>
        rl.id === rid ? { ...rl, comments: Math.max(0, (rl.comments ?? 1) - 1) } : rl,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Video className="w-6 h-6 text-[#E8B86D]" />
            Copointo ريلز
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            ارفع فيديوهات قصيرة عمودية لتظهر في تبويب الفيديوهات بالتطبيق
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-4 py-2 rounded-xl bg-[#E8B86D] text-black font-semibold flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> إضافة ريل جديد
        </button>
      </div>

      {/* Notifications panel */}
      {notifs.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#0A0606] p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-400" /> آخر التفاعلات
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {notifs.slice(0, 20).map((it: any, i: number) => (
              <div key={i} className="text-sm flex items-center gap-2 text-white/80">
                {it.kind === "like" ? (
                  <><Heart className="w-3.5 h-3.5 text-rose-400" /> أعجب <b>{it.userName}</b> بريل</>
                ) : (
                  <><MessageSquare className="w-3.5 h-3.5 text-sky-400" /> <b>{it.userName}</b>: {it.text}</>
                )}
                <span className="text-xs text-white/40 mr-auto">
                  {new Date(it.at).toLocaleString("ar")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload form (2-step wizard: pick → preview/publish) */}
      {showForm && (
        <div className="rounded-2xl border border-[#E8B86D]/30 bg-[#0A0606] p-5 space-y-4">
          {/* Step header */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Video className="w-5 h-5 text-[#E8B86D]" />
              ريل جديد
              <span className="text-xs text-white/50 mr-2">
                — الخطوة {stepView === "pick" ? "1" : "2"} من 2
              </span>
            </h3>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`px-2 py-1 rounded-full ${stepView === "pick" ? "bg-[#E8B86D] text-black font-bold" : "bg-white/10 text-white/50"}`}>
                1. اختيار + وصف
              </span>
              <span className="text-white/30">→</span>
              <span className={`px-2 py-1 rounded-full ${stepView === "preview" ? "bg-[#E8B86D] text-black font-bold" : "bg-white/10 text-white/50"}`}>
                2. معاينة + نشر
              </span>
            </div>
          </div>

          {/* ───────────────── STEP 1 — PICK ───────────────── */}
          {stepView === "pick" && (
            <>
              <div>
                <label className="block text-sm mb-2 text-white/70">ملف الفيديو (عمودي، أي جودة)</label>
                <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-black/30 cursor-pointer hover:border-[#E8B86D]/50">
                  <Upload className="w-4 h-4 text-[#E8B86D]" />
                  <span className="text-sm text-white/70 truncate">{videoFile ? videoFile.name : "اختيار ملف…"}</span>
                  {/*
                    accept="video/*" alone is the universally-supported value. Less
                    common container extensions are caught by `handleFile`'s regex
                    fallback so any video the OS lets the user pick is accepted.
                  */}
                  <input type="file" accept="video/*" className="hidden"
                    onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
                {origInfo && (
                  <div className="mt-2 text-xs text-white/60 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>📐 {origInfo.w}×{origInfo.h}</span>
                    <span>📦 {origInfo.sizeMB.toFixed(1)} MB</span>
                    {origInfo.durationSec > 0 && <span>⏱️ {origInfo.durationSec.toFixed(1)}s</span>}
                    {origInfo.h > 1080 && (
                      <span className="text-[#E8B86D]">· سيتم تقليص الجودة إلى 1080p عند النشر</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-2 text-white/70">الوصف *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={3} className="w-full rounded-xl bg-black/30 border border-white/10 p-3 text-sm"
                  placeholder="مثال: قهوة الصباح بنكهة جديدة ☕" />
              </div>
              <div className="rounded-xl border border-[#E8B86D]/30 bg-[#E8B86D]/5 p-3 text-xs text-white/70 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#E8B86D]" />
                  <span>رابط صفحة الكوفي للطلب يُضاف تلقائياً</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#E8B86D]" />
                  <span>موقع الكوفي على الخريطة يُضاف تلقائياً من بيانات الكوفي</span>
                </div>
              </div>
              {error && <div className="text-sm text-rose-400">{error}</div>}
              <div className="flex gap-2">
                <button
                  onClick={goToPreview}
                  disabled={!videoFile || !description.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#E8B86D] text-black font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  معاينة قبل النشر
                </button>
                <button onClick={cancelForm}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-white/70">
                  إلغاء
                </button>
              </div>
            </>
          )}

          {/* ───────────────── STEP 2 — PREVIEW + PUBLISH ───────────────── */}
          {stepView === "preview" && (
            <>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-center">
                <p className="text-xs text-white/60 mb-3">
                  ✋ تحقّق من الفيديو والوصف بعناية. اضغط «نشر الريل» للنشر، أو «رجوع» للتعديل.
                </p>
                {videoDataUrl && (
                  <video
                    src={videoDataUrl}
                    controls
                    autoPlay={false}
                    playsInline
                    className="mx-auto rounded-xl border border-white/10 bg-black"
                    style={{ maxHeight: 480, maxWidth: "100%" }}
                  />
                )}
                {origInfo && (
                  <div className="mt-3 text-xs text-white/60 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    <span>📐 {origInfo.w}×{origInfo.h}</span>
                    <span>📦 {origInfo.sizeMB.toFixed(1)} MB</span>
                    {origInfo.durationSec > 0 && <span>⏱️ {origInfo.durationSec.toFixed(1)}s</span>}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[11px] text-white/50 mb-1">الوصف</p>
                <p className="text-sm text-white/90 whitespace-pre-wrap">{description}</p>
              </div>

              {origInfo && origInfo.sizeMB > 30 && (
                <div className="rounded-xl border border-[#E8B86D]/30 bg-[#E8B86D]/5 p-3 text-xs text-white/80">
                  ℹ️ حجم الفيديو {origInfo.sizeMB.toFixed(1)} MB — سيتم رفعه بنفس
                  الجودة الأصلية. الرفع قد يستغرق دقائق حسب سرعة الإنترنت. لا تغلق الصفحة.
                </div>
              )}

              {error && <div className="text-sm text-rose-400">{error}</div>}

              {phase !== "idle" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>جارٍ رفع الفيديو إلى الخادم…</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#E8B86D] transition-all" style={{ width: `${progress * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#E8B86D] text-black font-semibold disabled:opacity-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {submitting ? "جارٍ الرفع…" : "نشر الريل"}
                </button>
                <button
                  onClick={backToPick}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-white/20 text-white/80 disabled:opacity-50 flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  رجوع للتعديل
                </button>
                <button
                  onClick={cancelForm}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="text-center text-white/50 py-8">جارٍ التحميل…</p>
      ) : list.length === 0 ? (
        <p className="text-center text-white/50 py-12">لا توجد ريلز بعد. اضغط "إضافة ريل جديد" لتبدأ.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((r) => {
            const cmts = commentsByReel[r.id] ?? [];
            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-[#0A0606] overflow-hidden flex flex-col">
                <div className="relative bg-black">
                  <video
                    src={r.videoUrl}
                    controls
                    className="w-full bg-black object-contain"
                    style={{ maxHeight: 260 }}
                  />
                </div>
                <div className="p-3 space-y-2.5 flex-1 flex flex-col">
                  {r.description && (
                    <p className="text-xs text-white/80 line-clamp-2">{r.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-white/60">
                    <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{r.views}</span>
                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" />{r.likes}</span>
                    <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-sky-400" />{r.comments}</span>
                    <button
                      onClick={() => remove(r.id)}
                      className="ms-auto p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                      title="حذف الريل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-2.5 flex-1">
                    <div className="text-[11px] text-white/50 mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> التعليقات ({cmts.length})
                    </div>
                    {cmts.length === 0 ? (
                      <p className="text-xs text-white/40 py-2">لا توجد تعليقات</p>
                    ) : (
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {cmts.map((c: any) => (
                          <div key={c.id} className="rounded-lg bg-black/40 p-2 flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-[#E8B86D] truncate">{c.userName}</span>
                                <span className="text-[10px] text-white/40">
                                  {new Date(c.createdAt).toLocaleString("ar")}
                                </span>
                              </div>
                              <p className="text-xs text-white/80 mt-0.5 break-words">{c.text}</p>
                            </div>
                            <button
                              onClick={() => deleteComment(r.id, c.id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-rose-400 shrink-0"
                              title="حذف التعليق"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Gift Vouchers Tab (القسائم الشرائية) ──────────────────────────
function VouchersTab({ id, cafeName }: { id: string; cafeName?: string }) {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState<"all" | "pending" | "confirmed">("all");

  const load = useCallback(() => {
    setLoading(true);
    api.giftVouchers(id)
      .then(d => setVouchers(d.vouchers ?? []))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const fromLabel = (v: any) => {
    if (v.fromMode === "anonymous") return "من طرف مجهول";
    if (v.fromMode === "friend")    return "من صديق/ة";
    return `باسم ${v.fromDisplay || v.senderName}`;
  };

  const onConfirm = async (vid: string) => {
    if (!confirm("تأكيد تسليم القسيمة؟ سيتم إنشاء فاتورة وإضافتها للإيرادات.")) return;
    try {
      await api.confirmGiftVoucher(id, vid);
      load();
    } catch { alert("تعذّر التأكيد. حاول مرة أخرى."); }
  };
  const onDelete = async (vid: string) => {
    if (!confirm("حذف هذه القسيمة نهائياً؟")) return;
    try {
      await api.deleteGiftVoucher(id, vid);
      load();
    } catch { alert("تعذّر الحذف."); }
  };

  const openWhatsApp = (phone: string, voucher: any) => {
    const cleaned = phone.replace(/[^\d]/g, "");
    const intl = cleaned.startsWith("968") ? cleaned : `968${cleaned}`;
    const sender = voucher.fromMode === "anonymous"
      ? "شخص يتمنى لك يوماً جميلاً"
      : voucher.fromMode === "friend"
        ? "صديق/ة لك"
        : (voucher.fromDisplay || voucher.senderName);
    const cafeText = cafeName ? `كوفي ${cafeName}` : "الكوفي";
    const msg = encodeURIComponent(
      `🎁 مرحباً ${voucher.recipientName}\n\nأرسل لك ${sender} قسيمة شرائية بقيمة ${Number(voucher.amount).toFixed(3)} ر.ع لاستخدامها في ${cafeText}.\n\nيمكنك المرور على الكوفي لاستلامها. نتمنى لك وقتاً ممتعاً ☕`
    );
    window.open(`https://wa.me/${intl}?text=${msg}`, "_blank");
  };

  const filtered = vouchers.filter(v => filter === "all" ? true : v.status === filter);
  const pendingCount   = vouchers.filter(v => v.status === "pending").length;
  const confirmedCount = vouchers.filter(v => v.status === "confirmed").length;
  const totalRevenue   = vouchers
    .filter(v => v.status === "confirmed")
    .reduce((s, v) => s + (Number(v.amount) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="إجمالي القسائم"     value={vouchers.length}                       Icon={Gift} />
        <StatBox label="بانتظار التأكيد"     value={pendingCount}                          Icon={Clock} />
        <StatBox label="مؤكدة"               value={confirmedCount}                        Icon={CheckCircle} />
        <StatBox label="إيرادات القسائم"    value={`${totalRevenue.toFixed(3)} OMR`}      Icon={Wallet} />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { k: "all" as const,       l: "الكل"        },
          { k: "pending" as const,   l: "بانتظار"     },
          { k: "confirmed" as const, l: "مؤكدة"      },
        ].map(p => (
          <button key={p.k} onClick={() => setFilter(p.k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
              filter === p.k
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            }`}>
            {p.l}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          لا توجد قسائم شرائية حالياً.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => (
            <Card key={v.id} className="p-5">
              <div className="flex items-start gap-4 flex-wrap">
                {/* Amount badge */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#E8B86D] to-[#B8884A] text-black flex flex-col items-center justify-center shrink-0">
                  <Gift size={20} />
                  <div className="text-base font-bold leading-tight mt-0.5">{Number(v.amount).toFixed(3)}</div>
                  <div className="text-[9px] font-bold opacity-70">OMR</div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-[240px] space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      v.status === "confirmed"
                        ? "bg-green-500/15 text-green-400"
                        : "bg-yellow-500/15 text-yellow-400"
                    }`}>
                      {v.status === "confirmed" ? "مؤكدة ✓" : "بانتظار"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString("ar-OM")}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <div className="bg-input/50 rounded-lg p-2.5">
                      <div className="text-[10px] text-muted-foreground mb-0.5">المُرسِل</div>
                      <div className="font-semibold text-foreground">{v.senderName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{v.senderPhone}</div>
                    </div>
                    <div className="bg-input/50 rounded-lg p-2.5">
                      <div className="text-[10px] text-muted-foreground mb-0.5">المُرسَل إليه</div>
                      <div className="font-semibold text-foreground">{v.recipientName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{v.recipientPhone}</div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    تظهر للمستلم بصيغة: <span className="text-foreground font-semibold">{fromLabel(v)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => openWhatsApp(v.recipientPhone, v)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] text-white text-xs font-bold hover:opacity-90"
                  >
                    <MessageSquare size={14}/> فتح واتساب
                  </button>
                  {v.status === "pending" && (
                    <button
                      onClick={() => onConfirm(v.id)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
                    >
                      <CheckCircle size={14}/> تأكيد الطلب
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(v.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold hover:bg-red-500/25"
                  >
                    <Trash2 size={14}/> حذف
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

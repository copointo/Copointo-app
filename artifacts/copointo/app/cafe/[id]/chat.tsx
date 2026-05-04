import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAFES } from "@/data/mockData";
import { apiFetch, apiPost } from "@/constants/api";
import { loadSavedOrderInfo, saveOrderInfo } from "@/lib/savedOrderInfo";

const BG          = "#000000";
const CARD        = "#0A0606";
const PRIMARY     = "#E8B86D";
const BORDER      = "rgba(232,184,109,0.30)";
const BORDER_SOFT = "rgba(232,184,109,0.18)";
const MUTED       = "#9A8B72";
const ON_PRIMARY  = "#0A0606";
const CREAM       = "#F5E6CC";

interface MenuItem {
  id: string; cafeId: string; name: string; price: number;
  category: string; description: string; available: boolean;
  image?: string | null;
  stockQty?: number | null;
}
interface PriceTier { hours: number; price: number }
interface Table {
  id: string; cafeId: string; number: number; capacity: number;
  available: boolean; hourlyPricing?: PriceTier[];
}
interface ChatInfoItem { id: string; cafeId: string; topic: string; content: string }
interface PopularItem  { name: string; qty: number }
interface CafePublic {
  id: string; name: string;
  openTime?: string; closeTime?: string;
  address?: string; lat?: number; lng?: number;
}

type Step =
  | "free"
  | "order_pick_item"
  | "order_qty"
  | "order_more"
  | "order_type"
  | "order_name"
  | "order_phone"
  | "order_table"
  | "order_plate_sym"
  | "order_plate_num"
  | "order_confirm"
  | "book_table"
  | "book_tier"
  | "book_guests"
  | "book_time"
  | "book_name"
  | "book_phone"
  | "book_confirm";

interface QuickReply { label: string; value: string }
interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  quickReplies?: QuickReply[];
}

interface OrderDraft {
  items: { id: string; name: string; price: number; qty: number; category?: string }[];
  type?: "dine" | "car";
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  plateSymbol?: string;
  plateNumber?: string;
  pendingItem?: { id: string; name: string; price: number; category?: string };
}
interface BookDraft {
  tableId?: string;
  tableNumber?: number;
  capacity?: number;
  hours?: number;
  hourPrice?: number;
  guests?: number;
  time?: string;
  customerName?: string;
  customerPhone?: string;
}

const TIME_SLOTS = [
  "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM",
  "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM",
  "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM",
  "7:00 PM", "8:00 PM",
];

const MAIN_QUICK: QuickReply[] = [
  { label: "🛒 اطلب الآن",  value: "اطلب" },
  { label: "🪑 احجز طاولة", value: "احجز" },
  { label: "📜 القائمة",    value: "القائمة" },
  { label: "💰 الأسعار",    value: "الأسعار" },
  { label: "📍 الموقع",     value: "الموقع" },
  { label: "🕐 ساعات الدوام", value: "الساعات" },
  { label: "⭐ الأكثر طلباً", value: "الأكثر" },
];

const CANCEL_QUICK: QuickReply = { label: "❌ إلغاء", value: "إلغاء" };

const FALLBACK_REPLY =
  "ممتاز! تقدر تختار من الأزرار بالأسفل أو اسألني عن القائمة، الأسعار، الموقع، أو الساعات. وإذا تبي، أقدر أساعدك تطلب أو تحجز.";

function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

function fmtPrice(n: number) { return `${n.toFixed(3)} ر.ع` }

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
}

function includesAny(text: string, words: string[]) {
  const n = normalize(text);
  return words.some(w => n.includes(normalize(w)));
}

export default function CafeChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cafeMock = CAFES.find((c) => c.id === id) ?? CAFES[0];

  const [cafe, setCafe] = useState<CafePublic>({
    id: String(id ?? ""), name: cafeMock?.name ?? "الكوفي",
  });
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [infos, setInfos] = useState<ChatInfoItem[]>([]);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [step, setStep] = useState<Step>("free");
  const [order, setOrder] = useState<OrderDraft>({ items: [] });
  const [book, setBook] = useState<BookDraft>({});

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  // ── Fetch all cafe data on mount ─────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    Promise.allSettled([
      apiFetch<{ cafe: CafePublic }>(`/cafes/${id}`),
      apiFetch<{ items: MenuItem[] }>(`/cafe/${id}/menu`),
      apiFetch<{ tables: Table[] }>(`/cafe/${id}/tables`),
      apiFetch<{ items: ChatInfoItem[] }>(`/cafe/${id}/chat`),
      apiFetch<{ items: PopularItem[] }>(`/cafe/${id}/popular-items`),
    ]).then((results) => {
      if (cancelled) return;
      const [cafeR, menuR, tablesR, infosR, popR] = results;
      let cafeName = cafeMock?.name ?? "الكوفي";
      if (cafeR.status === "fulfilled" && cafeR.value?.cafe) {
        const cf = cafeR.value.cafe;
        cafeName = cf.name || cafeName;
        setCafe({
          id: String(id), name: cafeName,
          openTime: cf.openTime, closeTime: cf.closeTime,
          address: cf.address, lat: cf.lat, lng: cf.lng,
        });
      } else {
        setCafe({ id: String(id), name: cafeName });
      }
      if (menuR.status === "fulfilled") setMenu((menuR.value.items || []).filter(i => i.available !== false));
      if (tablesR.status === "fulfilled") setTables((tablesR.value.tables || []).filter(t => t.available !== false));
      if (infosR.status === "fulfilled") setInfos(infosR.value.items || []);
      if (popR.status === "fulfilled") setPopular(popR.value.items || []);
      setLoadingData(false);
      // Greet after data is loaded so we can mention real cafe name.
      setMessages([{
        id: uid(),
        role: "bot",
        text: `أهلاً بك في ${cafeName} ☕\nأنا مساعدك الذكي. أقدر أساعدك تطلب قهوة أو تحجز طاولة، وأقدر أجاوب أسئلتك عن القائمة والأسعار والموقع.\nاختر من الأزرار أو اكتب سؤالك:`,
        quickReplies: MAIN_QUICK,
      }]);
    });
    // Prefill name/phone from previous orders.
    loadSavedOrderInfo().then((s) => {
      if (cancelled) return;
      const name  = s.dineName || s.bookName || s.carName;
      const phone = s.dinePhone || s.bookPhone || s.carPhone;
      if (name)  setOrder(o => ({ ...o, customerName:  o.customerName  ?? name }));
      if (phone) setOrder(o => ({ ...o, customerPhone: o.customerPhone ?? phone }));
      if (name)  setBook(b => ({ ...b, customerName:  b.customerName  ?? name }));
      if (phone) setBook(b => ({ ...b, customerPhone: b.customerPhone ?? phone }));
    });
    return () => { cancelled = true; };
  }, [id]);

  // ── Helpers ─────────────────────────────────────────────────
  const pushBot = (text: string, quickReplies?: QuickReply[]) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { id: uid(), role: "bot", text, quickReplies }]);
      setIsTyping(false);
    }, 350);
  };

  const pushUser = (text: string) => {
    setMessages(prev => [...prev, { id: uid(), role: "user", text }]);
  };

  const resetToFree = () => {
    setStep("free");
    setOrder({ items: [] });
    setBook({});
  };

  // ── Free-mode keyword answers using fetched data ─────────────
  const answerFree = (raw: string): { text: string; quickReplies?: QuickReply[] } => {
    const text = raw.trim();
    if (!text) return { text: FALLBACK_REPLY, quickReplies: MAIN_QUICK };

    // Custom Q&A from admin first (admin-curated knowledge base)
    const n = normalize(text);
    for (const info of infos) {
      const topicN = normalize(info.topic || "");
      if (topicN && (n.includes(topicN) || topicN.includes(n))) {
        return { text: info.content, quickReplies: MAIN_QUICK };
      }
    }

    // Order/booking intents
    if (includesAny(text, ["اطلب", "طلب", "اشتري", "اشتر", "order", "buy"])) {
      startOrderFlow();
      return { text: "" };
    }
    if (includesAny(text, ["احجز", "حجز", "طاوله", "طاولة", "book", "table", "reservation"])) {
      startBookFlow();
      return { text: "" };
    }

    // Menu listing
    if (includesAny(text, ["قائمه", "قائمة", "منيو", "menu", "اصناف", "اصناف"])) {
      if (menu.length === 0) return { text: "ما عندنا أي منتجات في القائمة حالياً.", quickReplies: MAIN_QUICK };
      const byCat = new Map<string, MenuItem[]>();
      for (const m of menu) {
        const k = m.category || "متنوّع";
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k)!.push(m);
      }
      const lines: string[] = ["📜 قائمة الكوفي:"];
      for (const [cat, items] of byCat) {
        lines.push(`\n• ${cat}:`);
        for (const it of items.slice(0, 8)) {
          lines.push(`   - ${it.name} — ${fmtPrice(it.price)}`);
        }
        if (items.length > 8) lines.push(`   …و ${items.length - 8} أخرى`);
      }
      return { text: lines.join("\n"), quickReplies: [{ label: "🛒 اطلب الآن", value: "اطلب" }, ...MAIN_QUICK.slice(2)] };
    }

    // Prices
    if (includesAny(text, ["سعر", "اسعار", "كم", "price", "cost"])) {
      // Specific item price?
      const found = menu.find(m => normalize(m.name).includes(n) || n.includes(normalize(m.name)));
      if (found) {
        return {
          text: `سعر ${found.name} هو ${fmtPrice(found.price)}.${found.description ? `\n${found.description}` : ""}`,
          quickReplies: [{ label: `🛒 أضِف ${found.name}`, value: `اطلب ${found.name}` }, ...MAIN_QUICK.slice(2)],
        };
      }
      if (menu.length === 0) return { text: "ما عندنا أسعار معروضة حالياً.", quickReplies: MAIN_QUICK };
      const cheapest = [...menu].sort((a, b) => a.price - b.price).slice(0, 5);
      const lines = ["💰 أبرز الأسعار:"];
      for (const it of cheapest) lines.push(`• ${it.name} — ${fmtPrice(it.price)}`);
      return { text: lines.join("\n"), quickReplies: MAIN_QUICK };
    }

    // Location
    if (includesAny(text, ["موقع", "وين", "اين", "العنوان", "location", "address", "where", "خريطه", "خريطة"])) {
      const parts: string[] = [];
      if (cafe.address) parts.push(`📍 العنوان: ${cafe.address}`);
      if (cafe.lat != null && cafe.lng != null) {
        const url = `https://maps.google.com/?q=${cafe.lat},${cafe.lng}`;
        parts.push(`🗺️ على الخريطة:\n${url}`);
      }
      if (parts.length === 0) parts.push("ما عندي موقع محفوظ للكوفي حالياً، تواصل مع الكوفي مباشرة.");
      return { text: parts.join("\n\n"), quickReplies: MAIN_QUICK };
    }

    // Hours
    if (includesAny(text, ["ساعات", "متى", "وقت", "تفتح", "تغلق", "دوام", "open", "close", "hours", "time"])) {
      if (cafe.openTime || cafe.closeTime) {
        return {
          text: `🕐 ساعات الدوام:\nمن ${cafe.openTime ?? "—"} إلى ${cafe.closeTime ?? "—"}`,
          quickReplies: MAIN_QUICK,
        };
      }
      return { text: "ساعات الدوام غير محددة حالياً.", quickReplies: MAIN_QUICK };
    }

    // Popular / best
    if (includesAny(text, ["اكثر", "أكثر", "افضل", "أفضل", "اشهر", "أشهر", "بيست", "popular", "best", "top", "recommend", "ينصح"])) {
      if (popular.length === 0) {
        // Fallback: list top menu items by price (suggesting variety) — never expose order count directly
        const sample = menu.slice(0, 3);
        if (sample.length === 0) return { text: "لسه ما عندنا بيانات الأكثر طلباً.", quickReplies: MAIN_QUICK };
        const lines = ["✨ مقترحاتنا لك:"];
        for (const it of sample) lines.push(`• ${it.name} — ${fmtPrice(it.price)}`);
        return { text: lines.join("\n"), quickReplies: [{ label: "🛒 اطلب الآن", value: "اطلب" }, ...MAIN_QUICK.slice(2)] };
      }
      const lines = ["⭐ الأكثر طلباً عندنا:"];
      for (let i = 0; i < popular.length; i++) {
        lines.push(`${i + 1}. ${popular[i].name}`);
      }
      return { text: lines.join("\n"), quickReplies: [{ label: "🛒 اطلب الآن", value: "اطلب" }, ...MAIN_QUICK.slice(2)] };
    }

    // Cold/hot category shortcuts
    if (includesAny(text, ["بارد", "باردة", "iced", "cold"])) {
      const cold = menu.filter(m => /بارد/.test(m.category) || /cold/i.test(m.name));
      if (cold.length === 0) return { text: "ما عندنا مشروبات باردة حالياً.", quickReplies: MAIN_QUICK };
      const lines = ["🥤 المشروبات الباردة:"];
      for (const it of cold.slice(0, 8)) lines.push(`• ${it.name} — ${fmtPrice(it.price)}`);
      return { text: lines.join("\n"), quickReplies: [{ label: "🛒 اطلب الآن", value: "اطلب" }, ...MAIN_QUICK.slice(2)] };
    }
    if (includesAny(text, ["حار", "حارة", "ساخن", "ساخنة", "hot"])) {
      const hot = menu.filter(m => /ساخن|حار/.test(m.category));
      if (hot.length === 0) return { text: "ما عندنا مشروبات ساخنة حالياً.", quickReplies: MAIN_QUICK };
      const lines = ["☕ المشروبات الساخنة:"];
      for (const it of hot.slice(0, 8)) lines.push(`• ${it.name} — ${fmtPrice(it.price)}`);
      return { text: lines.join("\n"), quickReplies: [{ label: "🛒 اطلب الآن", value: "اطلب" }, ...MAIN_QUICK.slice(2)] };
    }

    // Greetings
    if (includesAny(text, ["مرحبا", "السلام", "هلا", "اهلا", "hi", "hello", "hey"])) {
      return { text: `أهلاً وسهلاً 👋 كيف أقدر أساعدك في ${cafe.name}؟`, quickReplies: MAIN_QUICK };
    }
    if (includesAny(text, ["شكر", "thanks", "thank"])) {
      return { text: "العفو 🤍 أي خدمة!", quickReplies: MAIN_QUICK };
    }

    // Direct item match → show price + add-to-cart shortcut
    const matched = menu.find(m => {
      const mn = normalize(m.name);
      return mn && (n.includes(mn) || mn.includes(n));
    });
    if (matched) {
      return {
        text: `${matched.name} — ${fmtPrice(matched.price)}${matched.description ? `\n${matched.description}` : ""}`,
        quickReplies: [{ label: `🛒 أضِف ${matched.name}`, value: `اطلب ${matched.name}` }, ...MAIN_QUICK.slice(2)],
      };
    }

    return { text: FALLBACK_REPLY, quickReplies: MAIN_QUICK };
  };

  // ── Order flow ───────────────────────────────────────────────
  const startOrderFlow = (preselectName?: string) => {
    setStep("order_pick_item");
    setOrder({ items: [], customerName: order.customerName, customerPhone: order.customerPhone });
    if (menu.length === 0) {
      pushBot("للأسف القائمة فاضية حالياً. تقدر تتواصل مع الكوفي مباشرة.", MAIN_QUICK);
      setStep("free");
      return;
    }
    // If user preselected a known item via "اطلب لاتيه"
    if (preselectName) {
      const nm = normalize(preselectName);
      const found = menu.find(m => {
        const x = normalize(m.name);
        return x && (nm.includes(x) || x.includes(nm));
      });
      if (found) {
        setOrder(o => ({ ...o, pendingItem: { id: found.id, name: found.name, price: found.price, category: found.category } }));
        setStep("order_qty");
        pushBot(`👌 اخترت ${found.name} (${fmtPrice(found.price)}).\nكم العدد؟`, [
          { label: "1", value: "1" }, { label: "2", value: "2" },
          { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" },
          CANCEL_QUICK,
        ]);
        return;
      }
    }
    pushBot(
      "🛒 ممتاز! اختر المنتج اللي تبي تطلبه:",
      [
        ...menu.slice(0, 12).map(m => ({ label: `${m.name} — ${fmtPrice(m.price)}`, value: m.name })),
        CANCEL_QUICK,
      ],
    );
  };

  const handleOrderPickItem = (raw: string) => {
    const n = normalize(raw);
    const found = menu.find(m => {
      const x = normalize(m.name);
      return x && (x === n || n.includes(x) || x.includes(n));
    });
    if (!found) {
      pushBot("ما لقيت هذا المنتج. اختر من الأزرار أو اكتب اسم المنتج بالضبط:", [
        ...menu.slice(0, 12).map(m => ({ label: m.name, value: m.name })),
        CANCEL_QUICK,
      ]);
      return;
    }
    setOrder(o => ({ ...o, pendingItem: { id: found.id, name: found.name, price: found.price, category: found.category } }));
    setStep("order_qty");
    pushBot(`👌 اخترت ${found.name} (${fmtPrice(found.price)}).\nكم العدد؟`, [
      { label: "1", value: "1" }, { label: "2", value: "2" },
      { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" },
      CANCEL_QUICK,
    ]);
  };

  const handleOrderQty = (raw: string) => {
    const qty = parseInt(raw.replace(/\D/g, ""), 10);
    if (!qty || qty < 1 || qty > 99) {
      pushBot("اكتب رقم بين 1 و 99 للكمية:", [
        { label: "1", value: "1" }, { label: "2", value: "2" },
        { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" },
      ]);
      return;
    }
    setOrder(o => {
      if (!o.pendingItem) return o;
      const newItems = [...o.items];
      const idx = newItems.findIndex(i => i.id === o.pendingItem!.id);
      if (idx >= 0) newItems[idx] = { ...newItems[idx], qty: newItems[idx].qty + qty };
      else newItems.push({ ...o.pendingItem, qty });
      return { ...o, items: newItems, pendingItem: undefined };
    });
    setStep("order_more");
    setTimeout(() => {
      const summary = currentOrderSummary([...order.items, ...(order.pendingItem ? [{ ...order.pendingItem, qty }] : [])]);
      pushBot(`تمام ✅ أُضيف للسلة.\n${summary}\n\nتبي تضيف منتج ثاني ولا نكمل الطلب؟`, [
        { label: "➕ أضف منتج ثاني", value: "أضف" },
        { label: "✅ أكمل الطلب",    value: "أكمل" },
        CANCEL_QUICK,
      ]);
    }, 50);
  };

  const handleOrderMore = (raw: string) => {
    if (includesAny(raw, ["اضف", "أضف", "ثاني", "منتج", "اكثر", "more", "add"])) {
      setStep("order_pick_item");
      pushBot("اختر المنتج التالي:", [
        ...menu.slice(0, 12).map(m => ({ label: `${m.name} — ${fmtPrice(m.price)}`, value: m.name })),
        CANCEL_QUICK,
      ]);
      return;
    }
    if (includesAny(raw, ["اكمل", "أكمل", "تم", "خلاص", "انهي", "أنهي", "finish", "done", "نعم"])) {
      if (order.items.length === 0) {
        pushBot("سلة الطلب فاضية! اختر منتج أول:", [
          ...menu.slice(0, 12).map(m => ({ label: m.name, value: m.name })),
          CANCEL_QUICK,
        ]);
        setStep("order_pick_item");
        return;
      }
      setStep("order_type");
      pushBot("هل الطلب جلوس داخل الكوفي ولا توصيل للسيارة؟", [
        { label: "🪑 جلوس داخل",  value: "جلوس" },
        { label: "🚗 سيارة",       value: "سيارة" },
        CANCEL_QUICK,
      ]);
      return;
    }
    pushBot("اختر:", [
      { label: "➕ أضف منتج ثاني", value: "أضف" },
      { label: "✅ أكمل الطلب",    value: "أكمل" },
      CANCEL_QUICK,
    ]);
  };

  const handleOrderType = (raw: string) => {
    if (includesAny(raw, ["جلوس", "داخل", "dine"])) {
      setOrder(o => ({ ...o, type: "dine" }));
      askName();
      return;
    }
    if (includesAny(raw, ["سياره", "سيارة", "توصيل", "car"])) {
      setOrder(o => ({ ...o, type: "car" }));
      askName();
      return;
    }
    pushBot("اختر:", [
      { label: "🪑 جلوس داخل", value: "جلوس" },
      { label: "🚗 سيارة",      value: "سيارة" },
      CANCEL_QUICK,
    ]);
  };

  const askName = () => {
    if (order.customerName) {
      setStep("order_phone");
      if (order.customerPhone) {
        // skip to next required step
        if (order.type === "dine") askTable();
        else askPlateSym();
        return;
      }
      pushBot(`أهلاً ${order.customerName} 👋 اكتب رقم هاتفك للتواصل:`);
      return;
    }
    setStep("order_name");
    pushBot("اكتب اسمك الكامل:");
  };

  const askTable = () => {
    setStep("order_table");
    pushBot("اكتب رقم الطاولة:", [
      { label: "1", value: "1" }, { label: "2", value: "2" },
      { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" },
      CANCEL_QUICK,
    ]);
  };

  const askPlateSym = () => {
    setStep("order_plate_sym");
    pushBot("اكتب حروف لوحة السيارة (مثال: ع أ):");
  };

  const askConfirmOrder = (draft: OrderDraft) => {
    setStep("order_confirm");
    const total = draft.items.reduce((s, i) => s + i.price * i.qty, 0);
    const lines: string[] = ["📋 ملخّص طلبك:"];
    for (const i of draft.items) {
      lines.push(`• ${i.name} × ${i.qty} = ${fmtPrice(i.price * i.qty)}`);
    }
    lines.push(`\n💰 الإجمالي: ${fmtPrice(total)}`);
    lines.push(`👤 ${draft.customerName} • 📞 ${draft.customerPhone}`);
    if (draft.type === "dine") lines.push(`🪑 طاولة رقم ${draft.tableNumber}`);
    else lines.push(`🚗 لوحة: ${draft.plateSymbol} ${draft.plateNumber}`);
    pushBot(lines.join("\n") + "\n\nتأكيد الطلب؟", [
      { label: "✅ تأكيد الطلب", value: "تأكيد" },
      { label: "❌ إلغاء",       value: "إلغاء" },
    ]);
  };

  const submitOrder = async () => {
    setSubmitting(true);
    try {
      const items = order.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, category: i.category }));
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const body: any = {
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        items, subtotal, total: subtotal,
        type: order.type,
        source: "chat",
        status: "pending",
        drinkCount: items.reduce((s, i) => s + (i.qty || 0), 0),
      };
      if (order.type === "dine") body.tableNumber = order.tableNumber;
      else { body.plateSymbol = order.plateSymbol; body.plateNumber = order.plateNumber; }
      const res = await apiPost<{ order?: any }>(`/cafe/${id}/orders`, body);
      const orderId = res?.order?.id ?? "";
      // Persist customer info for next time
      if (order.type === "dine") {
        saveOrderInfo({ dineName: order.customerName, dinePhone: order.customerPhone, dineTable: order.tableNumber });
      } else {
        saveOrderInfo({ carName: order.customerName, carPhone: order.customerPhone, carPlateChar: order.plateSymbol, carPlateNum: order.plateNumber });
      }
      pushBot(
        `🎉 تم إرسال طلبك بنجاح${orderId ? ` (#${String(orderId).slice(-5)})` : ""}!\nسيتم تحضيره قريباً وسيصلك إشعار من الكوفي.`,
        MAIN_QUICK,
      );
      resetToFree();
    } catch (e: any) {
      pushBot(`❌ تعذّر إرسال الطلب: ${e?.message ?? "حاول مرة أخرى"}`, [
        { label: "🔁 أعد المحاولة", value: "تأكيد" },
        { label: "❌ إلغاء", value: "إلغاء" },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Booking flow ─────────────────────────────────────────────
  const startBookFlow = () => {
    if (tables.length === 0) {
      pushBot("للأسف ما فيه طاولات متاحة للحجز حالياً.", MAIN_QUICK);
      setStep("free");
      return;
    }
    setBook({ customerName: book.customerName, customerPhone: book.customerPhone });
    setStep("book_table");
    pushBot("🪑 اختر الطاولة:", [
      ...tables.map(t => ({ label: `طاولة ${t.number} (حتى ${t.capacity}) `, value: `طاولة ${t.number}` })),
      CANCEL_QUICK,
    ]);
  };

  const handleBookTable = (raw: string) => {
    const n = normalize(raw);
    const m = n.match(/(\d+)/);
    let chosen: Table | undefined;
    if (m) chosen = tables.find(t => t.number === parseInt(m[1], 10));
    if (!chosen) {
      pushBot("اختر الطاولة من الأزرار:", [
        ...tables.map(t => ({ label: `طاولة ${t.number} (حتى ${t.capacity}) `, value: `طاولة ${t.number}` })),
        CANCEL_QUICK,
      ]);
      return;
    }
    setBook(b => ({ ...b, tableId: chosen!.id, tableNumber: chosen!.number, capacity: chosen!.capacity }));
    const tiers = chosen.hourlyPricing || [];
    if (tiers.length === 0) {
      pushBot("هذه الطاولة بدون أسعار توقيت — اختر طاولة ثانية:", [
        ...tables.filter(t => (t.hourlyPricing?.length ?? 0) > 0).map(t => ({ label: `طاولة ${t.number}`, value: `طاولة ${t.number}` })),
        CANCEL_QUICK,
      ]);
      setStep("book_table");
      return;
    }
    setStep("book_tier");
    pushBot(`اخترت طاولة ${chosen.number} (تتسع لـ ${chosen.capacity}).\n⏱️ اختر مدة الحجز:`, [
      ...tiers.map(t => ({ label: `${t.hours} ساعة — ${fmtPrice(t.price)}`, value: `${t.hours}` })),
      CANCEL_QUICK,
    ]);
  };

  const handleBookTier = (raw: string) => {
    const t = tables.find(x => x.id === book.tableId);
    const tiers = t?.hourlyPricing || [];
    const m = raw.match(/(\d+)/);
    const hours = m ? parseInt(m[1], 10) : NaN;
    const tier = tiers.find(x => x.hours === hours);
    if (!tier) {
      pushBot("اختر المدة من الأزرار:", [
        ...tiers.map(x => ({ label: `${x.hours} ساعة — ${fmtPrice(x.price)}`, value: `${x.hours}` })),
        CANCEL_QUICK,
      ]);
      return;
    }
    setBook(b => ({ ...b, hours: tier.hours, hourPrice: tier.price }));
    setStep("book_guests");
    const cap = book.capacity ?? 4;
    const opts: QuickReply[] = [];
    for (let i = 1; i <= cap; i++) opts.push({ label: `${i}`, value: `${i}` });
    opts.push(CANCEL_QUICK);
    pushBot(`👥 كم عدد الأشخاص؟ (الحد الأقصى ${cap})`, opts);
  };

  const handleBookGuests = (raw: string) => {
    const g = parseInt(raw.replace(/\D/g, ""), 10);
    const cap = book.capacity ?? 4;
    if (!g || g < 1 || g > cap) {
      pushBot(`اختر رقم بين 1 و ${cap}:`, Array.from({ length: cap }, (_, i) => ({ label: `${i + 1}`, value: `${i + 1}` })));
      return;
    }
    setBook(b => ({ ...b, guests: g }));
    setStep("book_time");
    pushBot("🕐 اختر وقت الحجز:", [
      ...TIME_SLOTS.map(t => ({ label: t, value: t })),
      CANCEL_QUICK,
    ]);
  };

  const handleBookTime = (raw: string) => {
    const r = raw.trim();
    const found = TIME_SLOTS.find(t => t.toLowerCase() === r.toLowerCase());
    if (!found) {
      pushBot("اختر الوقت من الأزرار:", TIME_SLOTS.map(t => ({ label: t, value: t })));
      return;
    }
    setBook(b => ({ ...b, time: found }));
    if (book.customerName && book.customerPhone) {
      askConfirmBook({ ...book, time: found });
      return;
    }
    if (!book.customerName) {
      setStep("book_name");
      pushBot("اكتب اسمك الكامل:");
    } else {
      setStep("book_phone");
      pushBot("اكتب رقم هاتفك:");
    }
  };

  const askConfirmBook = (draft: BookDraft) => {
    setStep("book_confirm");
    const lines = [
      "📋 ملخّص الحجز:",
      `🪑 طاولة ${draft.tableNumber} (تتسع لـ ${draft.capacity})`,
      `⏱️ ${draft.hours} ساعة`,
      `👥 ${draft.guests} ${draft.guests === 1 ? "شخص" : "أشخاص"}`,
      `🕐 ${draft.time}`,
      `💰 السعر: ${fmtPrice(Number(draft.hourPrice ?? 0))}`,
      `👤 ${draft.customerName} • 📞 ${draft.customerPhone}`,
    ];
    pushBot(lines.join("\n") + "\n\nتأكيد الحجز؟", [
      { label: "✅ تأكيد الحجز", value: "تأكيد" },
      { label: "❌ إلغاء",        value: "إلغاء" },
    ]);
  };

  const submitBook = async () => {
    setSubmitting(true);
    try {
      await apiPost(`/cafe/${id}/bookings`, {
        customerName: book.customerName,
        customerPhone: book.customerPhone,
        tableId: book.tableId,
        tableNumber: book.tableNumber,
        date: new Date().toISOString().substring(0, 10),
        time: book.time,
        guests: book.guests,
        hours: book.hours,
      });
      saveOrderInfo({ bookName: book.customerName, bookPhone: book.customerPhone });
      pushBot("🎉 تم إرسال طلب الحجز! ستصلك رسالة تأكيد فور موافقة الكوفي.", MAIN_QUICK);
      resetToFree();
    } catch (e: any) {
      pushBot(`❌ تعذّر الحجز: ${e?.message ?? "حاول مرة أخرى"}`, [
        { label: "🔁 أعد المحاولة", value: "تأكيد" },
        { label: "❌ إلغاء", value: "إلغاء" },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Compute summary helper ───────────────────────────────────
  function currentOrderSummary(items: { name: string; qty: number; price: number }[]) {
    const lines: string[] = ["🛒 السلة الحالية:"];
    let total = 0;
    for (const i of items) {
      lines.push(`• ${i.name} × ${i.qty} = ${fmtPrice(i.price * i.qty)}`);
      total += i.price * i.qty;
    }
    lines.push(`الإجمالي: ${fmtPrice(total)}`);
    return lines.join("\n");
  }

  // ── Main message dispatcher ─────────────────────────────────
  const sendMessage = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    pushUser(text);

    // Universal cancel
    if (includesAny(text, ["الغاء", "إلغاء", "cancel"]) && step !== "free") {
      resetToFree();
      pushBot("تم الإلغاء. كيف أقدر أساعدك؟", MAIN_QUICK);
      return;
    }

    switch (step) {
      case "free": {
        // Special-case "اطلب <اسم منتج>"
        const orderMatch = text.match(/^(?:اطلب|طلب|اشتري)\s+(.+)$/i);
        if (orderMatch) { startOrderFlow(orderMatch[1]); return; }
        const reply = answerFree(text);
        if (reply.text) pushBot(reply.text, reply.quickReplies);
        return;
      }
      case "order_pick_item":  handleOrderPickItem(text); return;
      case "order_qty":        handleOrderQty(text); return;
      case "order_more":       handleOrderMore(text); return;
      case "order_type":       handleOrderType(text); return;
      case "order_name": {
        if (text.length < 2) { pushBot("الاسم قصير جداً، اكتبه كاملاً:"); return; }
        setOrder(o => ({ ...o, customerName: text }));
        if (order.customerPhone) {
          if (order.type === "dine") askTable();
          else askPlateSym();
          return;
        }
        setStep("order_phone");
        pushBot(`أهلاً ${text} 👋 اكتب رقم هاتفك:`);
        return;
      }
      case "order_phone": {
        const digits = text.replace(/\D/g, "");
        if (digits.length < 7) { pushBot("الرقم قصير، اكتب رقم صحيح (٧ أرقام أو أكثر):"); return; }
        setOrder(o => ({ ...o, customerPhone: digits }));
        if (order.type === "dine") askTable();
        else askPlateSym();
        return;
      }
      case "order_table": {
        const digits = text.replace(/\D/g, "");
        if (!digits) { pushBot("اكتب رقم الطاولة (مثل 3):"); return; }
        const draft: OrderDraft = { ...order, tableNumber: digits };
        setOrder(draft);
        askConfirmOrder(draft);
        return;
      }
      case "order_plate_sym": {
        const sym = text.trim();
        if (!sym) { pushBot("اكتب الحروف فقط (مثال: ع أ):"); return; }
        setOrder(o => ({ ...o, plateSymbol: sym }));
        setStep("order_plate_num");
        pushBot("اكتب الأرقام (مثال: 1234):");
        return;
      }
      case "order_plate_num": {
        const digits = text.replace(/\D/g, "");
        if (!digits) { pushBot("اكتب أرقام اللوحة (مثال: 1234):"); return; }
        const draft: OrderDraft = { ...order, plateNumber: digits };
        setOrder(draft);
        askConfirmOrder(draft);
        return;
      }
      case "order_confirm": {
        if (includesAny(text, ["تاكيد", "تأكيد", "نعم", "ok", "yes", "confirm"])) {
          if (!submitting) submitOrder();
        } else {
          resetToFree();
          pushBot("تم إلغاء الطلب. كيف أقدر أساعدك؟", MAIN_QUICK);
        }
        return;
      }
      case "book_table":  handleBookTable(text); return;
      case "book_tier":   handleBookTier(text); return;
      case "book_guests": handleBookGuests(text); return;
      case "book_time":   handleBookTime(text); return;
      case "book_name": {
        if (text.length < 2) { pushBot("الاسم قصير جداً، اكتبه كاملاً:"); return; }
        setBook(b => ({ ...b, customerName: text }));
        if (book.customerPhone) {
          askConfirmBook({ ...book, customerName: text });
        } else {
          setStep("book_phone");
          pushBot(`أهلاً ${text} 👋 اكتب رقم هاتفك:`);
        }
        return;
      }
      case "book_phone": {
        const digits = text.replace(/\D/g, "");
        if (digits.length < 7) { pushBot("الرقم قصير، اكتب رقم صحيح:"); return; }
        const draft: BookDraft = { ...book, customerPhone: digits };
        setBook(draft);
        askConfirmBook(draft);
        return;
      }
      case "book_confirm": {
        if (includesAny(text, ["تاكيد", "تأكيد", "نعم", "ok", "yes", "confirm"])) {
          if (!submitting) submitBook();
        } else {
          resetToFree();
          pushBot("تم إلغاء الحجز. كيف أقدر أساعدك؟", MAIN_QUICK);
        }
        return;
      }
    }
  };

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    sendMessage(t);
  };

  const handleQuickReply = (val: string) => {
    sendMessage(val);
  };

  // Placeholder reflects current step expectation
  const placeholder = useMemo(() => {
    switch (step) {
      case "order_name":   return "اكتب اسمك...";
      case "book_name":    return "اكتب اسمك...";
      case "order_phone":  return "اكتب رقم هاتفك...";
      case "book_phone":   return "اكتب رقم هاتفك...";
      case "order_table":  return "رقم الطاولة...";
      case "order_plate_sym": return "حروف اللوحة (مثل: ع أ)...";
      case "order_plate_num": return "أرقام اللوحة (مثل: 1234)...";
      case "order_qty":    return "اكتب الكمية...";
      default:             return "اسألني عن أي شي...";
    }
  }, [step]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.botAvatar}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>مساعد {cafe.name}</Text>
            <Text style={styles.headerSubtitle}>
              {loadingData ? "جاري تحميل بيانات الكوفي..." : "متصل الآن"}
            </Text>
          </View>
        </View>
        <View style={styles.onlineIndicator} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isLast = index === messages.length - 1;
          const showChips = item.role === "bot" && isLast && !!item.quickReplies?.length && !isTyping;
          return (
            <View>
              <View
                style={[
                  styles.messageRow,
                  item.role === "user" ? styles.userRow : styles.botRow,
                ]}
              >
                {item.role === "bot" && (
                  <View style={styles.botBubbleAvatar}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.userBubble : styles.botBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: item.role === "user" ? ON_PRIMARY : CREAM },
                    ]}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
              {showChips && (
                <View style={styles.chipsRow}>
                  {item.quickReplies!.map((q: QuickReply, i: number) => (
                    <TouchableOpacity
                      key={`${item.id}_${i}`}
                      style={[
                        styles.chip,
                        q.value === "إلغاء" && styles.chipDanger,
                      ]}
                      onPress={() => handleQuickReply(q.value)}
                      disabled={submitting}
                      activeOpacity={0.85}
                    >
                      <Text style={[
                        styles.chipText,
                        q.value === "إلغاء" && styles.chipTextDanger,
                      ]}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          isTyping ? (
            <View style={[styles.messageRow, styles.botRow]}>
              <View style={styles.botBubbleAvatar}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.botBubble]}>
                <Text style={[styles.bubbleText, { color: MUTED }]}>يكتب...</Text>
              </View>
            </View>
          ) : submitting ? (
            <View style={[styles.messageRow, styles.botRow]}>
              <ActivityIndicator color={PRIMARY} />
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={[styles.inputArea, { paddingBottom: bottomPadding + 8 }]}
      >
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? PRIMARY : "rgba(232,184,109,0.15)" },
          ]}
          onPress={handleSend}
          disabled={!input.trim() || submitting}
        >
          <Feather
            name="send"
            size={18}
            color={input.trim() ? ON_PRIMARY : MUTED}
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  botAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  headerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },
  onlineIndicator: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#4CAF50",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "85%",
  },
  userRow: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  botRow:  { alignSelf: "flex-start" },
  botBubbleAvatar: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER_SOFT,
  },
  bubble: {
    borderRadius: 18, padding: 12, maxWidth: "85%", borderWidth: 1,
  },
  userBubble: {
    backgroundColor: PRIMARY, borderColor: PRIMARY, borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: CARD, borderColor: BORDER, borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20,
  },
  chipsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
    marginTop: 8, marginLeft: 36,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
    borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.10)",
  },
  chipDanger: {
    borderColor: "rgba(229,83,83,0.7)",
    backgroundColor: "rgba(229,83,83,0.10)",
  },
  chipText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: PRIMARY,
  },
  chipTextDanger: { color: "#FCA5A5" },
  inputArea: {
    flexDirection: "row",
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: BG, gap: 10, alignItems: "flex-end",
  },
  input: {
    flex: 1, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD, color: CREAM,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
  },
});

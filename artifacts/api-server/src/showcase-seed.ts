/**
 * Showcase / demo content visible ONLY to the special "Copointo" account.
 *
 * The mobile app exposes a hidden login (phone="Copointo", password="C123@c123@")
 * that drops the user into `SHOWCASE_USER_ID`. While signed in as this user,
 * the app sees a fully-populated demo world (10 cafes with menus + images,
 * 10 reels, 10 communities, 100 competitor users, friend chats, etc).
 *
 * Every showcase entity carries `showcaseOnly: true`; the public list
 * endpoints in routes/index.ts filter these out unless the requester's
 * userId matches SHOWCASE_USER_ID, so real users never see this content
 * on their leaderboard / cafe list / reels feed / communities list.
 *
 * Seed is idempotent: each row has a stable id and is only inserted when
 * missing. Safe to call on every boot.
 */

import {
  cafes, users, menuItems, reels, communities, chatMessages, friendships,
  reelLikes, reelComments,
  flushNow, friendScope, type Cafe, type AppUser, type MenuItem, type Reel,
  type Community, type ChatMsg, type Friendship,
  type ReelLike, type ReelComment,
} from "./store.js";

export const SHOWCASE_USER_ID = "copointo-showcase-user";
export const SHOWCASE_USER_PHONE = "Copointo";
export const SHOWCASE_USER_NAME = "Copointo";

const NOW = new Date().toISOString();
const TODAY = NOW.split("T")[0];

// ── Image asset helpers ────────────────────────────────────────────────
// Curated Unsplash photo IDs (stable, free, hot-link friendly).
const CAFE_COVERS = [
  "1554118811-1e0d58224f24", // modern cafe interior
  "1501339847302-ac426a4a7cbb", // cozy cafe
  "1453614512568-c4024d13c247", // espresso bar
  "1442550528053-c431ecb55509", // cafe seating area
  "1559056199-641a0ac8b55e", // coffee counter
  "1521017432531-fbd92d768814", // industrial cafe
  "1559925393-8be0ec4767c8", // barista counter
  "1518057111178-44a106bad636", // dark wood cafe
  "1497935586351-b67a49e012bf", // bright cafe
  "1525610553991-2bede1a236e2", // outdoor seating
];
const CAFE_LOGOS = [
  "1495474472287-4d71bcdd2085", // latte art
  "1517701604599-bb29b565090c", // cappuccino top
  "1509042239860-f550ce710b93", // coffee beans
  "1485808191679-5f86510681a2", // espresso shot
  "1572442388796-11668a67e53d", // coffee cup
  "1461023058943-07fcbe16d735", // pour over
  "1494314671902-399b18174975", // dark coffee
  "1442975631115-c4f7b05b8a2c", // morning brew
  "1551030173-122aabc4489c", // latte
  "1512568400610-62da28bc8a13", // mocha
];
const PRODUCT_IMAGES = [
  "1497636577773-f1231844b336", // espresso
  "1572286258217-215cf8e84630", // cappuccino
  "1461023058943-07fcbe16d735", // pour over
  "1485808191679-5f86510681a2", // shot
  "1495474472287-4d71bcdd2085", // latte art
  "1517701604599-bb29b565090c", // foam top
  "1559925393-8be0ec4767c8", // bar
  "1517242810446-cc8951b2be40", // iced coffee
  "1572442388796-11668a67e53d", // pastry + coffee
  "1525803377221-4f6ccdaa5747", // croissant
  "1486427944299-d1955d23e34d", // donut
  "1551024601-bec78aea704b", // cheesecake
];
function unsplash(id: string, w: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
}
function avatar(n: number): string {
  return `https://i.pravatar.cc/200?img=${((n - 1) % 70) + 1}`;
}

// Pexels free coffee/cafe MP4s (stable CDN, no auth needed).
// Public sample MP4s that allow direct hotlinking (no referer / cookie /
// auth required, with Range support). The original Pexels URLs have started
// returning 403 to non-pexels.com origins (Cloudflare/CloudFront hotlink
// protection), which broke the showcase reels — players just saw a black
// screen. samplelib.com and test-videos.co.uk both serve permissive
// public MP4s with proper Content-Type and Range headers.
const REEL_VIDEOS = [
  "https://download.samplelib.com/mp4/sample-5s.mp4",
  "https://download.samplelib.com/mp4/sample-10s.mp4",
  "https://download.samplelib.com/mp4/sample-15s.mp4",
  "https://download.samplelib.com/mp4/sample-20s.mp4",
  "https://download.samplelib.com/mp4/sample-30s.mp4",
];

// ── Showcase cafes ─────────────────────────────────────────────────────
interface CafeSpec {
  id: string;
  name: string;
  address: string;
  lat: number; lng: number;
  tags: string[];
  openTime: string; closeTime: string;
}
const CAFE_SPECS: CafeSpec[] = [
  { id: "sc-cafe-1",  name: "مقهى المنارة",          address: "شارع السلطان قابوس، مسقط", lat: 23.5859, lng: 58.4059, tags: ["قهوة مختصة","حلويات"],   openTime: "06:00", closeTime: "23:30" },
  { id: "sc-cafe-2",  name: "بيت القهوة العماني",     address: "نزوى الداخلية، نزوى",       lat: 22.9333, lng: 57.5333, tags: ["قهوة عمانية","تراثي"],   openTime: "07:00", closeTime: "23:00" },
  { id: "sc-cafe-3",  name: "كوفي لاونج",            address: "المعبيلة الجنوبية، السيب",  lat: 23.6320, lng: 58.1850, tags: ["لاونج","ايس كوفي"],     openTime: "08:00", closeTime: "01:00" },
  { id: "sc-cafe-4",  name: "روست هاوس",             address: "شارع 18 نوفمبر، الخوض",      lat: 23.5450, lng: 58.1700, tags: ["تحميص","حبوب قهوة"],    openTime: "06:30", closeTime: "23:00" },
  { id: "sc-cafe-5",  name: "إسبريسو بار",           address: "مول عمان، مسقط",             lat: 23.6010, lng: 58.5450, tags: ["إسبريسو","سريع"],        openTime: "09:00", closeTime: "23:30" },
  { id: "sc-cafe-6",  name: "قهوة الرواق",            address: "البريمي، البريمي",            lat: 24.2500, lng: 55.7833, tags: ["جلسات","شاي"],          openTime: "07:30", closeTime: "22:30" },
  { id: "sc-cafe-7",  name: "مقهى الحارة",           address: "صلالة الوسطى، صلالة",         lat: 17.0150, lng: 54.0928, tags: ["شعبي","حلويات"],        openTime: "06:00", closeTime: "23:00" },
  { id: "sc-cafe-8",  name: "The Daily Grind",       address: "شارع المها، الموالح",         lat: 23.6105, lng: 58.2750, tags: ["إنجليزي","كرواسون"],    openTime: "07:00", closeTime: "22:00" },
  { id: "sc-cafe-9",  name: "Coffee Bean House",     address: "البستان، مسقط",                lat: 23.5780, lng: 58.5650, tags: ["بريميوم","قهوة فلتر"],   openTime: "08:00", closeTime: "23:00" },
  { id: "sc-cafe-10", name: "Latte & Co",            address: "صحار التجاري، صحار",            lat: 24.3500, lng: 56.7500, tags: ["لاتيه","حلى"],          openTime: "09:00", closeTime: "00:00" },
];

// ── Showcase menu items per cafe ───────────────────────────────────────
interface MenuSpec {
  name: string;
  price: number;
  category: string;
  description: string;
}
const COMMON_MENU: MenuSpec[] = [
  { name: "إسبريسو",         price: 1.000, category: "قهوة", description: "جرعة مركزة من حبوب مختارة بعناية" },
  { name: "أمريكانو",        price: 1.200, category: "قهوة", description: "إسبريسو ممدد بالماء الساخن" },
  { name: "كابتشينو",        price: 1.500, category: "قهوة", description: "إسبريسو + حليب مرغي + رغوة" },
  { name: "لاتيه",           price: 1.500, category: "قهوة", description: "لاتيه كلاسيكي بفن الرسم" },
  { name: "موكا بارد",       price: 1.800, category: "قهوة", description: "ايس موكا بالشوكولاتة الداكنة" },
  { name: "فلات وايت",        price: 1.700, category: "قهوة", description: "حليب مخملي على إسبريسو مزدوج" },
  { name: "قهوة عمانية",     price: 0.800, category: "قهوة", description: "قهوة عمانية بالهيل والزعفران" },
  { name: "ايس لاتيه",        price: 1.600, category: "قهوة", description: "لاتيه بارد على ثلج مجروش" },
  { name: "كرواسون",         price: 1.300, category: "حلى",  description: "زبدة فرنسية، طازج يومياً" },
  { name: "تشيز كيك التوت",  price: 2.000, category: "حلى",  description: "قاعدة بسكويت + توت طازج" },
];

function buildCafe(spec: CafeSpec, idx: number, ownerPhone: string): Cafe {
  return {
    id: spec.id,
    name: spec.name,
    ownerName: SHOWCASE_USER_NAME,
    ownerPhone,
    logo: unsplash(CAFE_LOGOS[idx % CAFE_LOGOS.length]!, 300),
    image: unsplash(CAFE_COVERS[idx % CAFE_COVERS.length]!, 1200),
    openTime: spec.openTime,
    closeTime: spec.closeTime,
    managerPassword: "0000",
    active: true,
    subscriptionPaid: true,
    subscriptionAmount: 0,
    subscriptionStart: TODAY!,
    subscriptionEnd: new Date(Date.now() + 365 * 86_400_000).toISOString().split("T")[0]!,
    website: "",
    createdAt: NOW,
    rating: 4 + (idx % 2),
    tags: spec.tags,
    address: spec.address,
    lat: spec.lat,
    lng: spec.lng,
    showcaseOnly: true,
  };
}

function buildMenuItems(cafeId: string, cafeIdx: number): MenuItem[] {
  return COMMON_MENU.map((m, i) => ({
    id: `${cafeId}-item-${i + 1}`,
    cafeId,
    name: m.name,
    price: m.price,
    category: m.category,
    description: m.description,
    available: true,
    createdAt: NOW,
    image: unsplash(PRODUCT_IMAGES[(cafeIdx * 3 + i) % PRODUCT_IMAGES.length]!, 600),
    originalPrice: null,
    promoBuyQty: null,
    promoGetQty: null,
    stockQty: null,
    initialStockQty: null,
    showcaseOnly: true,
  }));
}

// ── 100 competitor users + 1 showcase user ─────────────────────────────
const FIRST_NAMES = [
  "أحمد","محمد","علي","حمد","سالم","يوسف","خالد","عبدالله","فهد","ناصر",
  "سلطان","ماجد","طلال","بدر","راشد","فيصل","عمر","حسن","سعيد","عيسى",
  "أمل","نورة","مريم","عائشة","سارة","فاطمة","ليلى","هند","رهف","شيخة",
  "ريم","لمى","دانة","جواهر","موضي","حصة","نهى","غادة","شذى","رؤى",
];
const LAST_NAMES = [
  "البلوشي","الراشدي","الحارثي","السيابي","المعمري","الزعابي","الكندي","الكثيري",
  "المقبالي","الفارسي","الحضرمي","العامري","الشكيلي","النبهاني","الهنائي","الصبحي",
  "العبري","البطاشي","الزدجالي","الرواحي",
];

function buildShowcaseUser(): AppUser {
  return {
    id: SHOWCASE_USER_ID,
    username: "Copointo",
    phone: SHOWCASE_USER_PHONE,
    level: 240,
    totalOrders: 240, // 1 drink == 1 level for showcase data
    banned: false,
    joinedAt: new Date(Date.now() - 365 * 86_400_000).toISOString(),
    name: SHOWCASE_USER_NAME,
    avatar: avatar(1),
    gender: "male",
    equippedFrame: "frame-15",
    equippedBadge: "badge-15",
    equippedBackground: "bg-30",
    equippedCharacter: "char-17",
    equippedUsernameColor: "uc-22",
    equippedTextStyle: "ts-14",
    // Varied per-cafe progress (sum of levels = sum of drinks = 240,
    // matching the global level). Showcase data treats 1 coffee = 1 level
    // for a cleaner per-cafe display.
    cafeProgress: (() => {
      const dist = [50, 42, 35, 28, 24, 20, 15, 12, 8, 6]; // sum = 240
      return Object.fromEntries(
        CAFE_SPECS.map((c, i) => {
          const lvl = dist[i] ?? 0;
          return [c.id, { totalOrders: lvl, level: lvl }];
        }),
      );
    })(),
    showcaseOnly: true,
  };
}

// Cosmetic id pools used to theme each competitor differently. The higher
// the user's rank, the more "premium" cosmetics they get (high ids tend to
// be late-game / shop unlocks). Cycled deterministically per index so the
// roster is stable across boots.
const FRAME_POOL  = ["frame-28","frame-26","frame-25","frame-24","frame-22","frame-20","frame-18","frame-16","frame-14","frame-12","frame-10","frame-8","frame-6","frame-4","frame-2"];
const BADGE_POOL  = ["badge-16","badge-15","badge-14","badge-13","badge-12","badge-11","badge-10","badge-9","badge-8","badge-7","badge-6","badge-5","badge-4","badge-3","badge-2"];
const BG_POOL     = ["bg-31","bg-30","bg-29","bg-28","bg-27","bg-26","bg-24","bg-22","bg-20","bg-18","bg-16","bg-14","bg-12","bg-10","bg-8","bg-6"];
const CHAR_M_POOL = ["char-17","char-15","char-13","char-11","char-9","char-7","char-5","char-3","char-1"];
const CHAR_F_POOL = ["char-18","char-16","char-14","char-12","char-10","char-8","char-6","char-4","char-2"];
const UC_POOL     = ["uc-25","uc-24","uc-23","uc-22","uc-21","uc-20","uc-19","uc-18","uc-17","uc-16","uc-15","uc-14","uc-12","uc-10","uc-8"];
const TS_POOL     = ["ts-20","ts-19","ts-18","ts-17","ts-16","ts-14","ts-12","ts-10","ts-8","ts-6","ts-4","ts-2"];

function buildCompetitors(count: number): AppUser[] {
  const out: AppUser[] = [];
  for (let i = 0; i < count; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const ln = LAST_NAMES[i % LAST_NAMES.length]!;
    const isFemale = i % FIRST_NAMES.length >= 20;
    // Levels 1..239 — never exceeds showcase user's 240. Top competitor at 239.
    const level = Math.max(1, 239 - Math.floor(i * 2.39));
    // Only the top 50 ranked players (low index) get themed cosmetics —
    // the bottom 50 stay bare (no frame/badge/bg/character/uc/ts) so the
    // showcase leaderboard looks like a realistic mix of decorated
    // veterans and plain casual players, not a uniform sea of cosmetics.
    const themed = i < 50;
    const frame = themed ? FRAME_POOL[i % FRAME_POOL.length]! : null;
    const badge = themed ? BADGE_POOL[i % BADGE_POOL.length]! : null;
    const bg    = themed ? BG_POOL[i % BG_POOL.length]! : null;
    const ch    = themed
      ? (isFemale
          ? CHAR_F_POOL[i % CHAR_F_POOL.length]!
          : CHAR_M_POOL[i % CHAR_M_POOL.length]!)
      : null;
    const uc    = themed ? UC_POOL[i % UC_POOL.length]! : null;
    const ts    = themed ? TS_POOL[i % TS_POOL.length]! : null;
    // Per-cafe breakdown so the leaderboard "user detail" panel can show
    // each competitor's progress across the showcase cafes (instead of an
    // empty cafe list). We split each competitor's global `level` across
    // a deterministic subset of 3..10 cafes with decreasing weights, so
    // sum(cafeProgress[].level) === level and sum(totalOrders) === level
    // (1 coffee = 1 level in showcase data).
    const cafeIds = CAFE_SPECS.map(c => c.id);
    const n = cafeIds.length;
    const k = 3 + (i % 8); // 3..10 cafes per competitor
    const startOffset = i % n;
    const picked = Array.from({ length: k }, (_, j) => cafeIds[(startOffset + j) % n]!);
    const weights = Array.from({ length: k }, (_, j) => k - j);
    const wsum = weights.reduce((s, w) => s + w, 0);
    const lvls = weights.map(w => Math.floor((level * w) / wsum));
    let remainder = level - lvls.reduce((s, x) => s + x, 0);
    for (let j = 0; remainder > 0; j = (j + 1) % k) {
      lvls[j] = (lvls[j] ?? 0) + 1;
      remainder--;
    }
    const cafeProgress: Record<string, { totalOrders: number; level: number }> = {};
    picked.forEach((id, idx) => {
      const lvl = lvls[idx] ?? 0;
      if (lvl > 0) cafeProgress[id] = { totalOrders: lvl, level: lvl };
    });

    out.push({
      id: `sc-user-${i + 1}`,
      username: `player_${i + 1}`,
      phone: `+9685${String(1000000 + i).padStart(7, "0")}`,
      level,
      totalOrders: level, // 1 drink == 1 level for showcase data
      banned: false,
      joinedAt: new Date(Date.now() - (200 - i) * 86_400_000).toISOString(),
      name: `${fn} ${ln}`,
      avatar: avatar(i + 2),
      gender: isFemale ? "female" : "male",
      equippedFrame: frame,
      equippedBadge: badge,
      equippedBackground: bg,
      equippedCharacter: ch,
      equippedUsernameColor: uc,
      equippedTextStyle: ts,
      cafeProgress,
      showcaseOnly: true,
    });
  }
  return out;
}

// ── 10 reels tied to the showcase cafes ────────────────────────────────
function buildReels(cafeRows: Cafe[]): Reel[] {
  const descriptions = [
    "صباح القهوة ☕ — جربوا الحبوب العمانية الجديدة!",
    "فن الرسم على اللاتيه — لمسة الفنان 🎨",
    "وصلت دفعة طازجة من حبوب إثيوبيا — التحميص اليوم 🔥",
    "أجواء مساء الخميس عندنا 🌙",
    "تخفيض 30% على الكابتشينو طوال الأسبوع",
    "موكا بارد — مثالي لطقس الصيف 🧊",
    "كرواسون بالشوكولاتة جديد على المنيو 🥐",
    "زاوية القراءة الجديدة — الكتب على حسابنا 📚",
    "كأس مجاني عند كل طلب فوق 5 ريال 🎁",
    "افتتاح فرعنا الجديد قريباً — انتظرونا!",
  ];
  return cafeRows.map((c, i) => ({
    id: `sc-reel-${i + 1}`,
    cafeId: c.id,
    cafeName: c.name,
    cafeLogo: c.logo,
    videoUrl: REEL_VIDEOS[i % REEL_VIDEOS.length]!,
    description: descriptions[i]!,
    orderLink: `/cafe/${c.id}/order`,
    locationUrl: `https://maps.google.com/?q=${c.lat},${c.lng}`,
    views: 1200 + i * 340,
    createdAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    showcaseOnly: true,
  }));
}

// ── Fake likes for the 10 showcase reels ───────────────────────────────
// Each reel gets a varied number of likes from random competitor users
// (sc-user-1..100). Counts grow from ~60 (reel 1) to ~520 (reel 10) so the
// rail counter shows meaningful, varied numbers instead of "0 likes".
function buildReelLikes(competitors: AppUser[]): ReelLike[] {
  const out: ReelLike[] = [];
  // Deterministic PRNG so the same boot reproduces the same fake data
  // (no churn on every restart).
  let s = 0x1a2b3c;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
  for (let i = 0; i < 10; i++) {
    const reelId = `sc-reel-${i + 1}`;
    const target = 60 + i * 52;        // 60, 112, 164, … 528
    const pool = [...competitors];
    // Fisher–Yates shuffle (deterministic via `rand`)
    for (let j = pool.length - 1; j > 0; j--) {
      const k = Math.floor(rand() * (j + 1));
      [pool[j], pool[k]] = [pool[k]!, pool[j]!];
    }
    const picked = pool.slice(0, Math.min(target, pool.length));
    for (const u of picked) {
      out.push({
        reelId,
        userId: u.id,
        userName: u.gameUsername ?? u.name,
        likedAt: new Date(Date.now() - Math.floor(rand() * 14) * 86_400_000).toISOString(),
      });
    }
  }
  return out;
}

// ── Fake Arabic comments for the showcase reels ────────────────────────
function buildReelComments(competitors: AppUser[]): ReelComment[] {
  const samples = [
    "كوفي خرافي ❤️",
    "متى افتتاح الفرع الجديد؟",
    "اللاتيه عندكم الأفضل في عمان 🥛",
    "جربت الموكا أمس — تحفة 🔥",
    "أحب الأجواء عندكم 🌙",
    "تخفيض ممتاز، شكراً!",
    "ممكن قائمة الأسعار؟",
    "وين موقعكم بالضبط؟",
    "أسعاركم مناسبة جداً 👌",
    "حبوب إثيوبيا الجديدة طعمها رهيب ☕",
    "زاوية القراءة فكرة جميلة 📚",
    "الكرواسون بالشوكولاتة لذيذ 🥐",
    "بارستا محترف 👏",
    "كأس مجاني؟ قادمين 🎁",
    "أتمنى يكون عندكم خيارات نباتية 🌱",
    "الخدمة سريعة والذوق رفيع",
    "أفضل كابتشينو جربته 💯",
    "الفن على اللاتيه فعلاً يدخل القلب 🎨",
    "هل يوجد توصيل؟",
    "الديكور جميل ومريح",
  ];
  const out: ReelComment[] = [];
  let s = 0xC0FFEE;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
  for (let i = 0; i < 10; i++) {
    const reelId = `sc-reel-${i + 1}`;
    // 3..10 comments per reel, deterministic
    const n = 3 + Math.floor(rand() * 8);
    for (let j = 0; j < n; j++) {
      const u = competitors[Math.floor(rand() * competitors.length)]!;
      const text = samples[Math.floor(rand() * samples.length)]!;
      out.push({
        id: `sc-cmt-${i + 1}-${j + 1}`,
        reelId,
        userId: u.id,
        userName: u.gameUsername ?? u.name,
        text,
        createdAt: new Date(Date.now() - Math.floor(rand() * 10) * 86_400_000 - j * 3_600_000).toISOString(),
      });
    }
  }
  return out;
}

// ── 10 communities populated from the 100 competitors ──────────────────
// Each community has its own distinct theme: name + matching emoji avatar
// (rendered when the URL avatar fails) + a thematic Unsplash cover.
function buildCommunities(competitors: AppUser[]): Community[] {
  // Larger themed pool than 10 communities — picks below are randomized
  // (Fisher–Yates with a fixed seed so the assignment is stable across
  // boots but visually random, not "comm-1 always = latte" anymore).
  const themePool = [
    { name: "محبي اللاتيه",     emoji: "🥛", img: "1497935586351-b67a49e012bf" },
    { name: "عشاق الإسبريسو",   emoji: "☕", img: "1510707577719-ae7c14805e3a" },
    { name: "مقاهي مسقط",       emoji: "🕌", img: "1518684079-3c830dcef090" },
    { name: "باريستا عُمان",      emoji: "🎽", img: "1521017432531-fbd92d768814" },
    { name: "قهوة الصباح",       emoji: "🌅", img: "1442550528053-c431ecb55509" },
    { name: "جلسات المساء",      emoji: "🌙", img: "1559925393-8be0ec4767c8" },
    { name: "القهوة المختصة",    emoji: "🏆", img: "1559496417950-9d35f4a96ad7" },
    { name: "ذوّاقو القهوة",      emoji: "👃", img: "1495474472287-4d71bcdd2085" },
    { name: "مزارع البن",         emoji: "🌱", img: "1611854779393-1b2da9d400fe" },
    { name: "صانعو القهوة",      emoji: "🧑‍🍳", img: "1453614512568-c4024d13c247" },
    { name: "القهوة الباردة",     emoji: "🧊", img: "1517959105821-eaf2591984ca" },
    { name: "حلويات مع القهوة",  emoji: "🍰", img: "1488477181946-6428a0291777" },
    { name: "كابتشينو ديلوكس",   emoji: "☁️", img: "1572442388796-11668a67e53d" },
    { name: "موكا بريميوم",      emoji: "🍫", img: "1485808191679-5f86510681a2" },
    { name: "محبو الكورتادو",    emoji: "🥤", img: "1534687941688-651ccaafbff8" },
    { name: "قهوة عمانية أصيلة",  emoji: "🇴🇲", img: "1565299624946-b28f40a0ae38" },
    { name: "كاراك وشاي",         emoji: "🫖", img: "1597318181409-cf64d0b5d8a2" },
    { name: "تجارب القهوة",      emoji: "🧪", img: "1462917882517-e150004895fa" },
    { name: "نقاشات الكافيين",    emoji: "💬", img: "1521017432531-fbd92d768814" },
    { name: "صور القهوة",        emoji: "📸", img: "1447933601403-0c6688de566e" },
  ];

  // Tiny deterministic PRNG (mulberry32) seeded with a fixed value so
  // every boot picks the SAME random-looking ordering — no churn.
  const rand = (() => {
    let s = 0xC0FF_EE42 >>> 0;
    return () => {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const shuffled = [...themePool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  // Per-community member counts — explicitly varied (intimate 6-member
  // groups all the way up to a busy 60-member community) so each row in
  // the communities list feels distinct instead of all 10 being clones.
  const sizes = [8, 14, 22, 6, 35, 18, 50, 11, 28, 60];
  // Per-community age in days — spread from 3 days (brand-new) to 6 months
  // so the "created X days ago" subtitle varies as well.
  const agesDays = [3, 9, 18, 32, 7, 75, 120, 14, 45, 180];
  // Whether the showcase user is the founder of each community. Half are
  // led by other competitors so the showcase user appears as just a
  // regular member (or vice) — much more believable than "you founded
  // all 10 communities".
  const showcaseLeads = [true, false, true, false, false, true, false, true, false, false];
  return Array.from({ length: 10 }, (_, i) => {
    const n = shuffled[i]!;
    const size = sizes[i]!;
    const start = Math.floor(rand() * competitors.length);
    const members: string[] = [SHOWCASE_USER_ID];
    // Pick `size` unique competitors via random offsets from `start` so
    // the membership sets across communities don't repeat in fixed slots.
    const seen = new Set<string>([SHOWCASE_USER_ID]);
    let cursor = start;
    while (members.length < size && seen.size < competitors.length + 1) {
      const u = competitors[cursor % competitors.length]!;
      if (!seen.has(u.id)) { members.push(u.id); seen.add(u.id); }
      cursor += 1 + Math.floor(rand() * 3); // jittered stride
    }
    const roles: Record<string, "leader" | "vice" | "senior" | "member"> = {};
    const isShowcaseLeader = showcaseLeads[i]!;
    if (isShowcaseLeader) {
      roles[SHOWCASE_USER_ID] = "leader";
      if (members[1]) roles[members[1]] = "vice";
      if (members[2]) roles[members[2]] = "senior";
    } else {
      // A competitor is the leader — pick the first non-showcase member.
      // The showcase user becomes a normal member (or vice in some cases).
      const leaderId = members.find(id => id !== SHOWCASE_USER_ID);
      if (leaderId) roles[leaderId] = "leader";
      // 50% chance the showcase user is vice instead of plain member, to
      // keep the variety interesting across the 10 communities.
      if (rand() > 0.5) roles[SHOWCASE_USER_ID] = "vice";
      const otherSenior = members.find(id => id !== leaderId && id !== SHOWCASE_USER_ID);
      if (otherSenior) roles[otherSenior] = "senior";
    }
    return {
      id: `sc-comm-${i + 1}`,
      name: `${n.emoji} ${n.name}`,
      avatar: unsplash(n.img, 300),
      members,
      createdBy: isShowcaseLeader
        ? SHOWCASE_USER_ID
        : (members.find(id => id !== SHOWCASE_USER_ID) ?? SHOWCASE_USER_ID),
      createdAt: Date.now() - agesDays[i]! * 86_400_000,
      roles,
      showcaseOnly: true,
    };
  });
}

// ── Friend chats + group chats ─────────────────────────────────────────
function buildChatsAndFriendships(
  competitors: AppUser[],
  comms: Community[],
): { msgs: ChatMsg[]; fships: Friendship[] } {
  const msgs: ChatMsg[] = [];
  const fships: Friendship[] = [];
  const friendIds = competitors.slice(0, 25).map(u => u.id); // 25 friends of showcase user

  // Friendships (showcase user ↔ first 12 competitors).
  for (const fid of friendIds) {
    const a = SHOWCASE_USER_ID < fid ? SHOWCASE_USER_ID : fid;
    const b = SHOWCASE_USER_ID < fid ? fid : SHOWCASE_USER_ID;
    fships.push({ a, b, createdAt: NOW });
  }

  const friendMsgTexts = [
    "أهلاً! وين القهوة اليوم؟ ☕",
    "كوفي المنارة فتح فرع جديد، نجرب؟",
    "شفت الريل الأخير؟ شكله لذيذ 😋",
    "اللاتيه عندهم رهيب والله",
    "تعال نلتقي الساعة 6 في روست هاوس",
    "أنا في الطريق الآن 🚗",
    "جربت القهوة العمانية الجديدة؟",
    "وصلتنا حبوب جديدة من إثيوبيا!",
    "ممتاز، نشوفك بكرا إن شاء الله",
    "ها هي صورة من المكان 📸",
  ];
  // Generate ~3 messages per friend chat (alternating sender).
  friendIds.forEach((fid, fi) => {
    const scope = friendScope(SHOWCASE_USER_ID, fid);
    const competitor = competitors.find(u => u.id === fid)!;
    for (let m = 0; m < 3; m++) {
      const fromShowcase = m % 2 === 0;
      msgs.push({
        id: `sc-msg-friend-${fi}-${m}`,
        kind: "friend",
        scope,
        senderId: fromShowcase ? SHOWCASE_USER_ID : fid,
        text: friendMsgTexts[(fi * 3 + m) % friendMsgTexts.length]!,
        createdAt: new Date(Date.now() - (fi * 3 + m + 1) * 3600_000).toISOString(),
        seenBy: [SHOWCASE_USER_ID, fid],
        senderName: fromShowcase ? SHOWCASE_USER_NAME : (competitor.name || competitor.username),
        recipientName: fromShowcase ? (competitor.name || competitor.username) : SHOWCASE_USER_NAME,
      });
    }
  });

  // A handful of group-chat messages per community.
  const groupMsgTexts = [
    "أهلاً بالأعضاء الجدد! 👋",
    "اليوم نلتقي في مقهى المنارة الساعة 8 مساءً",
    "أحد جرب القهوة الجديدة؟",
    "صورة من تجمعنا أمس 📸",
    "تخفيضات الأسبوع متاحة لأعضاء المجموعة فقط 🎁",
  ];
  comms.forEach((c, ci) => {
    for (let m = 0; m < 3; m++) {
      const senderIdx = (ci + m) % c.members.length;
      const senderId = c.members[senderIdx]!;
      const sender = senderId === SHOWCASE_USER_ID
        ? { name: SHOWCASE_USER_NAME }
        : (competitors.find(u => u.id === senderId) ?? { name: "عضو" });
      msgs.push({
        id: `sc-msg-group-${ci}-${m}`,
        kind: "group",
        scope: c.id,
        senderId,
        text: groupMsgTexts[(ci + m) % groupMsgTexts.length]!,
        createdAt: new Date(Date.now() - (ci * 3 + m + 1) * 7200_000).toISOString(),
        seenBy: [SHOWCASE_USER_ID],
        senderName: sender.name || "عضو",
      });
    }
  });

  return { msgs, fships };
}

// ── Entry point ────────────────────────────────────────────────────────
export async function seedShowcaseData(): Promise<void> {
  let dirty = false;

  // 1) Showcase user (level 240) — upsert so previously-seeded rows pick
  // up newly added/changed fields like the varied cafeProgress.
  {
    const fresh = buildShowcaseUser();
    const idx = users.findIndex(u => u.id === SHOWCASE_USER_ID);
    if (idx === -1) {
      users.push(fresh);
    } else {
      const existing = users[idx]!;
      users[idx] = {
        ...existing,
        level: fresh.level,
        totalOrders: fresh.totalOrders,
        cafeProgress: fresh.cafeProgress,
      };
    }
    dirty = true;
  }

  // 2) 100 competitors — upsert so previously-seeded users pick up newly
  // added cosmetic theme fields (frame/badge/bg/character/uc/ts).
  const wantCompetitors = 100;
  const fresh = buildCompetitors(wantCompetitors);
  for (const u of fresh) {
    const idx = users.findIndex(x => x.id === u.id);
    if (idx === -1) {
      users.push(u);
      dirty = true;
    } else {
      // Preserve runtime-mutable fields the player may have changed
      // (level, totalOrders, joinedAt) but always refresh cosmetic theme
      // and per-cafe progress (so leaderboard panels show real cafe rows
      // for everyone, not just freshly-added competitors).
      const existing = users[idx]!;
      users[idx] = {
        ...existing,
        level: u.level,
        totalOrders: u.totalOrders,
        equippedFrame: u.equippedFrame,
        equippedBadge: u.equippedBadge,
        equippedBackground: u.equippedBackground,
        equippedCharacter: u.equippedCharacter,
        equippedUsernameColor: u.equippedUsernameColor,
        equippedTextStyle: u.equippedTextStyle,
        cafeProgress: u.cafeProgress,
        showcaseOnly: true,
      };
      dirty = true;
    }
  }
  const competitors = users.filter(
    u => u.id.startsWith("sc-user-") && u.showcaseOnly,
  );

  // 3) 10 cafes
  if (!cafes.some(c => c.id === "sc-cafe-10")) {
    CAFE_SPECS.forEach((spec, i) => {
      if (!cafes.some(c => c.id === spec.id)) {
        cafes.push(buildCafe(spec, i, SHOWCASE_USER_PHONE));
        dirty = true;
      }
    });
  }

  // 4) Menu items per cafe
  CAFE_SPECS.forEach((spec, i) => {
    if (!menuItems.some(m => m.cafeId === spec.id)) {
      for (const m of buildMenuItems(spec.id, i)) {
        menuItems.push(m);
      }
      dirty = true;
    }
  });

  // 5) 10 reels — upsert so the source `videoUrl` is refreshed on every
  // boot. Necessary because the original Pexels CDN URLs started 403'ing
  // (hotlink protection) and we swapped to samplelib.com; existing seeded
  // rows would otherwise keep the broken URL forever.
  {
    const cafeRows = CAFE_SPECS.map(s => cafes.find(c => c.id === s.id)!).filter(Boolean);
    for (const r of buildReels(cafeRows)) {
      const idx = reels.findIndex(x => x.id === r.id);
      if (idx === -1) {
        reels.push(r);
      } else {
        const existing = reels[idx]!;
        reels[idx] = { ...existing, videoUrl: r.videoUrl, showcaseOnly: true };
      }
      dirty = true;
    }
  }

  // 5b) Fake likes + comments for the 10 showcase reels. We always rebuild
  // these from scratch so the seed stays deterministic across boots — wipe
  // any previously-seeded `sc-*` rows first, then re-insert. Real-user
  // likes/comments on showcase reels (if any leaked through) are left alone.
  {
    for (let i = reelLikes.length - 1; i >= 0; i--) {
      const l = reelLikes[i]!;
      if (l.reelId.startsWith("sc-reel-") && l.userId.startsWith("sc-user-")) {
        reelLikes.splice(i, 1);
      }
    }
    for (let i = reelComments.length - 1; i >= 0; i--) {
      const c = reelComments[i]!;
      if (c.id.startsWith("sc-cmt-")) {
        reelComments.splice(i, 1);
      }
    }
    for (const l of buildReelLikes(competitors))    reelLikes.push(l);
    for (const c of buildReelComments(competitors)) reelComments.push(c);
    dirty = true;
  }

  // 6) 10 communities — full upsert (replace the WHOLE row, not just
  // name/avatar). The previous behaviour preserved an existing `members`
  // array, which meant changes to the seed's varied member counts /
  // founders / ages couldn't take effect on already-seeded boots. Since
  // the showcase user can't really "join" or "leave" sc-comm-* groups in
  // a way we need to preserve across restarts, it's safe to overwrite.
  for (const c of buildCommunities(competitors)) {
    const idx = communities.findIndex(x => x.id === c.id);
    if (idx === -1) {
      communities.push(c);
    } else {
      communities[idx] = c;
    }
    dirty = true;
  }

  // 7) Friendships + chat messages
  const commRows = communities.filter(c => c.id.startsWith("sc-comm-"));
  const { msgs, fships } = buildChatsAndFriendships(competitors, commRows);
  for (const f of fships) {
    if (!friendships.some(x => x.a === f.a && x.b === f.b)) {
      friendships.push(f);
      dirty = true;
    }
  }
  for (const m of msgs) {
    if (!chatMessages.some(x => x.id === m.id)) {
      chatMessages.push(m);
      dirty = true;
    }
  }

  if (dirty) {
    try { await flushNow(); } catch { /* persist will retry */ }
  }
}

/** Helper for route handlers: true iff the requesting user is allowed to
 *  see showcase-only content. (Currently only the showcase user himself.) */
export function isShowcaseViewer(userId: string | undefined | null): boolean {
  return String(userId ?? "") === SHOWCASE_USER_ID;
}

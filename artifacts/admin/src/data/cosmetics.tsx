/**
 * Cosmetic item catalog for the admin dashboard.
 *
 * Mirrors the mobile app's item catalog (artifacts/copointo/data/*) but renders
 * web-friendly previews so the super-admin can see the actual SHAPE of each item
 * a user owns instead of a raw ID string. Image-backed categories (frames,
 * badges, characters) load their PNGs from assets copied alongside this file;
 * color/style categories (backgrounds, usernameColors, textStyles) are recreated
 * with CSS gradients. Unknown IDs fall back to a small monospace chip.
 */
import React from "react";

export type CosmeticCategory =
  | "frames"
  | "badges"
  | "characters"
  | "backgrounds"
  | "usernameColors"
  | "textStyles";

// ── Image-backed categories: build id → url maps from copied assets ──────────
const frameUrls = import.meta.glob("../assets/cosmetics/frames/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;
const badgeUrls = import.meta.glob("../assets/cosmetics/badges/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;
const charUrls = import.meta.glob("../assets/cosmetics/characters/*.png", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

function buildImageMap(
  urls: Record<string, string>,
  re: RegExp,
  idOf: (n: number) => string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(urls)) {
    const m = re.exec(path);
    if (m) map[idOf(parseInt(m[1], 10))] = url;
  }
  return map;
}

const FRAME_IMG = buildImageMap(frameUrls, /frame-(\d+)\.png$/, n => `frame-${n}`);
const BADGE_IMG = buildImageMap(badgeUrls, /badge-(\d+)\.png$/, n => `badge-${n}`);
const CHAR_IMG = buildImageMap(charUrls, /char-(\d+)\.png$/, n => `char-${n}`);

// ── Display names (for tooltips) ─────────────────────────────────────────────
const FRAME_NAMES: Record<string, string> = {
  "frame-1": "إطار البرونز", "frame-2": "إطار الفضة", "frame-3": "إطار الذهب",
  "frame-4": "إطار الفارس الفضي", "frame-5": "إطار الأرجوان", "frame-6": "إطار اللهب الذهبي",
  "frame-7": "إطار الياقوت الأزرق", "frame-8": "إطار العنبر الوردي", "frame-9": "إطار التاج الملكي",
  "frame-10": "الإطار الأسطوري", "frame-11": "إطار الجمر الأسود", "frame-12": "إطار الجليد الأزرق",
  "frame-13": "إطار الجوهرة البنفسجية", "frame-14": "إطار الزمرد الأخضر", "frame-15": "إطار الذهب الملكي",
  "frame-16": "إطار اللهب البرتقالي", "frame-17": "إطار اللهب البنفسجي", "frame-18": "إطار التنين الزمردي",
  "frame-19": "إطار إكليل الزهور", "frame-20": "إطار السحر الأزرق", "frame-21": "إطار الأجنحة الذهبية",
  "frame-22": "إطار الشوك الأرجواني", "frame-23": "إطار الزمرد القوطي", "frame-24": "إطار الجليد الجناحي",
  "frame-25": "إطار الكون الذهبي", "frame-26": "إطار البخار النحاسي", "frame-28": "إطار الأجنحة الياقوتية",
};
const BADGE_NAMES: Record<string, string> = {
  "badge-1": "وسام البرونز", "badge-2": "وسام الفضة", "badge-3": "وسام الذهب",
  "badge-4": "وسام الفارس الفضي", "badge-5": "وسام الأرجوان", "badge-6": "وسام اللهب الذهبي",
  "badge-7": "وسام الياقوت الأزرق", "badge-8": "وسام العنبر الوردي", "badge-9": "وسام التاج الملكي",
  "badge-10": "الوسام الأسطوري", "badge-11": "وسام الجناح الذهبي", "badge-12": "وسام الجمشت الأرجواني",
  "badge-13": "وسام الزمرد الملكي", "badge-14": "وسام الياقوت الناري", "badge-15": "وسام النجم الذهبي",
  "badge-16": "وسام الكون البنفسجي",
};
const CHAR_NAMES: Record<string, string> = {
  "char-1": "الولد", "char-2": "البنت", "char-3": "الشاب الكاجوال", "char-4": "فتاة الهودي",
  "char-5": "ولد المدرسة", "char-6": "البنت الذهبية", "char-7": "الولد المثقّف", "char-8": "فتاة القهوة",
  "char-9": "المصوّر", "char-10": "ساحر الظلام", "char-11": "ساحرة الذهب", "char-12": "الفارس الذهبي",
  "char-13": "ساحر الكتاب", "char-14": "محارب السيف", "char-15": "ملكة البنفسج", "char-16": "أمير الجليد",
  "char-17": "الملك الذهبي", "char-18": "أميرة الإلف",
};

// ── Color/style categories ───────────────────────────────────────────────────
interface BgDef { name: string; colors: string[] }
const BACKGROUNDS: Record<string, BgDef> = {
  "bg-1": { name: "أحمر كلاسيكي", colors: ["#7F1D1D", "#3B0A0A"] },
  "bg-2": { name: "ليل أرجواني", colors: ["#4A1D7A", "#1B0944"] },
  "bg-3": { name: "محيط هادئ", colors: ["#0E7C9C", "#063B5C"] },
  "bg-4": { name: "غابة زمردية", colors: ["#0F8A3F", "#0B3D1F"] },
  "bg-5": { name: "وردي حالم", colors: ["#F472B6", "#9D174D"] },
  "bg-6": { name: "شفق ذهبي", colors: ["#E8B86D", "#8B5A2B", "#3a2510"] },
  "bg-7": { name: "غروب الكوفي", colors: ["#FF6B35", "#D6336C", "#7B1F4F"] },
  "bg-8": { name: "سماء صافية", colors: ["#38BDF8", "#1E40AF"] },
  "bg-9": { name: "بحر فيروزي", colors: ["#14B8A6", "#0F766E", "#064E3B"] },
  "bg-10": { name: "زمرد ملكي", colors: ["#10B981", "#065F46"] },
  "bg-11": { name: "كرز ملتهب", colors: ["#EF4444", "#7F1D1D"] },
  "bg-12": { name: "لافندر", colors: ["#A78BFA", "#5B21B6"] },
  "bg-13": { name: "شمس صحراوية", colors: ["#FACC15", "#F97316", "#9A3412"] },
  "bg-14": { name: "أوركيد", colors: ["#D946EF", "#7E22CE"] },
  "bg-15": { name: "فجر وردي", colors: ["#FBCFE8", "#FB7185", "#9F1239"] },
  "bg-16": { name: "نيون", colors: ["#06B6D4", "#A21CAF", "#F97316"] },
  "bg-17": { name: "مجرة", colors: ["#312E81", "#7E22CE", "#DB2777"] },
  "bg-18": { name: "ذهب وردي", colors: ["#7A1F3D", "#C2185B", "#E8B86D"] },
  "bg-19": { name: "ليل عميق", colors: ["#1E3A8A", "#0F172A", "#000000"] },
  "bg-20": { name: "نار ملكية", colors: ["#7F1D1D", "#EA580C", "#FACC15"] },
  "bg-22": { name: "ألماس أسود", colors: ["#000000", "#0A0A12", "#15151F", "#050508"] },
  "bg-26": { name: "قلعة الخفافيش", colors: ["#0A0008", "#2A0710", "#5B0E1F", "#1A0008"] },
  "bg-27": { name: "وادي اللهب", colors: ["#1A0500", "#3D0E00", "#6B1F00", "#0A0200"] },
  "bg-28": { name: "محيط الأعماق", colors: ["#000814", "#001D3D", "#003566", "#000814"] },
  "bg-29": { name: "غابة الأشباح", colors: ["#020D02", "#0A2E0A", "#1F4D1F", "#020D02"] },
  "bg-30": { name: "عرين التنانين", colors: ["#0F0014", "#2E0A3D", "#5B1A7A", "#0F0014"] },
  "bg-31": { name: "عاصفة الطيور", colors: ["#1A0F00", "#3D2410", "#6B4A1F", "#1A0F00"] },
};

interface UcDef { name: string; text: string[]; bg: string[]; border: string }
const USERNAME_COLORS: Record<string, UcDef> = {
  "uc-16": { name: "غروب فخم", text: ["#FFD93D", "#FFFFFF", "#FFD93D"], bg: ["#3B0F0F", "#7C2D12", "#3B0F0F"], border: "#FF8A4C" },
  "uc-17": { name: "محيط فخم", text: ["#7DD3FC", "#FFFFFF", "#7DD3FC"], bg: ["#0C1E3D", "#1E3A8A", "#0C1E3D"], border: "#60A5FA" },
  "uc-18": { name: "زمرد فخم", text: ["#A7F3D0", "#FFFFFF", "#A7F3D0"], bg: ["#022C22", "#065F46", "#022C22"], border: "#34D399" },
  "uc-19": { name: "ملكي بنفسجي", text: ["#E9D5FF", "#FFFFFF", "#E9D5FF"], bg: ["#1E1033", "#4C1D95", "#1E1033"], border: "#C084FC" },
  "uc-20": { name: "ذهب ملكي", text: ["#FFF1B0", "#FFD700", "#FFF1B0"], bg: ["#2A1A05", "#5C3D0A", "#2A1A05"], border: "#FFD700" },
  "uc-21": { name: "💖 وردي ماسي", text: ["#FFD6F1", "#FF6FB5", "#C71585", "#FF6FB5", "#FFD6F1"], bg: ["#2A0820", "#5C1148", "#2A0820"], border: "#FF6FB5" },
  "uc-22": { name: "🌈 أسطوري", text: ["#FF3B3B", "#FFB400", "#3CD96C", "#3A8DFF", "#A640FF", "#FF3B3B"], bg: ["#0a0a0a", "#1a0a2e", "#0a0a0a"], border: "#A640FF" },
  "uc-23": { name: "💚 لايم نيون", text: ["#F4FFB0", "#C8FF3D", "#7CFC00", "#C8FF3D", "#F4FFB0"], bg: ["#0B1F00", "#1E4A00", "#0B1F00"], border: "#C8FF3D" },
  "uc-24": { name: "🟠 نحاسي ملكي", text: ["#FFD4A8", "#E07A28", "#7C3A0E", "#E07A28", "#FFD4A8"], bg: ["#1F0E04", "#4A1F08", "#1F0E04"], border: "#E07A28" },
  "uc-25": { name: "⚪ فضي بلاتيني", text: ["#FFFFFF", "#D9DCE0", "#8C97A1", "#D9DCE0", "#FFFFFF"], bg: ["#0E1116", "#252A33", "#0E1116"], border: "#D9DCE0" },
};

interface TsDef { name: string; textColor: string; bg: string[]; border: string }
const TEXT_STYLES: Record<string, TsDef> = {
  "ts-1": { name: "أبيض", textColor: "#FFFFFF", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-2": { name: "ذهبي", textColor: "#FFD700", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-3": { name: "أحمر", textColor: "#EF4444", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-4": { name: "أخضر", textColor: "#22C55E", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-5": { name: "أزرق", textColor: "#3B82F6", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-6": { name: "بنفسجي", textColor: "#8B5CF6", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-7": { name: "وردي", textColor: "#EC4899", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-8": { name: "تركواز", textColor: "#06B6D4", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-9": { name: "ليموني", textColor: "#FACC15", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-10": { name: "برتقالي", textColor: "#F97316", bg: ["rgba(10,6,6,0.85)"], border: "rgba(232,184,109,0.30)" },
  "ts-11": { name: "ثيم بحري", textColor: "#E0F2FE", bg: ["#0C1E3D", "#1E3A8A"], border: "#60A5FA" },
  "ts-12": { name: "ثيم زمردي", textColor: "#D1FAE5", bg: ["#022C22", "#065F46"], border: "#34D399" },
  "ts-13": { name: "ثيم بنفسجي", textColor: "#F3E8FF", bg: ["#1E1033", "#4C1D95"], border: "#C084FC" },
  "ts-14": { name: "ثيم وردي", textColor: "#FCE7F3", bg: ["#3B0F26", "#9D174D"], border: "#F472B6" },
  "ts-15": { name: "ثيم رمادي ناعم", textColor: "#FFFFFF", bg: ["#1A1A1A", "#2D2D2D"], border: "#9CA3AF" },
  "ts-16": { name: "نار متحركة", textColor: "#FFE4B5", bg: ["#3B0F0F", "#7C2D12"], border: "#FB923C" },
  "ts-17": { name: "ذهب لامع", textColor: "#000000", bg: ["#FFD700", "#FFA500", "#FFD700"], border: "#FFF1B0" },
  "ts-18": { name: "محيط لامع", textColor: "#E0F2FE", bg: ["#0C1E3D", "#1E3A8A", "#0C1E3D"], border: "#7DD3FC" },
  "ts-19": { name: "بنفسجي ملكي", textColor: "#F3E8FF", bg: ["#1E1033", "#4C1D95", "#1E1033"], border: "#E9D5FF" },
  "ts-20": { name: "أسطوري", textColor: "#FFFFFF", bg: ["#FF6B6B", "#FFD93D", "#22C55E", "#3B82F6", "#8B5CF6"], border: "#FFFFFF" },
};

const grad = (stops: string[], angle = "135deg") =>
  stops.length === 1 ? stops[0] : `linear-gradient(${angle}, ${stops.join(", ")})`;

/** Human-readable name for an owned item ID (used as a tooltip). */
export function cosmeticName(category: CosmeticCategory, id: string): string {
  switch (category) {
    case "frames": return FRAME_NAMES[id] ?? id;
    case "badges": return BADGE_NAMES[id] ?? id;
    case "characters": return CHAR_NAMES[id] ?? id;
    case "backgrounds": return BACKGROUNDS[id]?.name ?? id;
    case "usernameColors": return USERNAME_COLORS[id]?.name ?? id;
    case "textStyles": return TEXT_STYLES[id]?.name ?? id;
    default: return id;
  }
}

/** Renders the visual SHAPE of a single owned cosmetic item. */
export function CosmeticShape({
  category, id, size = 44,
}: { category: CosmeticCategory; id: string; size?: number }) {
  const title = cosmeticName(category, id);
  const box: React.CSSProperties = {
    width: size, height: size,
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 10, overflow: "hidden", flexShrink: 0,
  };

  if (category === "frames" || category === "badges" || category === "characters") {
    const url =
      category === "frames" ? FRAME_IMG[id]
      : category === "badges" ? BADGE_IMG[id]
      : CHAR_IMG[id];
    if (!url) return <FallbackChip id={id} />;
    return (
      <div
        title={title}
        style={{ ...box, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(232,184,109,0.18)" }}
      >
        <img src={url} alt={title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
    );
  }

  if (category === "backgrounds") {
    const def = BACKGROUNDS[id];
    if (!def) return <FallbackChip id={id} />;
    return <div title={title} style={{ ...box, background: grad(def.colors), border: "1px solid rgba(255,255,255,0.15)" }} />;
  }

  if (category === "usernameColors") {
    const def = USERNAME_COLORS[id];
    if (!def) return <FallbackChip id={id} />;
    return (
      <div
        title={title}
        style={{
          ...box, width: size * 1.6, background: grad(def.bg),
          border: `1px solid ${def.border}`,
        }}
      >
        <span
          style={{
            fontWeight: 800, fontSize: size * 0.32,
            backgroundImage: grad(def.text, "90deg"),
            WebkitBackgroundClip: "text", backgroundClip: "text",
            WebkitTextFillColor: "transparent", color: "transparent",
          }}
        >
          الاسم
        </span>
      </div>
    );
  }

  // textStyles → mini chat bubble
  const def = TEXT_STYLES[id];
  if (!def) return <FallbackChip id={id} />;
  return (
    <div
      title={title}
      style={{
        ...box, width: size * 1.6, background: grad(def.bg),
        border: `1px solid ${def.border}`,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: size * 0.32, color: def.textColor }}>نص</span>
    </div>
  );
}

function FallbackChip({ id }: { id: string }) {
  return (
    <span
      title={id}
      dir="ltr"
      className="inline-flex items-center px-2 py-1 rounded-md bg-muted/40 border border-border text-[10px] font-mono text-muted-foreground"
    >
      {id}
    </span>
  );
}

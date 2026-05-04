import { useEffect, useRef, useState } from "react";
import { Plus, Power, Trash2, X, Clock, Phone, Lock, MapPin, Tag, LayoutDashboard, Copy, Check, ExternalLink, Upload, ImageIcon, Globe, Download, Coffee, User as UserIcon, Pencil } from "lucide-react";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";

interface Cafe {
  id: string; name: string; ownerName: string; ownerPhone: string; logo: string; image: string;
  openTime: string; closeTime: string; managerPassword: string;
  active: boolean; subscriptionAmount: number; createdAt: string;
  subscriptionStart: string; subscriptionEnd: string;
  website: string;
  rating: number; address: string; tags: string[]; lat?: number; lng?: number;
}

const today = new Date().toISOString().split("T")[0];
const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
const nextYearStr = nextYear.toISOString().split("T")[0];

const EMPTY = { name: "", ownerName: "", ownerPhone: "", logo: "", image: "", openTime: "07:00", closeTime: "23:00", managerPassword: "", address: "", tags: "", subscriptionStart: today, subscriptionEnd: nextYearStr, subscriptionAmount: "300", website: "", lat: "", lng: "" };

// Manager dashboard URL  →  /admin/cafe/:id
function managerUrl(id: string) {
  const base = window.location.origin + (import.meta.env.BASE_URL ?? "/admin").replace(/\/$/, "");
  return `${base}/cafe/${id}`;
}
// Customer-facing cafe page URL  →  same origin root + /cafe/:id
function customerUrl(id: string) {
  return `${window.location.origin}/cafe/${id}`;
}

export default function CafesPage() {
  const [cafes,     setCafes]     = useState<Cafe[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(false);
  const [form,      setForm]      = useState({ ...EMPTY });
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");
  // When set, the modal acts as an "edit" form for this cafe id (otherwise
  // it acts as an "add" wizard). Edit mode keeps the same UI but tweaks
  // labels, validation (password optional), and the submit endpoint.
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = editingId !== null;

  // Logo file state
  const [logoPreview, setLogoPreview] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target?.result as string;
      if (!rawDataUrl) return;
      setLogoPreview(rawDataUrl);
      setForm(p => ({ ...p, logo: rawDataUrl }));
      const img = new Image();
      img.onload = () => {
        try {
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const MAX = 400;
            const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1);
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.naturalWidth  * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL("image/jpeg", 0.75);
              if (compressed.length > 3000) {
                setLogoPreview(compressed);
                setForm(p => ({ ...p, logo: compressed }));
              }
            }
          }
        } catch { /* keep raw */ }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const resetLogo = () => {
    setLogoPreview("");
    setForm(p => ({ ...p, logo: "" }));
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Cover image state
  const [coverPreview,    setCoverPreview]    = useState("");
  const [coverProcessing, setCoverProcessing] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverProcessing(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target?.result as string;
      if (!rawDataUrl) { setCoverProcessing(false); return; }
      // Show preview immediately — data URL always works
      setCoverPreview(rawDataUrl);
      // Store raw first (safe fallback in case canvas fails)
      setForm(p => ({ ...p, image: rawDataUrl }));
      // Try to compress via canvas
      const img = new Image();
      img.onload = () => {
        try {
          // Guard: if the image didn't load real pixel data (sandboxed iframe),
          // img.naturalWidth will be 0 — keep raw data URL in that case
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const MAX_W = 800, MAX_H = 400;
            const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
            const canvas = document.createElement("canvas");
            canvas.width  = Math.round(img.naturalWidth  * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL("image/jpeg", 0.65);
              // Only use compressed if it's a real image (>= 5 KB base64 ≈ covers a blank white JPEG)
              if (compressed.length > 5000) {
                setForm(p => ({ ...p, image: compressed }));
              }
              // else: keep rawDataUrl already stored above
            }
          }
          // else: naturalWidth=0 means sandboxed; keep rawDataUrl
        } catch { /* keep raw data URL */ }
        setCoverProcessing(false);
      };
      img.onerror = () => setCoverProcessing(false);
      img.src = rawDataUrl;
    };
    reader.onerror = () => setCoverProcessing(false);
    reader.readAsDataURL(file);
  };

  const resetCover = () => {
    setCoverPreview("");
    setForm(p => ({ ...p, image: "" }));
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  // Success state: holds the newly-added cafe
  const [newCafe,        setNewCafe]        = useState<Cafe | null>(null);
  const [copiedManager,  setCopiedManager]  = useState(false);
  const [copiedCustomer, setCopiedCustomer] = useState(false);
  const qrManagerRef  = useRef<HTMLDivElement>(null);
  const qrCustomerRef = useRef<HTMLDivElement>(null);

  const load = () => api.getCafes().then(d => setCafes(d.cafes)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  // Wizard step state (1=basics, 2=location, 3=branding)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Try to extract lat/lng from a pasted Google Maps URL.
  // Supports patterns like ".../@23.5880,58.4080,17z" and "?q=23.58,58.40".
  const parseLatLng = (url: string): { lat: string; lng: string } | null => {
    if (!url) return null;
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return { lat: at[1], lng: at[2] };
    const q = url.match(/[?&!]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (q) return { lat: q[1], lng: q[2] };
    const ll = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (ll) return { lat: ll[1], lng: ll[2] };
    return null;
  };

  const goNext = () => {
    setErr("");
    if (step === 1) {
      // In edit mode, managerPassword is optional (empty = keep existing).
      const pwOk = isEditing ? true : !!form.managerPassword;
      if (!form.name || !form.ownerName || !form.ownerPhone || !pwOk) {
        setErr("يرجى تعبئة جميع الحقول المطلوبة"); return;
      }
      setStep(2); return;
    }
    if (step === 2) {
      if (!form.openTime || !form.closeTime) {
        setErr("يرجى تحديد وقت الفتح ووقت الإغلاق"); return;
      }
      setStep(3); return;
    }
  };
  const goBack = () => { setErr(""); setStep(s => (s === 3 ? 2 : 1)); };
  const resetWizard = () => { setStep(1); setErr(""); setForm({ ...EMPTY }); resetLogo(); resetCover(); setEditingId(null); };

  // Open the modal in EDIT mode for an existing cafe — pre-fills the form
  // from the cafe row and remembers the id so submit() will PATCH instead
  // of POST.
  const openEdit = (c: Cafe) => {
    setEditingId(c.id);
    setForm({
      name:               c.name              ?? "",
      ownerName:          c.ownerName         ?? "",
      ownerPhone:         c.ownerPhone        ?? "",
      logo:               c.logo              ?? "",
      image:              c.image             ?? "",
      openTime:           c.openTime          ?? "07:00",
      closeTime:          c.closeTime         ?? "23:00",
      managerPassword:    "",                                     // leave blank = keep existing
      address:            c.address           ?? "",
      tags:               (c.tags ?? []).join("، "),
      subscriptionStart:  c.subscriptionStart ?? today,
      subscriptionEnd:    c.subscriptionEnd   ?? nextYearStr,
      subscriptionAmount: String(c.subscriptionAmount ?? "300"),
      website:            c.website           ?? "",
      // Leave lat/lng blank so editing the address triggers re-geocoding on
      // the server. The server will only override when the user pastes a
      // Google Maps URL with embedded coordinates (parseLatLng below).
      lat:                "",
      lng:                "",
    });
    setLogoPreview(c.logo  ?? "");
    setCoverPreview(c.image ?? "");
    setStep(1);
    setErr("");
    setModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Password is required only when ADDING a new cafe.
    const pwOk = isEditing ? true : !!form.managerPassword;
    if (!form.name || !form.ownerName || !form.ownerPhone || !form.openTime || !form.closeTime || !pwOk) {
      setErr("يرجى تعبئة جميع الحقول المطلوبة"); return;
    }
    setSaving(true);
    try {
      console.log("[submit] form.image length:", form.image?.length ?? 0, "form.logo length:", form.logo?.length ?? 0);
      // Auto-extract coordinates from the Google Maps link if user hasn't typed them manually
      const coords = (!form.lat || !form.lng) ? parseLatLng(form.website) : null;
      const lat = coords?.lat ?? form.lat;
      const lng = coords?.lng ?? form.lng;
      const payload = {
        ...form,
        lat,
        lng,
        tags: form.tags.split("،").map(t => t.trim()).filter(Boolean),
        subscriptionStart: form.subscriptionStart,
        subscriptionEnd:   form.subscriptionEnd,
        subscriptionAmount: Number(form.subscriptionAmount) || 0,
      };
      if (isEditing && editingId) {
        // Don't send empty password — server treats empty as "keep existing".
        if (!payload.managerPassword) delete (payload as any).managerPassword;
        await api.updateCafe(editingId, payload);
      } else {
        await api.addCafe(payload);
      }
      const res = await api.getCafes();
      setCafes(res.cafes);
      const wasEditing = isEditing;
      // Find the newly created cafe (only used when ADDING) so we can show
      // the QR success modal afterwards.
      const created = wasEditing ? null : ([...res.cafes].reverse().find(c => c.name === form.name) ?? null);
      setModal(false);
      setEditingId(null);
      if (created) setNewCafe(created);
      setForm({ ...EMPTY });
      setLogoPreview("");
      setCoverPreview("");
      setStep(1);
      setErr("");
    } catch (e: any) {
      const msg = e?.message ? `خطأ: ${e.message.substring(0, 200)}` : isEditing ? "حدث خطأ أثناء التعديل" : "حدث خطأ أثناء الإضافة";
      console.error("[submit] error:", e);
      setErr(msg);
    }
    finally { setSaving(false); }
  };

  const toggle = async (id: string) => {
    try {
      await api.toggleCafe(id);
      setCafes(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("not found") || msg.includes("Cafe not found")) {
        const res = await api.getCafes();
        setCafes(res.cafes);
        alert("هذا الكوفي لم يعد موجوداً، تم تحديث القائمة.");
      } else {
        alert("تعذّر تغيير الحالة: " + msg.substring(0, 200));
      }
    }
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الكوفي؟")) return;
    try {
      await api.deleteCafe(id);
      setCafes(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("not found") || msg.includes("Cafe not found")) {
        // Already gone on the server (e.g. server restarted) — just drop it locally.
        setCafes(prev => prev.filter(c => c.id !== id));
      } else {
        alert("تعذّر الحذف: " + msg.substring(0, 200));
      }
    }
  };

  const copyManagerLink = () => {
    if (!newCafe) return;
    navigator.clipboard.writeText(managerUrl(newCafe.id)).then(() => {
      setCopiedManager(true); setTimeout(() => setCopiedManager(false), 2000);
    });
  };
  const copyCustomerLink = () => {
    if (!newCafe) return;
    navigator.clipboard.writeText(customerUrl(newCafe.id)).then(() => {
      setCopiedCustomer(true); setTimeout(() => setCopiedCustomer(false), 2000);
    });
  };

  const downloadQR = (ref: React.RefObject<HTMLDivElement | null>, label: string) => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `qr-${label}-${newCafe?.name ?? "cafe"}.svg`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">الكوفيهات</h1>
          <p className="text-muted-foreground mt-1">{cafes.length} كوفي مسجل</p>
        </div>
        <button
          onClick={() => { resetWizard(); setModal(true); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
          إضافة كوفي جديد
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الكوفي</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">صاحب الكوفي</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">التوقيت</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الاشتراك</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">مدة الاشتراك</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الموقع</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الحالة</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cafes.map(cafe => (
                <tr key={cafe.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {/* Logo circle */}
                      <div className="relative shrink-0">
                        {cafe.image
                          ? <img src={cafe.image} alt="" className="w-14 h-14 rounded-2xl object-cover border border-border" />
                          : <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center text-2xl">☕</div>
                        }
                        {cafe.logo
                          ? <img src={cafe.logo} alt="" className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full object-cover border-2 border-card shadow" />
                          : <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-amber-500/20 border-2 border-card shadow flex items-center justify-center text-sm">☕</div>
                        }
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{cafe.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cafe.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-foreground font-medium">{cafe.ownerName || "—"}</p>
                    <p className="text-muted-foreground text-xs mt-0.5" dir="ltr">{cafe.ownerPhone}</p>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{cafe.openTime} – {cafe.closeTime}</td>
                  <td className="px-5 py-4">
                    <span className="text-green-400 font-semibold">{cafe.subscriptionAmount} OMR</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-xs space-y-0.5">
                      <p className="text-muted-foreground">البداية: <span className="text-foreground font-medium">{cafe.subscriptionStart || "—"}</span></p>
                      <p className="text-muted-foreground">الانتهاء: <span className={`font-medium ${cafe.subscriptionEnd && cafe.subscriptionEnd < today ? "text-red-400" : "text-foreground"}`}>{cafe.subscriptionEnd || "—"}</span></p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {cafe.website ? (
                      <a href={cafe.website} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs max-w-[140px] truncate">
                        <Globe size={12} /> {cafe.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cafe.active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cafe.active ? "bg-green-400" : "bg-red-400"}`} />
                      {cafe.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setNewCafe(cafe)}
                        title="عرض QR الداشبورد"
                        className="p-2 rounded-lg hover:bg-amber-500/15 text-amber-400 transition-colors flex items-center"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                          <rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/>
                          <rect x="18" y="18" width="3" height="3"/>
                        </svg>
                      </button>
                      <Link href={`/cafe/${cafe.id}`} title="داشبورد الكوفي" className="p-2 rounded-lg hover:bg-primary/15 text-primary transition-colors flex items-center">
                        <LayoutDashboard size={16} />
                      </Link>
                      <button
                        onClick={() => openEdit(cafe)}
                        title="تعديل معلومات الكوفي"
                        aria-label="تعديل معلومات الكوفي"
                        className="p-2 rounded-lg hover:bg-blue-500/15 text-blue-400 transition-colors"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => toggle(cafe.id)}
                        title={cafe.active ? "إيقاف" : "تفعيل"}
                        className={`p-2 rounded-lg transition-colors ${cafe.active ? "hover:bg-red-500/15 text-red-400" : "hover:bg-green-500/15 text-green-400"}`}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => remove(cafe.id)}
                        className="p-2 rounded-lg hover:bg-destructive/15 text-destructive transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cafes.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <div className="text-5xl mb-3">☕</div>
              <p>لا توجد كوفيهات مضافة بعد</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Cafe Modal — 3-step wizard ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setModal(false); resetWizard(); }} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl z-10" dir="rtl">
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{isEditing ? "تعديل الكوفي" : "إضافة كوفي جديد"}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step === 1 && "الخطوة 1 من 3 — معلومات الكوفي والمالك"}
                    {step === 2 && "الخطوة 2 من 3 — الموقع وتواقيت العمل"}
                    {step === 3 && "الخطوة 3 من 3 — التصنيفات والصور"}
                  </p>
                </div>
                <button onClick={() => { setModal(false); resetWizard(); }} className="text-muted-foreground hover:text-foreground">
                  <X size={20} />
                </button>
              </div>
              {/* Stepper */}
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex-1 flex items-center gap-2">
                    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                      step >= s
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border"
                    }`}>
                      {s}
                    </div>
                    {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? "bg-primary" : "bg-border"}`} />}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              {/* ─── STEP 1 — basics ─── */}
              {step === 1 && (
                <>
                  <Field label="اسم الكوفي *" icon={<Coffee size={15} />}>
                    <input value={form.name} onChange={f("name")} placeholder="مثال: روست آند كو" className={inp} />
                  </Field>
                  <Field label="اسم صاحب الكوفي *" icon={<UserIcon size={15} />}>
                    <input value={form.ownerName} onChange={f("ownerName")} placeholder="محمد العبري" className={inp} />
                  </Field>
                  <Field label="رقم هاتف الصاحب *" icon={<Phone size={15} />}>
                    <input value={form.ownerPhone} onChange={f("ownerPhone")} placeholder="9XXXXXXXX" className={inp} dir="ltr" />
                  </Field>
                  <Field label={isEditing ? "باسورد مدير الكوفي (اتركه فارغاً للإبقاء عليه)" : "باسورد مدير الكوفي *"} icon={<Lock size={15} />}>
                    <input type="password" value={form.managerPassword} onChange={f("managerPassword")} placeholder={isEditing ? "اتركه فارغاً للإبقاء على القديم" : "••••••••"} className={inp} dir="ltr" />
                  </Field>
                </>
              )}

              {/* ─── STEP 2 — location ─── */}
              {step === 2 && (
                <>
                  <Field label="رابط الموقع من Google Maps" icon={<Globe size={15} />}>
                    <input
                      value={form.website}
                      onChange={f("website")}
                      placeholder="https://maps.app.goo.gl/..."
                      className={inp}
                      dir="ltr"
                    />
                  </Field>
                  <p className="-mt-2 text-xs text-muted-foreground/80 inline-flex items-center gap-1">
                    <ExternalLink size={11} /> افتح Google Maps ← شارك ← انسخ الرابط والصقه هنا
                  </p>

                  <Field label="العنوان" icon={<MapPin size={15} />}>
                    <input value={form.address} onChange={f("address")} placeholder="مسقط، شارع الروي" className={inp} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="وقت الفتح *" icon={<Clock size={15} />}>
                      <input type="time" value={form.openTime} onChange={f("openTime")} className={inp} />
                    </Field>
                    <Field label="وقت الإغلاق *" icon={<Clock size={15} />}>
                      <input type="time" value={form.closeTime} onChange={f("closeTime")} className={inp} />
                    </Field>
                  </div>
                </>
              )}

              {/* ─── STEP 3 — categories & images ─── */}
              {step === 3 && (
                <>
                  <Field label="التصنيفات (مفصولة بفاصلة عربية)" icon={<Tag size={15} />}>
                    <input value={form.tags} onChange={f("tags")} placeholder="قهوة مختصة، كيك، هادئ" className={inp} />
                  </Field>

                  {/* Cover / Banner image upload */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1.5">
                      <ImageIcon size={15} /> صورة الغلاف (البانر)
                    </label>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCoverFile}
                      className="hidden"
                      id="cover-upload"
                    />
                    {coverPreview ? (
                      <div className="relative rounded-xl overflow-hidden border border-border h-32">
                        <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3 opacity-0 hover:opacity-100 transition-opacity">
                          <label htmlFor="cover-upload" className="cursor-pointer p-2 bg-white/20 rounded-lg hover:bg-white/30 text-white transition-colors">
                            <Upload size={15} />
                          </label>
                          <button type="button" onClick={resetCover} className="p-2 bg-red-500/60 rounded-lg hover:bg-red-500/80 text-white transition-colors">
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="cover-upload"
                        className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Upload size={22} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">اضغط لاختيار صورة الغلاف</span>
                        <span className="text-xs text-muted-foreground/60">صورة عريضة — PNG, JPG, WEBP</span>
                      </label>
                    )}
                  </div>

                  {/* Logo file upload */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1.5">
                      <ImageIcon size={15} /> شعار الكوفي
                    </label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFile}
                      className="hidden"
                      id="logo-upload"
                    />
                    {logoPreview ? (
                      <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-muted/20">
                        <img src={logoPreview} alt="preview" className="w-14 h-14 rounded-xl object-cover border border-border" />
                        <div className="flex-1">
                          <p className="text-sm text-foreground font-medium">تم اختيار الصورة</p>
                          <p className="text-xs text-muted-foreground mt-0.5">اضغط للتغيير أو احذف</p>
                        </div>
                        <div className="flex gap-2">
                          <label htmlFor="logo-upload" className="cursor-pointer p-2 rounded-lg hover:bg-muted/40 text-muted-foreground transition-colors">
                            <Upload size={15} />
                          </label>
                          <button type="button" onClick={resetLogo} className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors">
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="logo-upload"
                        className="flex flex-col items-center justify-center gap-2 w-full py-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Upload size={22} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">اضغط لاختيار صورة الشعار</span>
                        <span className="text-xs text-muted-foreground/60">PNG, JPG, WEBP</span>
                      </label>
                    )}
                  </div>

                  <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-foreground space-y-3">
                    <div>
                      <p className="font-semibold text-primary mb-1">💳 قيمة الاشتراك السنوي</p>
                      <p className="text-muted-foreground text-xs">حدّد المبلغ الذي سيدفعه الكوفي مقابل الاشتراك السنوي.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={form.subscriptionAmount}
                        onChange={e => setForm(f => ({ ...f, subscriptionAmount: e.target.value }))}
                        placeholder="300"
                        className="flex-1 bg-input border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-sm font-bold text-primary whitespace-nowrap">ريال عماني / OMR</span>
                    </div>
                  </div>
                </>
              )}

              {err && <p className="text-destructive text-sm">{err}</p>}

              {/* Navigation buttons */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <button type="button" onClick={goBack} className="px-5 py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted/30">
                    رجوع
                  </button>
                )}
                {step < 3 && (
                  <button type="button" onClick={goNext} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:opacity-90">
                    التالي
                  </button>
                )}
                {step === 3 && (
                  <button type="submit" disabled={saving || coverProcessing} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90">
                    {saving
                      ? (isEditing ? "جاري الحفظ..." : "جاري الإضافة...")
                      : coverProcessing
                        ? "جاري تحميل الصورة..."
                        : (isEditing ? "حفظ التعديلات" : "إضافة الكوفي")}
                  </button>
                )}
                {step === 1 && (
                  <button type="button" onClick={() => { setModal(false); resetWizard(); }} className="px-5 py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted/30">
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── QR Code Modal (two separate QRs) ── */}
      {newCafe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setNewCafe(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl z-10 overflow-hidden" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-gradient-to-l from-amber-900/30 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xl">☕</div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">تم إضافة الكوفي بنجاح!</h2>
                  <p className="text-sm text-muted-foreground">{newCafe.name}</p>
                </div>
              </div>
              <button onClick={() => setNewCafe(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-5">

                {/* ── Manager QR ── */}
                <div className="flex flex-col gap-3 p-4 border border-amber-500/30 rounded-2xl bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-sm">🔐</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">رابط المدير</p>
                      <p className="text-xs text-muted-foreground">لوحة إدارة الكوفي</p>
                    </div>
                  </div>
                  <div ref={qrManagerRef} className="bg-white rounded-xl p-3 shadow flex items-center justify-center">
                    <QRCodeSVG value={managerUrl(newCafe.id)} size={150} level="H" includeMargin={false} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-3 py-2">
                    <span className="flex-1 text-[10px] text-foreground truncate font-mono" dir="ltr">{managerUrl(newCafe.id)}</span>
                    <button onClick={copyManagerLink} className="shrink-0 text-muted-foreground hover:text-foreground" title="نسخ">
                      {copiedManager ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <a href={managerUrl(newCafe.id)} target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 text-white py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                      <ExternalLink size={12} /> فتح الداشبورد
                    </a>
                    <button onClick={() => downloadQR(qrManagerRef, "manager")}
                      className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs hover:bg-muted/30 transition-colors">
                      <Download size={13} />
                    </button>
                  </div>
                </div>

                {/* ── Customer QR ── */}
                <div className="flex flex-col gap-3 p-4 border border-primary/30 rounded-2xl bg-primary/5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-sm">👤</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">رابط الزبائن</p>
                      <p className="text-xs text-muted-foreground">صفحة الكوفي للمستخدمين</p>
                    </div>
                  </div>
                  <div ref={qrCustomerRef} className="bg-white rounded-xl p-3 shadow flex items-center justify-center">
                    <QRCodeSVG value={customerUrl(newCafe.id)} size={150} level="H" includeMargin={false} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-3 py-2">
                    <span className="flex-1 text-[10px] text-foreground truncate font-mono" dir="ltr">{customerUrl(newCafe.id)}</span>
                    <button onClick={copyCustomerLink} className="shrink-0 text-muted-foreground hover:text-foreground" title="نسخ">
                      {copiedCustomer ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <a href={customerUrl(newCafe.id)} target="_blank" rel="noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                      <ExternalLink size={12} /> فتح صفحة الكوفي
                    </a>
                    <button onClick={() => downloadQR(qrCustomerRef, "customer")}
                      className="px-3 py-2 rounded-lg border border-border text-muted-foreground text-xs hover:bg-muted/30 transition-colors">
                      <Download size={13} />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = "w-full bg-input border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground";

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-1.5">
        <span className="text-primary inline-flex items-center">{icon}</span> {label}
      </label>
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Plus, Power, Trash2, X, Clock, Phone, Lock, MapPin, Tag, LayoutDashboard } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";

interface Cafe {
  id: string; name: string; ownerPhone: string; logo: string;
  openTime: string; closeTime: string; managerPassword: string;
  active: boolean; subscriptionAmount: number; createdAt: string;
  rating: number; address: string; tags: string[];
}

const EMPTY = { name: "", ownerPhone: "", logo: "", openTime: "07:00", closeTime: "23:00", managerPassword: "", address: "", tags: "" };

export default function CafesPage() {
  const [cafes,   setCafes]   = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ ...EMPTY });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const load = () => api.getCafes().then(d => setCafes(d.cafes)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.ownerPhone || !form.openTime || !form.closeTime || !form.managerPassword) {
      setErr("يرجى تعبئة جميع الحقول المطلوبة"); return;
    }
    setSaving(true);
    try {
      await api.addCafe({ ...form, tags: form.tags.split("،").map(t => t.trim()).filter(Boolean) });
      await load();
      setModal(false);
      setForm({ ...EMPTY });
      setErr("");
    } catch { setErr("حدث خطأ أثناء الإضافة"); }
    finally { setSaving(false); }
  };

  const toggle = async (id: string) => {
    await api.toggleCafe(id);
    setCafes(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const remove = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الكوفي؟")) return;
    await api.deleteCafe(id);
    setCafes(prev => prev.filter(c => c.id !== id));
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
          onClick={() => setModal(true)}
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
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الحالة</th>
                <th className="text-right text-muted-foreground font-medium px-5 py-3.5">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cafes.map(cafe => (
                <tr key={cafe.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {cafe.logo
                        ? <img src={cafe.logo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        : <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl">☕</div>
                      }
                      <div>
                        <p className="font-semibold text-foreground">{cafe.name}</p>
                        <p className="text-xs text-muted-foreground">{cafe.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-foreground">{cafe.ownerPhone}</td>
                  <td className="px-5 py-4 text-muted-foreground">{cafe.openTime} – {cafe.closeTime}</td>
                  <td className="px-5 py-4">
                    <span className="text-green-400 font-semibold">{cafe.subscriptionAmount} OMR</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cafe.active ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cafe.active ? "bg-green-400" : "bg-red-400"}`} />
                      {cafe.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/cafe/${cafe.id}`} title="داشبورد الكوفي" className="p-2 rounded-lg hover:bg-primary/15 text-primary transition-colors flex items-center">
                        <LayoutDashboard size={16} />
                      </Link>
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

      {/* Add Cafe Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModal(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl z-10" dir="rtl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">إضافة كوفي جديد</h2>
                <p className="text-sm text-muted-foreground mt-0.5">اشتراك سنوي: <span className="text-primary font-bold">300 OMR</span></p>
              </div>
              <button onClick={() => setModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
              {/* Cafe name */}
              <Field label="اسم الكوفي *" icon={<span className="text-base">☕</span>}>
                <input value={form.name} onChange={f("name")} placeholder="مثال: روست آند كو" className={inp} />
              </Field>

              {/* Phone */}
              <Field label="رقم هاتف الصاحب *" icon={<Phone size={15} />}>
                <input value={form.ownerPhone} onChange={f("ownerPhone")} placeholder="9XXXXXXXX" className={inp} dir="ltr" />
              </Field>

              {/* Logo URL */}
              <Field label="رابط شعار الكوفي" icon={<span className="text-base">🖼️</span>}>
                <input value={form.logo} onChange={f("logo")} placeholder="https://..." className={inp} dir="ltr" />
              </Field>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="وقت الفتح *" icon={<Clock size={15} />}>
                  <input type="time" value={form.openTime} onChange={f("openTime")} className={inp} />
                </Field>
                <Field label="وقت الإغلاق *" icon={<Clock size={15} />}>
                  <input type="time" value={form.closeTime} onChange={f("closeTime")} className={inp} />
                </Field>
              </div>

              {/* Address */}
              <Field label="العنوان" icon={<MapPin size={15} />}>
                <input value={form.address} onChange={f("address")} placeholder="مسقط، شارع الروي" className={inp} />
              </Field>

              {/* Tags */}
              <Field label="التصنيفات (مفصولة بفاصلة عربية)" icon={<Tag size={15} />}>
                <input value={form.tags} onChange={f("tags")} placeholder="قهوة مختصة، كيك، هادئ" className={inp} />
              </Field>

              {/* Manager password */}
              <Field label="باسورد مدير الكوفي *" icon={<Lock size={15} />}>
                <input type="password" value={form.managerPassword} onChange={f("managerPassword")} placeholder="••••••••" className={inp} dir="ltr" />
              </Field>

              {/* Subscription note */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-foreground">
                <p className="font-semibold text-primary mb-1">💳 قيمة الاشتراك السنوي</p>
                <p className="text-muted-foreground">سيتم إضافة هذا الكوفي بعد سداد رسوم الاشتراك السنوية البالغة <span className="font-bold text-primary">300 ريال عماني</span>.</p>
              </div>

              {err && <p className="text-destructive text-sm">{err}</p>}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="flex-1 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90">
                  {saving ? "جاري الإضافة..." : "إضافة الكوفي"}
                </button>
                <button type="button" onClick={() => setModal(false)} className="px-5 py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-muted/30">
                  إلغاء
                </button>
              </div>
            </form>
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
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

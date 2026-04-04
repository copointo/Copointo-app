import { useEffect, useState } from "react";
import { Coffee, Users, DollarSign, TrendingUp, Power, UserX } from "lucide-react";
import { api } from "@/lib/api";

interface Stats {
  totalCafes: number;
  activeCafes: number;
  totalRevenue: number;
  totalUsers: number;
  bannedUsers: number;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground">جاري التحميل...</div>;
  if (!stats)  return <div className="flex items-center justify-center h-full text-destructive">حدث خطأ</div>;

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على أداء المنصة</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
        <StatCard
          icon={Coffee}
          label="إجمالي الكوفيهات"
          value={stats.totalCafes}
          sub={`${stats.activeCafes} نشط حالياً`}
          color="bg-amber-700"
        />
        <StatCard
          icon={DollarSign}
          label="إيرادات الاشتراكات"
          value={`${stats.totalRevenue} OMR`}
          sub={`${stats.totalCafes} كوفي × 300 OMR`}
          color="bg-green-700"
        />
        <StatCard
          icon={Users}
          label="المستخدمون"
          value={stats.totalUsers}
          sub={`${stats.bannedUsers} محظور`}
          color="bg-violet-700"
        />
        <StatCard
          icon={TrendingUp}
          label="معدل النمو السنوي"
          value={`${(stats.totalCafes * 300).toLocaleString()} OMR`}
          sub="الإيراد السنوي المتوقع"
          color="bg-sky-700"
        />
        <StatCard
          icon={Power}
          label="الكوفيهات الموقوفة"
          value={stats.totalCafes - stats.activeCafes}
          sub="بانتظار التفعيل"
          color="bg-red-700"
        />
        <StatCard
          icon={UserX}
          label="المستخدمون المحظورون"
          value={stats.bannedUsers}
          sub="تم الإيقاف من المدير"
          color="bg-slate-600"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">تفاصيل الإيرادات</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">اشتراك سنوي لكل كوفي</span>
            <span className="font-semibold text-foreground">300 OMR</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">عدد الكوفيهات المشتركة</span>
            <span className="font-semibold text-foreground">{stats.totalCafes}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">الكوفيهات النشطة</span>
            <span className="font-semibold text-green-400">{stats.activeCafes}</span>
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-foreground font-bold">الإجمالي</span>
            <span className="text-2xl font-bold text-primary">{stats.totalRevenue.toLocaleString()} OMR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

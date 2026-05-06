import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import logoUrl from "@/assets/copointo-logo.png";

export default function LoginPage({ onLogin, password }: { onLogin: () => void; password: string }) {
  const [pass,    setPass]    = useState("");
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (pass === password) { onLogin(); }
      else { setError("كلمة المرور غير صحيحة"); setLoading(false); }
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logoUrl} alt="Copointo" className="mx-auto mb-3 w-20 h-20 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Copointo Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">لوحة تحكم المدير</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={pass}
                onChange={e => { setPass(e.target.value); setError(""); }}
                className="w-full bg-input border border-border rounded-xl px-10 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="أدخل كلمة المرور"
                dir="ltr"
              />
              <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-destructive text-xs mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !pass}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "جاري التحقق..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}

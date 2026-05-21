import type { ReactNode } from "react";
import logoUrl from "@/assets/copointo-logo.png";

const ALLOWED_HOSTS = new Set([
  "copointo.com",
  "www.copointo.com",
  "copointoadmin-al-yaqathan.com",
  "www.copointoadmin-al-yaqathan.com",
]);

function isHostAllowed(hostname: string): boolean {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".replit.dev")) return true;
  if (hostname.endsWith(".replit.app")) return true;
  if (hostname.endsWith(".repl.co")) return true;
  return false;
}

export function HostGuard({ children }: { children: ReactNode }) {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (isHostAllowed(host)) return <>{children}</>;

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full flex flex-col items-center justify-center bg-black text-white px-6 text-center"
    >
      <img
        src={logoUrl}
        alt="Copointo"
        className="w-24 h-24 object-contain mb-6 opacity-80"
      />
      <h1 className="text-2xl font-bold text-[#E8B86D] mb-3">
        غير مسموح بالوصول
      </h1>
      <p className="text-sm text-white/70 max-w-md leading-relaxed mb-2">
        لوحة المدير متاحة فقط من الموقع الرسمي
      </p>
      <a
        href="https://copointo.com/admin/"
        className="text-[#E8B86D] underline text-sm"
      >
        copointo.com/admin
      </a>
    </div>
  );
}

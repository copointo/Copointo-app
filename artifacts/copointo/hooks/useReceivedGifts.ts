import { useEffect, useState } from "react";
import { API_BASE } from "@/constants/api";

/**
 * Total number of gifts a user has received (sum of giftQty). Polls every
 * 15s so the profile stat stays close to live without hammering the API.
 */
export function useReceivedGifts(userId: string | null | undefined): number {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!userId) { setTotal(0); return; }
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/received-gifts`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && typeof data?.total === "number") setTotal(data.total);
      } catch {}
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId]);
  return total;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { useApp, type User } from "@/context/AppContext";
import { playNotificationChime } from "@/lib/notification-sound";

const STORAGE_KEY = (uid: string) => `copointo_rank_ahead_v1:${uid}`;

export interface OvertakerToast {
  id: string;
  name: string;
  level: number;
}

/**
 * Detects when other players overtake the current user in the global "Oman"
 * leaderboard (ranked by level desc).
 *
 * Approach:
 *   - Compute the set of users currently ahead of me (level > mine, or
 *     level === mine but registered earlier — using id as tiebreaker).
 *   - Compare against the previously persisted set in AsyncStorage.
 *   - Anyone in the new set who was NOT in the old set has just overtaken me.
 *   - Persist the new set.
 *   - For each new overtaker, fire a chime and queue a toast.
 *
 * Returns the latest toast to display and a `dismiss()` callback.
 */
export function useRankOvertakeNotifier() {
  const { user, registeredUsers } = useApp();
  const [toast, setToast] = useState<OvertakerToast | null>(null);
  const initializedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      initializedRef.current = false;
      return;
    }

    let cancelled = false;
    const run = async () => {
      const meId = user.id;
      const myLevel = user.level;

      // Build "currently ahead" set using stable level+id comparison.
      const aheadIds = new Set(
        registeredUsers
          .filter(u =>
            u.id !== meId &&
            (u.level > myLevel || (u.level === myLevel && u.id < meId))
          )
          .map(u => u.id),
      );

      const key = STORAGE_KEY(meId);
      let prevAhead: Set<string>;
      try {
        const raw = await AsyncStorage.getItem(key);
        prevAhead = new Set(raw ? (JSON.parse(raw) as string[]) : []);
      } catch {
        prevAhead = new Set();
      }
      if (cancelled) return;

      // First run for this user/session: just snapshot, do not notify.
      if (!initializedRef.current) {
        initializedRef.current = true;
        await AsyncStorage.setItem(key, JSON.stringify([...aheadIds])).catch(() => {});
        return;
      }

      // Find newcomers (someone now ahead who wasn't before).
      const newcomers = [...aheadIds].filter(id => !prevAhead.has(id));
      if (newcomers.length > 0) {
        // Pick the most recent overtaker by highest level, then show as toast.
        const newcomerUsers: User[] = newcomers
          .map(id => registeredUsers.find(u => u.id === id))
          .filter((u): u is User => !!u)
          .sort((a, b) => b.level - a.level);

        const top = newcomerUsers[0];
        if (top) {
          playNotificationChime();
          setToast({ id: top.id, name: top.name, level: top.level });
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => setToast(null), 5000);
        }
      }

      await AsyncStorage.setItem(key, JSON.stringify([...aheadIds])).catch(() => {});
    };

    run();
    return () => { cancelled = true; };
  }, [user, registeredUsers]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return {
    toast,
    dismiss: () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setToast(null);
    },
  };
}

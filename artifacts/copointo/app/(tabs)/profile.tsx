import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { API_BASE, apiFetch } from "@/constants/api";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  enableWebPush,
  disableWebPush,
  isWebPushEnabled,
  isWebPushSupported,
} from "@/lib/webPush";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, claimGameUsername } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useReceivedGifts } from "@/hooks/useReceivedGifts";
import { useSentGifts } from "@/hooks/useSentGifts";
import { useCoins } from "@/hooks/useCoins";
import { RANKS, getRank } from "@/data/mockData";
import { AuthModal } from "@/components/AuthModal";
import AvatarWithFrame from "@/components/AvatarWithFrame";
import UserBadge from "@/components/UserBadge";
import Character from "@/components/Character";
import { getDefaultAvatarSource } from "@/lib/defaultAvatar";
import { useCharacters } from "@/hooks/useCharacters";
import { useFrames } from "@/hooks/useFrames";
import { useBadges } from "@/hooks/useBadges";
import { useUsernameColors } from "@/hooks/useUsernameColors";
import { useTextStyles } from "@/hooks/useTextStyles";
import { useBackgrounds } from "@/hooks/useBackgrounds";
import { getCharacter } from "@/data/characters";
import { getFrame } from "@/data/frames";
import { getBadge } from "@/data/badges";
import { getUsernameColor } from "@/data/usernameColors";
import { getTextStyle } from "@/data/textStyles";
import { getBackground } from "@/data/backgrounds";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.35)";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";

// ─── Edit Modal ──────────────────────────────────────────────
function EditModal({
  visible, title, value, onClose, onSave, secure,
}: {
  visible: boolean; title: string; value: string;
  onClose: () => void; onSave: (v: string) => void;
  secure?: boolean;
}) {
  const [text, setText] = useState(value);
  const [show, setShow]  = useState(false);
  const { t } = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              secureTextEntry={secure && !show}
              autoFocus
              placeholderTextColor="rgba(255,255,255,0.30)"
              placeholder={secure ? "••••••••" : ""}
              selectionColor={PRIMARY}
            />
            {secure && (
              <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
                <Feather name={show ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => { onSave(text); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ─── Logout Confirm Modal ────────────────────────────────────
function LogoutConfirmModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <View style={styles.warnIcon}>
              <Feather name="log-out" size={26} color={DANGER} />
            </View>
            <Text style={styles.modalTitle}>{t("profile.logoutConfirmTitle")}</Text>
            <Text style={styles.confirmSub}>{t("profile.logoutConfirmMsg")}</Text>
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: DANGER }]}
              onPress={() => { onConfirm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{t("profile.logout")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Ranks Journey Modal ─────────────────────────────────────
function RanksModal({
  visible, onClose, currentLevel,
}: { visible: boolean; onClose: () => void; currentLevel: number }) {
  const currentRank = getRank(currentLevel);
  const { t } = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.ranksCard}>
          {/* Header */}
          <View style={styles.ranksHeader}>
            <Text style={styles.ranksTitle}>{t("ranks.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.ranksSubtitle}>
            {t("ranks.youAreAt")} <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>{currentLevel}</Text>
            {"  •  "}
            <Text style={{ color: PRIMARY }}>{currentRank.name}</Text>
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 6 }}>
            {RANKS.map((r) => {
              const isPast    = currentLevel > r.max;
              const isCurrent = currentLevel >= r.min && currentLevel <= r.max;
              const cupsLeft  = Math.max(0, r.min - currentLevel);

              return (
                <View
                  key={r.nameEn}
                  style={[
                    styles.rankRow,
                    isCurrent && styles.rankRowCurrent,
                    isPast && { opacity: 0.55 },
                  ]}
                >
                  {/* Icon */}
                  <View style={[
                    styles.rankRowIcon,
                    isCurrent && { borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.15)" }
                  ]}>
                    <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                  </View>

                  {/* Name + range */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={[styles.rankRowName, isCurrent && { color: PRIMARY }]}>{r.nameEn}</Text>
                      {isCurrent && (
                        <View style={styles.hereBadge}>
                          <Text style={styles.hereBadgeText}>{t("ranks.youAreHere")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.rankRowSub}>{r.name}</Text>
                    <Text style={styles.rankRowRange}>{t("ranks.levelsRange", { min: String(r.min), max: String(r.max) })}</Text>
                  </View>

                  {/* Status */}
                  <View style={styles.rankRowStatus}>
                    {isPast ? (
                      <View style={styles.checkPill}>
                        <Feather name="check" size={14} color="#E8B86D" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.cupsRemainingCol}>
                        <Text style={styles.cupsRemainingNum}>{r.max - currentLevel + 1}</Text>
                        <Text style={styles.cupsRemainingLbl}>{t("ranks.cupsToNext")}</Text>
                      </View>
                    ) : (
                      <View style={styles.cupsRemainingCol}>
                        <View style={styles.cupsPill}>
                          <Text style={{ fontSize: 11 }}>☕</Text>
                          <Text style={styles.cupsPillNum}>{cupsLeft}</Text>
                        </View>
                        <Text style={styles.cupsRemainingLbl}>{t("ranks.remaining")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Footer note */}
          <View style={styles.ranksFooter}>
            <Feather name="info" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={styles.ranksFooterText}>{t("ranks.footer")}</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Free Coffee Codes Modal ─────────────────────────────────
interface FreeCoffeeItem {
  id: string;
  code: string;
  earnedAtLevel: number;
  earnedAt: string;
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
}

function FreeCoffeeModal({
  visible, onClose, coffees,
}: { visible: boolean; onClose: () => void; coffees: FreeCoffeeItem[] }) {
  const available = coffees.filter(c => !c.redeemedAt);
  const used      = coffees.filter(c => c.redeemedAt);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.ranksCard}>
          {/* Header */}
          <View style={styles.ranksHeader}>
            <Text style={styles.ranksTitle}>🎁 الكوفي المجاني</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.ranksSubtitle}>
            تحصل على كوب قهوة مجاني بعد كل ٦ مشروبات — استخدم الكود في نفس الكوفي الذي ربحته فيه.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
            {coffees.length === 0 && (
              <View style={styles.fcEmptyWrap}>
                <Text style={styles.fcEmptyIcon}>☕</Text>
                <Text style={styles.fcEmptyText}>لا يوجد لديك كوفي مجاني بعد</Text>
              </View>
            )}

            {available.map(c => (
              <View key={`fc-av-${c.id}`} style={styles.fcCodeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fcCodeValue}>{c.code}</Text>
                  <Text style={styles.fcCodeMeta}>
                    {c.earnedAtCafeName ? `في ${c.earnedAtCafeName}` : "متاح للاستخدام"}
                  </Text>
                </View>
                <View style={styles.fcStatusPillOk}>
                  <Text style={styles.fcStatusPillOkText}>متاح</Text>
                </View>
              </View>
            ))}

            {used.map(c => (
              <View key={`fc-us-${c.id}`} style={[styles.fcCodeRow, styles.fcCodeRowUsed]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fcCodeValue, styles.fcCodeValueUsed]}>{c.code}</Text>
                  <Text style={styles.fcCodeMeta}>
                    {c.earnedAtCafeName ? `في ${c.earnedAtCafeName}` : "تم الاستخدام"}
                  </Text>
                </View>
                <View style={styles.fcStatusPillUsed}>
                  <Text style={styles.fcStatusPillUsedText}>مستعمل</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 8 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const { user, setUser, logout, deleteAccount, friends, registeredUsers, setActiveGameCafeId } = useApp();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { t, dir } = useT();

  const [authOpen,    setAuthOpen]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteText, setDeleteText]   = useState("");
  const [deleting, setDeleting]       = useState(false);
  const { setCoins } = useCoins();
  const [modal, setModal] = useState<null | "username" | "password">(null);
  const [ranksOpen, setRanksOpen] = useState(false);
  const [fcOpen, setFcOpen] = useState(false);
  const [fcList, setFcList] = useState<FreeCoffeeItem[]>([]);

  // Load ALL free coffees (incl. redeemed) for this signed-in phone so the
  // dedicated "الكوفي المجاني" button can show codes — used ones stay visible
  // in red instead of disappearing.
  useEffect(() => {
    const phone = user?.phone?.trim();
    if (!phone) { setFcList([]); return; }
    let cancelled = false;
    apiFetch<{ coffees: FreeCoffeeItem[] }>(
      `/free-coffees?phone=${encodeURIComponent(phone)}`,
    )
      .then(r => {
        if (cancelled) return;
        const all = (r.coffees ?? []).slice().sort((a, b) => {
          // available first, then most-recent earned
          const au = a.redeemedAt ? 1 : 0;
          const bu = b.redeemedAt ? 1 : 0;
          if (au !== bu) return au - bu;
          return (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "");
        });
        setFcList(all);
      })
      .catch(() => { /* ignore network errors */ });
    return () => { cancelled = true; };
  }, [user?.phone, fcOpen]);

  const fcAvailableCount = fcList.filter(c => !c.redeemedAt).length;

  // ── Push-notification opt-in ──────────────────────────────────────
  // We mirror the "is the user opted in?" state from AsyncStorage so the
  // button shows the right label across cold-starts. The server is the
  // source of truth for actually delivering pushes (it stores the Expo
  // token registered by `register()` below), but we don't need to query
  // it on every mount — checking the local flag + the OS permission is
  // enough to decide whether to show "Enable" or "Enabled ✓".
  const NOTIF_FLAG_KEY = user ? `copointo_notif_enabled_v1_${user.id}` : "";
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const isWeb = Platform.OS === "web";
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) return;
      try {
        if (isWeb) {
          // On web the source of truth is the browser's push subscription
          // + permission — AsyncStorage is unreliable since the user can
          // revoke permission from browser site settings any time.
          if (!isWebPushSupported()) { setNotifEnabled(false); return; }
          const enabled = await isWebPushEnabled();
          if (!cancelled) setNotifEnabled(enabled);
          return;
        }
        const stored = await AsyncStorage.getItem(NOTIF_FLAG_KEY);
        if (cancelled) return;
        if (stored !== "1") { setNotifEnabled(false); return; }
        // Double-check the OS permission — the user may have revoked it
        // from system settings between sessions, in which case we should
        // re-prompt rather than show a misleading "Enabled" state.
        const perm = await Notifications.getPermissionsAsync();
        if (cancelled) return;
        setNotifEnabled(perm.status === "granted");
      } catch { if (!cancelled) setNotifEnabled(false); }
    })();
    return () => { cancelled = true; };
  }, [NOTIF_FLAG_KEY, user, isWeb]);

  const enableNative = async (): Promise<boolean> => {
    if (!user) return false;
    if (!Device.isDevice) {
      Alert.alert(t("profile.notifTitle"), t("profile.notifNeedsDevice"));
      return false;
    }
    let perm = await Notifications.getPermissionsAsync();
    if (perm.status !== "granted") {
      perm = await Notifications.requestPermissionsAsync();
    }
    if (perm.status !== "granted") {
      Alert.alert(t("profile.notifTitle"), t("profile.notifDenied"));
      return false;
    }
    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      undefined;
    const tokenRes = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenRes?.data;
    if (!token) return false;
    const platform: "ios" | "android" | "web" | "unknown" =
      Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown";
    const res = await fetch(`${API_BASE}/users/${user.id}/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform }),
    });
    if (!res.ok) return false;
    await AsyncStorage.setItem(NOTIF_FLAG_KEY, "1");
    return true;
  };

  const disableNative = async (): Promise<void> => {
    if (!user) return;
    try {
      await fetch(`${API_BASE}/users/${user.id}/push-token`, { method: "DELETE" });
    } catch { /* best-effort */ }
    try { await AsyncStorage.removeItem(NOTIF_FLAG_KEY); } catch { /* ignore */ }
  };

  const handleToggleNotifications = async (next: boolean) => {
    if (!user || notifBusy) return;
    // On web, browsers only allow the permission prompt from a user
    // gesture (this onValueChange is exactly that), so we can call
    // enableWebPush directly without any extra workaround.
    setNotifBusy(true);
    try {
      if (next) {
        // ─── Turn ON ───────────────────────────────────────────────
        if (isWeb) {
          if (!isWebPushSupported()) {
            Alert.alert(t("profile.notifTitle"), t("profile.notifWebUnsupported"));
            return;
          }
          // If permission was already denied, the browser will NEVER
          // re-show the request prompt for this origin — that's a hard
          // W3C/Chrome/Safari/Firefox security rule, no JS API exists
          // to bypass it. The only path back is for the user to
          // manually flip the permission in browser site-settings. We
          // show a per-browser step-by-step guide instead of a generic
          // "denied" alert.
          if (typeof Notification !== "undefined" && Notification.permission === "denied") {
            const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
            const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
            const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
            const isFirefox = /firefox/i.test(ua);
            const isEdge = /edg/i.test(ua);
            const isChrome = /chrome/i.test(ua) && !isEdge;
            const origin = typeof window !== "undefined" ? window.location.origin : "";

            let steps = "";
            if (isIOS) {
              steps =
                "على iPhone/iPad:\n" +
                "1) افتح تطبيق «الإعدادات» (Settings)\n" +
                "2) Safari ← Advanced ← Website Data، ابحث عن هذا الموقع وامسحه\n" +
                "   أو: Safari ← Settings for Websites ← Notifications\n" +
                "3) ارجع للموقع وحدّث الصفحة ثم اضغط الزر مرة أخرى";
            } else if (isSafari) {
              steps =
                "على Safari (Mac):\n" +
                "1) من القائمة العلوية: Safari ← Settings ← Websites ← Notifications\n" +
                `2) ابحث عن «${origin}» وغيّر الإعداد إلى Allow أو Ask\n` +
                "3) أعد تحميل الصفحة (⌘R) ثم اضغط الزر مرة أخرى";
            } else if (isFirefox) {
              steps =
                "على Firefox:\n" +
                "1) اضغط أيقونة القفل 🔒 بجانب العنوان في الأعلى\n" +
                "2) عند «إرسال الإشعارات / Send Notifications» اضغط على ✕ لإزالة المنع\n" +
                "3) أعد تحميل الصفحة ثم اضغط الزر مرة أخرى";
            } else if (isChrome || isEdge) {
              steps =
                "على Chrome/Edge:\n" +
                "1) اضغط أيقونة القفل 🔒 (أو ⚙️) بجانب العنوان في الأعلى\n" +
                "2) ابحث عن «إشعارات / Notifications» وغيّرها إلى «السماح / Allow»\n" +
                "3) أعد تحميل الصفحة ثم اضغط الزر مرة أخرى\n\n" +
                "أو افتح: chrome://settings/content/notifications وأزل هذا الموقع من قائمة المحظورة.";
            } else {
              steps =
                "اضغط أيقونة القفل 🔒 بجانب عنوان الصفحة في الأعلى، ثم اسمح بـ «الإشعارات / Notifications»، وأعد تحميل الصفحة ثم اضغط الزر مرة أخرى.";
            }

            const msg =
              "المتصفح يمنع إرسال الإشعارات لهذا الموقع. للأسف الموقع لا يستطيع فتح نافذة الطلب مرة أخرى تلقائياً — هذا قيد أمني من المتصفح نفسه. الطريقة الوحيدة لإعادة التفعيل:\n\n" +
              steps;

            if (typeof window !== "undefined" && typeof window.alert === "function") {
              window.alert(`${t("profile.notifTitle")}\n\n${msg}`);
            } else {
              Alert.alert(t("profile.notifTitle"), msg);
            }
            return;
          }
          const res = await enableWebPush(user.id);
          if (!res.ok) {
            // Surface the actual failure reason so the toggle never looks
            // silently broken. Use window.alert on web because RN-Web's
            // Alert.alert is unreliable in some browsers.
            const reasonMsg: Record<string, string> = {
              "unsupported": t("profile.notifWebUnsupported"),
              "no-user": t("profile.notifError"),
              "permission-denied": t("profile.notifDenied"),
              "permission-dismissed": "لم تسمح للمتصفح بإرسال الإشعارات. اضغط على أيقونة القفل بجانب العنوان واسمح بالإشعارات ثم حاول مرة أخرى.",
              "sw-register-failed": "تعذّر تسجيل خدمة الإشعارات في المتصفح. تأكد أنك تستخدم HTTPS وليس وضع التصفح الخفي.",
              "vapid-fetch-failed": "تعذّر الاتصال بالخادم لجلب مفتاح الإشعارات. تحقق من الاتصال وحاول مرة أخرى.",
              "subscribe-failed": "تعذّر إنشاء اشتراك الإشعارات في المتصفح.",
              "subscription-invalid": "بيانات الاشتراك غير مكتملة.",
              "server-rejected": "رفض الخادم تسجيل الاشتراك.",
            };
            const msg = (reasonMsg[res.reason] ?? t("profile.notifError")) +
              (res.detail ? `\n\n(${res.detail})` : "");
            if (typeof window !== "undefined" && typeof window.alert === "function") {
              window.alert(`${t("profile.notifTitle")}\n\n${msg}`);
            } else {
              Alert.alert(t("profile.notifTitle"), msg);
            }
            return;
          }
        } else {
          const ok = await enableNative();
          if (!ok) return;
        }
        setNotifEnabled(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("profile.notifTitle"), t("profile.notifEnabledMsg"));
      } else {
        // ─── Turn OFF ──────────────────────────────────────────────
        if (isWeb) {
          await disableWebPush(user.id);
        } else {
          await disableNative();
        }
        setNotifEnabled(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      Alert.alert(t("profile.notifTitle"), t("profile.notifError"));
    } finally {
      setNotifBusy(false);
    }
  };

  const avatarUri = user?.avatar ?? null;
  const genderEmoji = user?.gender === "female" ? "👩" : user?.gender === "male" ? "🧑" : "👤";

  // ── Logged-out empty state ──
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
       <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("profile.title")}</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="user" size={56} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>{t("profile.welcome")}</Text>
          <Text style={styles.emptySub}>{t("profile.welcomeSub")}</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setAuthOpen(true)}
            activeOpacity={0.88}
          >
            <Feather name="log-in" size={18} color="#FFF" />
            <Text style={styles.loginBtnText}>{t("profile.loginNow")}</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
       </View>
      </View>
    );
  }

  // ── Logged-in state ──
  const username = user.gameUsername || user.name;
  const level = user.level ?? 0;
  const rank  = getRank(level);
  const nextRank = getRank(Math.min(level + 1, 1000));
  const pct   = rank ? ((level - rank.min) / Math.max(rank.max - rank.min, 1)) * 100 : 0;
  const freeCoffees = Math.floor((user.totalOrders ?? 0) / 6);
  // Progress within the current free-coffee cycle (free coffee every 6 levels — matches game.tsx + api-server)
  const DRINKS_PER_FREE_COFFEE = 6;
  const levelsIntoCycle = level % DRINKS_PER_FREE_COFFEE;
  const freeCoffeeCyclePct = Math.round((levelsIntoCycle / DRINKS_PER_FREE_COFFEE) * 100);
  const levelsToFreeCoffee = DRINKS_PER_FREE_COFFEE - levelsIntoCycle;
  const giftsReceived = useReceivedGifts(user.id);
  const giftsSent     = useSentGifts(user.id);
  const { equipped: eqCharacterId } = useCharacters();
  const { equipped: eqFrameId }     = useFrames();
  const { equipped: eqBadgeId }     = useBadges();
  const { equipped: eqUcId }        = useUsernameColors();
  const { equipped: eqTsId }        = useTextStyles();
  const { equipped: eqBgId }        = useBackgrounds();

  // Friends count + ranks (show "—" for brand-new users with no activity)
  const friendsCount = friends.length;
  const hasActivity = (user.level ?? 0) > 0 || (user.totalOrders ?? 0) > 0 || (user.points ?? 0) > 0;

  const omanRankStr = (() => {
    if (!hasActivity) return "—";
    const sorted = [...registeredUsers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const friendsRankStr = (() => {
    if (!hasActivity) return "—";
    const friendPool = registeredUsers.filter(u => friends.includes(u.id) || u.id === user.id);
    if (friendPool.length === 0) return "—";
    const sorted = friendPool.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert(t("profile.photoPermNeeded")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0] && user) {
      const asset = result.assets[0];
      const mime = asset.mimeType || "image/jpeg";
      let dataUri: string | null = null;
      if (asset.base64) {
        dataUri = `data:${mime};base64,${asset.base64}`;
      } else if (asset.uri) {
        try {
          const resp = await fetch(asset.uri);
          const blob = await resp.blob();
          dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        } catch {
          dataUri = asset.uri;
        }
      }
      if (!dataUri) { Alert.alert("تعذّر قراءة الصورة، حاول صورة أخرى."); return; }
      setUser({ ...user, avatar: dataUri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
     <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("profile.title")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: r.hPad, paddingBottom: insets.bottom + 100, gap: 16 }}
      >
        {/* ── Hero card: avatar · name · rank · level · progress ── */}
        <View style={styles.heroCard}>
          {/* Lv badge — top corner */}
          <View style={styles.lvBadge}>
            <Text style={styles.lvBadgeLabel}>Lv</Text>
            <Text style={styles.lvBadgeNum}>{level}</Text>
          </View>

          <View style={styles.heroTopRow}>
            {/* Info (right side in RTL) */}
            <View style={styles.heroInfo}>
              <View style={styles.heroNameRow}>
                <Text style={styles.heroCrown}>👑</Text>
                <Text style={styles.heroName} numberOfLines={1}>{username}</Text>
                <UserBadge size={20} />
              </View>
              <TouchableOpacity
                style={styles.rankBadge}
                activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRanksOpen(true); }}
              >
                <Text style={styles.rankBadgeIcon}>{rank?.icon ?? "☕"}</Text>
                <Text style={styles.rankBadgeText} numberOfLines={1}>{rank?.nameEn ?? t("profile.coffeeBeginner")}</Text>
              </TouchableOpacity>
            </View>

            {/* Avatar (left side in RTL) — tap to change */}
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarOuterRing}>
              <AvatarWithFrame size={100} scale={1.7}>
                <View style={styles.avatarInnerRing}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                  ) : (
                    <Image source={getDefaultAvatarSource(user?.gender)} style={styles.avatarImg} />
                  )}
                </View>
              </AvatarWithFrame>
              <View style={styles.cameraBadge}>
                <Feather name="camera" size={14} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Username + Oman ranking (under the character) */}
          <View style={styles.heroSubRow}>
            <Text style={styles.heroHandle} numberOfLines={1}>@{username}</Text>
            <View style={styles.omanRankChip}>
              <Text style={styles.omanRankIcon}>🇴🇲</Text>
              <Text style={styles.omanRankText} numberOfLines={1}>{`ترتيبك ${omanRankStr} في عُمان`}</Text>
            </View>
          </View>

          {/* Compact level → next-level progress with free-coffee reward theme */}
          <View style={[styles.freeCoffeeProgressCard, levelsToFreeCoffee === DRINKS_PER_FREE_COFFEE && styles.freeCoffeeProgressCardReady]}>
            <View style={styles.fcLevelRow}>
              <View style={styles.fcLevelChip}>
                <Text style={styles.fcLevelChipText}>{level}</Text>
              </View>
              <View style={styles.fcBarMid}>
                <Text style={styles.freeCoffeeProgressPct}>{freeCoffeeCyclePct}%</Text>
                <View style={styles.freeCoffeeTrack}>
                  <View style={[styles.freeCoffeeFill, { width: `${freeCoffeeCyclePct}%` as any }]} />
                </View>
              </View>
              <View style={styles.fcLevelChip}>
                <Text style={styles.fcLevelChipText}>{level + 1}</Text>
              </View>
            </View>
            <View style={styles.fcCoffeeRow}>
              <Text style={styles.fcCoffeeIcon}>☕</Text>
              <Text style={styles.freeCoffeeProgressHint}>
                {levelsToFreeCoffee === DRINKS_PER_FREE_COFFEE
                  ? "كوفي مجاني جاهز للاستلام الآن!"
                  : `باقي ${levelsToFreeCoffee} مستوى للقهوة المجانية`}
              </Text>
            </View>
          </View>
        </View>

        {/* Change / remove photo (kept from before) */}
        <View style={styles.photoActionsRow}>
          {avatarUri && user && (
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => {
                const doRemove = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const { avatar: _omit, ...rest } = user;
                  setUser(rest as typeof user);
                };
                if (Platform.OS === "web") {
                  // eslint-disable-next-line no-alert
                  if (typeof window !== "undefined" && window.confirm("هل تريد إزالة صورة البروفايل والرجوع إلى الصورة الافتراضية؟")) {
                    doRemove();
                  }
                  return;
                }
                Alert.alert(
                  "إزالة الصورة",
                  "هل تريد إزالة صورة البروفايل والرجوع إلى الصورة الافتراضية؟",
                  [
                    { text: "إلغاء", style: "cancel" },
                    { text: "إزالة", style: "destructive", onPress: doRemove },
                  ],
                );
              }}
              activeOpacity={0.85}
            >
              <Feather name="trash-2" size={13} color="#FF6B6B" />
              <Text style={styles.removePhotoBtnText}>إزالة الصورة</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.changePhotoHint}>{t("profile.tapToChangePhoto")}</Text>
        </View>

        {/* ── Free coffee button (small) — above the rank pill ── */}
        <TouchableOpacity
          style={styles.freeCoffeeBtn}
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFcOpen(true); }}
        >
          <Text style={styles.freeCoffeeBtnIcon}>🎁</Text>
          <Text style={styles.freeCoffeeBtnText}>الكوفي المجاني</Text>
          {fcAvailableCount > 0 && (
            <View style={styles.freeCoffeeBtnBadge}>
              <Text style={styles.freeCoffeeBtnBadgeText}>{fcAvailableCount}</Text>
            </View>
          )}
          <Feather name="chevron-left" size={16} color={PRIMARY} style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        {(user?.gender === "male" || user?.gender === "female") && (
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            alignSelf: "center", marginTop: 10, marginBottom: 4,
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
            backgroundColor: user.gender === "female" ? "rgba(240,98,146,0.15)" : "rgba(79,195,247,0.15)",
            borderWidth: 1,
            borderColor: user.gender === "female" ? "#F0629255" : "#4FC3F755",
          }}>
            <Text style={{ fontSize: 14 }}>{user.gender === "female" ? "👩" : "🧑"}</Text>
            <Text style={{
              fontSize: 12, fontFamily: "Inter_600SemiBold",
              color: user.gender === "female" ? "#F06292" : "#4FC3F7",
            }}>
              {user.gender === "female" ? "بنت" : "ولد"}
            </Text>
          </View>
        )}

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          {/* Row 1 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{friendsCount}</Text>
              <Text style={styles.statLabel}>{t("profile.statFriends")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>{level}</Text>
              <Text style={styles.statLabel}>{t("profile.statLevel")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>☕</Text>
              <Text style={styles.statValue}>{freeCoffees}</Text>
              <Text style={styles.statLabel}>{t("profile.statFreeCoffees")}</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>🎁</Text>
              <Text style={[styles.statValue, { color: "#FF6B9D" }]}>{giftsReceived}</Text>
              <Text style={styles.statLabel}>{t("profile.statGiftsReceived")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>💝</Text>
              <Text style={[styles.statValue, { color: "#A78BFA" }]}>{giftsSent}</Text>
              <Text style={styles.statLabel}>{t("profile.statGiftsSent")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>🇴🇲</Text>
              <Text style={styles.statValue}>{omanRankStr}</Text>
              <Text style={styles.statLabel}>{t("profile.statOmanRank")}</Text>
            </View>
          </View>
          {/* Row 3 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>👫</Text>
              <Text style={styles.statValue}>{friendsRankStr}</Text>
              <Text style={styles.statLabel}>{t("profile.statFriendsRank")}</Text>
            </View>
          </View>
        </View>

        {/* ── Per-cafe level breakdown ──
            Level is conceptually per-cafe (e.g. 6 total drinks = 4 at cafe A
            with its own level, + 2 at cafe B with its own level). The
            leaderboard intentionally hides the global level; it only lives
            here in the profile, as a per-cafe list, so users see exactly
            where their progress is concentrated. */}
        <Text style={styles.cosmeticsTitle}>{t("profile.perCafeLevelsTitle")}</Text>
        <Text style={styles.sectionSubtitle}>{t("profile.perCafeLevelsSubtitle")}</Text>
        {(() => {
          const perCafe = Object.values(user.cafeProgress ?? {})
            .filter((c) => (c.totalOrders ?? 0) > 0 || (c.level ?? 0) > 0)
            .sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0));
          if (perCafe.length === 0) {
            return (
              <View style={styles.perCafeEmpty}>
                <Text style={styles.perCafeEmptyText}>{t("profile.perCafeLevelsEmpty")}</Text>
              </View>
            );
          }
          return (
            <View style={styles.perCafeList}>
              {perCafe.map((c) => (
                <TouchableOpacity
                  key={c.cafeId}
                  style={styles.perCafeRow}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setActiveGameCafeId(c.cafeId);
                    router.replace("/(tabs)");
                  }}
                >
                  <Text style={styles.perCafeName} numberOfLines={1}>{c.cafeName}</Text>
                  <View style={styles.perCafeChipsRow}>
                    <View style={styles.perCafeOrdersChip}>
                      <Text style={styles.perCafeOrdersChipText}>
                        {t("profile.perCafeOrdersChip", { n: String(c.totalOrders ?? 0) })}
                      </Text>
                    </View>
                    <View style={styles.perCafeLevelChip}>
                      <Text style={styles.perCafeLevelChipText}>
                        {t("profile.perCafeLevelChip", { n: String(c.level ?? 0) })}
                      </Text>
                    </View>
                    <Feather name="chevron-left" size={16} color={PRIMARY} style={{ opacity: 0.7 }} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}

        {/* ── Profile preview (how others see you) ── */}
        <Text style={styles.cosmeticsTitle}>معاينة ملفك</Text>
        <View style={styles.previewCard}>
          <View style={styles.previewCharWrap}>
            {(() => {
              const ch = getCharacter(eqCharacterId);
              return ch
                ? <Character def={ch} size={52} />
                : (
                  <Image
                    source={avatarUri ? { uri: avatarUri } : getDefaultAvatarSource(user?.gender)}
                    style={{ width: 52, height: 52, borderRadius: 14 }}
                  />
                );
            })()}
          </View>
          <View style={styles.previewInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroCrown}>👑</Text>
              <Text style={styles.previewName} numberOfLines={1}>{username}</Text>
              <UserBadge size={18} />
            </View>
            <Text style={styles.heroHandle} numberOfLines={1}>@{username}</Text>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeIcon}>{rank?.icon ?? "☕"}</Text>
              <Text style={styles.rankBadgeText} numberOfLines={1}>{rank?.nameEn ?? t("profile.coffeeBeginner")}</Text>
            </View>
          </View>
        </View>

        {/* ── Equipped cosmetics showcase (used items) ── */}
        <Text style={styles.cosmeticsTitle}>الأغراض المستعملة</Text>
        <View style={styles.cosmeticsGrid}>
          {(() => {
            const ch = getCharacter(eqCharacterId);
            const fr = getFrame(eqFrameId);
            const bd = getBadge(eqBadgeId);
            const uc = getUsernameColor(eqUcId);
            const ts = getTextStyle(eqTsId);
            const bg = getBackground(eqBgId);
            const ucColor = uc?.color ?? uc?.gradient?.[0] ?? uc?.mix?.[0] ?? "rgba(255,255,255,0.40)";
            const items = [
              { label: t("profile.eqCharacter"),      node: ch ? <Character def={ch} size={28} /> : null, name: ch?.name },
              { label: t("profile.eqFrame"),          node: fr ? <View style={{ width: 36, height: 36 }}><AvatarWithFrame size={36} scale={1} frameId={fr.id}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" }} /></AvatarWithFrame></View> : null, name: fr?.name },
              { label: t("profile.eqBadge"),          node: bd ? <UserBadge badgeId={bd.id} size={26} /> : null, name: bd?.name },
              { label: t("profile.eqUsernameColor"),  node: uc ? <Text style={{ color: ucColor, fontFamily: "Inter_700Bold", fontSize: 16 }}>أبجد</Text> : null, name: uc?.name },
              { label: t("profile.eqTextStyle"),      node: ts ? <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Aa</Text> : null, name: ts?.name },
              { label: t("profile.eqBackground"),     node: bg ? <View style={{ width: 28, height: 18, borderRadius: 4, backgroundColor: (bg as any).color ?? (Array.isArray((bg as any).gradient) ? (bg as any).gradient[0] : "#333"), borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} /> : null, name: bg?.name },
            ].filter(it => it.node);
            if (items.length === 0) {
              return (
                <View style={styles.cosmeticEmpty}>
                  <Text style={styles.cosmeticEmptyText}>{t("profile.equippedEmpty")}</Text>
                </View>
              );
            }
            return items.map((it, i) => (
              <View key={i} style={styles.cosmeticCard}>
                <Text style={styles.cosmeticLabel}>{it.label}</Text>
                <View style={styles.cosmeticPreview}>{it.node}</View>
                <Text style={styles.cosmeticName} numberOfLines={1}>{it.name ?? "—"}</Text>
              </View>
            ));
          })()}
        </View>

        {/* ── Edit fields ── */}
        <View style={styles.fieldsCard}>
          {/* Username */}
          {/* Phone (read-only — set at registration, cannot be edited) */}
          {!!user.phone && (
            <>
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Feather name="phone" size={17} color={PRIMARY} />
                </View>
                <View style={styles.fieldText}>
                  <Text style={styles.fieldLabel}>{t("profile.fieldPhone")}</Text>
                  <Text style={[styles.fieldValue, { writingDirection: "ltr" }]} numberOfLines={1}>
                    {user.phone}
                  </Text>
                </View>
                <Feather name="lock" size={14} color="rgba(255,255,255,0.25)" />
              </View>
              <View style={styles.divider} />
            </>
          )}

          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("username")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="user" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>{t("profile.fieldGameUser")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.fieldValue}>@{username}</Text>
                <UserBadge size={18} />
              </View>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Password */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("password")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="lock" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>{t("profile.fieldPassword")}</Text>
              <Text style={styles.fieldValue}>{"•".repeat(10)}</Text>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        </View>

        {/* ── Push notifications toggle ──
            On WEB we render a real HTML <button> via React.createElement
            because RN-Web's Switch/Pressable have repeatedly failed to
            fire onValueChange/onPress here. A real <button onClick> is
            the most reliable user-gesture surface on every browser and
            is guaranteed to preserve the gesture context required by
            Notification.requestPermission().
            On native we keep the TouchableOpacity row + Switch indicator. */}
        {isWeb ? (
          React.createElement(
            "button",
            {
              type: "button",
              disabled: notifBusy,
              onClick: () => { if (!notifBusy) void handleToggleNotifications(!notifEnabled); },
              style: {
                marginTop: 12,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                width: "100%",
                backgroundColor: notifEnabled ? "rgba(232,184,109,0.10)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${notifEnabled ? PRIMARY : "rgba(232,184,109,0.25)"}`,
                borderRadius: 14,
                padding: "10px 14px",
                cursor: notifBusy ? "not-allowed" : "pointer",
                color: PRIMARY,
                fontFamily: "Inter_700Bold",
                fontSize: 14,
                textAlign: "right",
                opacity: notifBusy ? 0.6 : 1,
              },
            },
            React.createElement(Feather as unknown as React.ComponentType<{ name: string; size: number; color: string }>, { name: "bell", size: 17, color: PRIMARY }),
            React.createElement(
              "span",
              { style: { flex: 1 } },
              notifBusy
                ? t("profile.notifBusy")
                : notifEnabled
                  ? t("profile.notifEnabled")
                  : t("profile.notifEnable"),
            ),
            React.createElement(
              "span",
              {
                style: {
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  backgroundColor: notifEnabled ? PRIMARY : "rgba(255,255,255,0.15)",
                  color: notifEnabled ? "#000" : "#fff",
                },
              },
              notifEnabled ? "ON" : "OFF",
            ),
          )
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { if (!notifBusy) void handleToggleNotifications(!notifEnabled); }}
            disabled={notifBusy}
            style={[styles.notifRow, notifEnabled && styles.notifRowOn]}
          >
            <Feather name="bell" size={17} color={PRIMARY} />
            <Text style={styles.notifRowText} numberOfLines={1}>
              {notifBusy
                ? t("profile.notifBusy")
                : notifEnabled
                  ? t("profile.notifEnabled")
                  : t("profile.notifEnable")}
            </Text>
            <View pointerEvents="none">
              <Switch
                value={notifEnabled}
                trackColor={{ false: "rgba(255,255,255,0.15)", true: "rgba(232,184,109,0.45)" }}
                thumbColor={notifEnabled ? PRIMARY : "#ddd"}
                ios_backgroundColor="rgba(255,255,255,0.15)"
              />
            </View>
          </TouchableOpacity>
        )}

        {/* ── Support button (above logout) ── */}
        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => router.push("/support")}
          activeOpacity={0.85}
        >
          <Feather name="help-circle" size={17} color={PRIMARY} />
          <Text style={styles.supportText}>{t("profile.support")}</Text>
        </TouchableOpacity>

        {/* ── Privacy & Governance button (above logout) ── */}
        <TouchableOpacity
          style={styles.privacyBtn}
          onPress={() => router.push("/privacy")}
          activeOpacity={0.85}
        >
          <Feather name="shield" size={17} color={PRIMARY} />
          <Text style={styles.privacyText}>{t("profile.privacy")}</Text>
        </TouchableOpacity>

        {/* ── Logout button ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setConfirmOpen(true)}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={17} color={DANGER} />
          <Text style={styles.logoutText}>{t("profile.logout")}</Text>
        </TouchableOpacity>

        {/* ── Delete account permanently ── */}
        <TouchableOpacity
          style={styles.deleteAcctBtn}
          onPress={() => { setDeleteText(""); setDeleteOpen(true); }}
          activeOpacity={0.85}
        >
          <Feather name="trash-2" size={17} color={DANGER} />
          <Text style={styles.deleteAcctText}>{t("profile.deleteAccount")}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Username modal */}
      <EditModal
        visible={modal === "username"}
        title={t("profile.editGameUser")}
        value={username}
        onClose={() => setModal(null)}
        onSave={async (v) => {
          const next = v.trim();
          if (!next || !user) return;
          if (next.toLowerCase() === (user.gameUsername || "").toLowerCase()) return;
          // Server is the single source of truth for username uniqueness
          // across all devices — don't update locally if it's already taken.
          const r = await claimGameUsername(user.id, next);
          if (!r.ok) {
            Alert.alert(t("profile.usernameChangeFailed"), r.error);
            return;
          }
          setUser({ ...user, gameUsername: next });
        }}
      />

      {/* Password modal */}
      <EditModal
        visible={modal === "password"}
        title={t("profile.editPassword")}
        value=""
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim() && user) setUser({ ...user, password: v.trim() }); }}
        secure
      />

      {/* Logout confirmation */}
      <LogoutConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => { setConfirmOpen(false); await logout(); }}
      />

      {/* Delete-account confirmation */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: "center", gap: 10 }}>
              <View style={styles.warnIcon}>
                <Feather name="trash-2" size={26} color={DANGER} />
              </View>
              <Text style={styles.modalTitle}>{t("profile.deleteConfirmTitle")}</Text>
              <Text style={[styles.confirmSub, { textAlign: dir === "rtl" ? "right" : "left" }]}>
                {t("profile.deleteConfirmMsg")}
              </Text>
              <Text style={[styles.confirmSub, { color: DANGER, marginTop: 4 }]}>
                {t("profile.deleteConfirmHint")}
              </Text>
              <TextInput
                value={deleteText}
                onChangeText={setDeleteText}
                placeholder={t("profile.deleteConfirmKeyword")}
                placeholderTextColor="rgba(255,255,255,0.35)"
                editable={!deleting}
                autoCapitalize="characters"
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: `${DANGER}55`,
                  borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
                  color: "#FFF", fontFamily: "Inter_600SemiBold",
                  textAlign: "center", marginTop: 8,
                }}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !deleting && setDeleteOpen(false)}
                activeOpacity={0.85}
                disabled={deleting}
              >
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: DANGER, opacity:
                      deleting || deleteText.trim().toUpperCase() !== t("profile.deleteConfirmKeyword").toUpperCase() ? 0.5 : 1 },
                ]}
                disabled={deleting || deleteText.trim().toUpperCase() !== t("profile.deleteConfirmKeyword").toUpperCase()}
                onPress={async () => {
                  setDeleting(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  const res = await deleteAccount();
                  setDeleting(false);
                  if (!res.ok) {
                    Alert.alert(t("profile.deleteFailed"), res.error || "");
                    return;
                  }
                  setDeleteOpen(false);
                  // No Alert here — the AuthGate will instantly re-render
                  // because `user` is now null, and the AuthModal will
                  // open straight on the "register-form" tab (flagged by
                  // deleteAccount via initialAuthStep). Showing a blocking
                  // Alert in between just delays that transition.
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.saveText}>
                  {deleting ? t("profile.deleting") : t("profile.deleteConfirmBtn")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ranks journey */}
      <RanksModal
        visible={ranksOpen}
        onClose={() => setRanksOpen(false)}
        currentLevel={level}
      />

      <FreeCoffeeModal
        visible={fcOpen}
        onClose={() => setFcOpen(false)}
        coffees={fcList}
      />
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  header:        { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:   { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Empty state
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  emptyIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 2, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 },
  loginBtn:   {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 16, shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  loginBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

  // ── Avatar (double glowing ring) ──
  avatarSection: { alignItems: "center", gap: 10, marginTop: 44 },
  avatarOuterRing: {
    width: 122, height: 122, borderRadius: 61,
    borderWidth: 2, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
    shadowColor: PRIMARY, shadowOpacity: 0.6,
    shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarInnerRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606", overflow: "hidden",
  },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarLevelNum: {
    fontSize: 48, fontFamily: "Inter_700Bold", color: "#FFF",
    lineHeight: 56,
  },
  cameraBadge: {
    position: "absolute", bottom: 4, right: 4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  changePhotoHint: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)", marginTop: 4,
  },
  removePhotoBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1, borderColor: "rgba(255,107,107,0.35)",
  },
  removePhotoBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#FF6B6B",
  },

  // ── Hero card (image-matched) ──
  heroCard: {
    backgroundColor: CARD, borderRadius: 24,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 14, marginTop: 8,
    position: "relative",
    shadowColor: PRIMARY, shadowOpacity: 0.2,
    shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroInfo: { flex: 1, alignItems: "flex-end", gap: 6 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroCrown: { fontSize: 16 },
  heroName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", maxWidth: 160, textAlign: "right" },
  heroHandle: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.50)" },
  heroSubRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, flexWrap: "wrap",
  },
  omanRankChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
  },
  omanRankIcon: { fontSize: 13 },
  omanRankText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  rankBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
  },
  rankBadgeIcon: { fontSize: 13 },
  rankBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY, maxWidth: 150 },
  lvBadge: {
    position: "absolute", top: 12, right: 14, zIndex: 5,
    flexDirection: "row", alignItems: "baseline", gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.14)",
    borderWidth: 1, borderColor: BORDER,
  },
  lvBadgeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  lvBadgeNum: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  heroProgressWrap: { gap: 8 },
  heroProgressTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroProgressTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.80)" },
  heroProgressPct: { fontSize: 14, fontFamily: "Inter_700Bold" },
  heroProgressSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)", textAlign: "right" },

  // ── Free-coffee reward progress (distinct emerald theme) ──
  freeCoffeeProgressCard: {
    backgroundColor: "rgba(74,222,128,0.07)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(74,222,128,0.40)",
    padding: 12,
    gap: 10,
  },
  freeCoffeeProgressCardReady: {
    backgroundColor: "rgba(74,222,128,0.16)",
    borderColor: "rgba(74,222,128,0.75)",
    shadowColor: "#4ADE80",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  fcLevelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fcLevelChip: {
    minWidth: 30, height: 30, borderRadius: 9, paddingHorizontal: 6,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(74,222,128,0.16)",
    borderWidth: 1, borderColor: "rgba(74,222,128,0.45)",
  },
  fcLevelChipText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#7CF0A8" },
  fcBarMid: { flex: 1, gap: 4 },
  freeCoffeeProgressPct: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#7CF0A8", textAlign: "center" },
  freeCoffeeTrack: {
    height: 8, borderRadius: 999, overflow: "hidden",
    backgroundColor: "rgba(74,222,128,0.14)",
  },
  freeCoffeeFill: {
    height: "100%", borderRadius: 999,
    backgroundColor: "#4ADE80",
  },
  fcCoffeeRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  fcCoffeeIcon: { fontSize: 14 },
  freeCoffeeProgressHint: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.70)", textAlign: "center" },
  photoActionsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, marginTop: -6,
  },

  // ── Profile preview ("معاينة ملفك") ──
  previewCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER, padding: 14,
  },
  previewCharWrap: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: "rgba(232,184,109,0.08)",
    borderWidth: 1, borderColor: BORDER,
  },
  previewInfo: { flex: 1, alignItems: "flex-end", gap: 5 },
  previewName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", maxWidth: 180, textAlign: "right" },
  sectionSubtitle: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)", textAlign: "right",
    marginTop: -6, marginBottom: 2, lineHeight: 18,
  },

  // ── Rank pill ──
  rankPill: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  rankPillIconRing: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.08)",
    shadowColor: PRIMARY, shadowOpacity: 0.5,
    shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  rankPillIcon: { fontSize: 24 },
  rankPillName: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  rankPillSub:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.55)", marginTop: 2 },

  // ── Free coffee button (small, above rank pill) ──
  freeCoffeeBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "stretch", marginBottom: 10,
    backgroundColor: "rgba(232,184,109,0.08)", borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  freeCoffeeBtnIcon: { fontSize: 18 },
  freeCoffeeBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, textAlign: "right" },
  freeCoffeeBtnBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  freeCoffeeBtnBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#000" },

  // ── Free coffee codes modal ──
  fcEmptyWrap: { alignItems: "center", paddingVertical: 30, gap: 8 },
  fcEmptyIcon: { fontSize: 40 },
  fcEmptyText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)" },
  fcCodeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(232,184,109,0.08)", borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  fcCodeRowUsed: {
    backgroundColor: "rgba(229,83,83,0.08)", borderColor: "rgba(229,83,83,0.4)",
  },
  fcCodeValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY, letterSpacing: 3, textAlign: "right" },
  fcCodeValueUsed: { color: DANGER, textDecorationLine: "line-through" },
  fcCodeMeta: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)", marginTop: 3, textAlign: "right" },
  fcStatusPillOk: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.18)", borderWidth: 1, borderColor: BORDER,
  },
  fcStatusPillOkText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  fcStatusPillUsed: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(229,83,83,0.18)", borderWidth: 1, borderColor: "rgba(229,83,83,0.5)",
  },
  fcStatusPillUsedText: { fontSize: 12, fontFamily: "Inter_700Bold", color: DANGER },

  // ── Stats (glowing cards) ──
  statsGrid: { gap: 12 },
  statsRow:  { flexDirection: "row", gap: 12, marginTop: 8 },
  cosmeticsTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "right", marginTop: 8, marginBottom: 4,
  },
  cosmeticsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  cosmeticCard: {
    width: "31%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.18)",
    alignItems: "center", gap: 6,
  },
  cosmeticLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_500Medium" },
  cosmeticPreview: { height: 44, alignItems: "center", justifyContent: "center" },
  cosmeticName: { fontSize: 11, color: "#FFF", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  cosmeticEmpty: {
    flex: 1, padding: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  cosmeticEmptyText: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular" },
  statBox:   { alignItems: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 8 },
  statBoxCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOpacity: 0.22,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  statIcon:  { fontSize: 26 },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },
  perCafeList: { gap: 8, marginTop: 4 },
  perCafeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.20)",
  },
  perCafeName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF", marginRight: 12 },
  perCafeChipsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  perCafeOrdersChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(79,195,247,0.18)",
  },
  perCafeOrdersChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  perCafeLevelChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)",
  },
  perCafeLevelChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E8B86D" },
  perCafeEmpty: {
    padding: 18, borderRadius: 14, marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  perCafeEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },

  // ── Progress ──
  progressCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1,
    borderColor: BORDER, padding: 18, gap: 10,
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  progressPct:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressTrack:  { height: 8, borderRadius: 4, backgroundColor: "rgba(232,184,109,0.12)", overflow: "hidden" },
  progressFill:   { height: "100%", borderRadius: 4 },
  progressSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },

  // ── Edit fields ──
  fieldsCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1,
    borderColor: BORDER, overflow: "hidden",
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 18,
  },
  fieldIcon: {
    width: 42, height: 42, borderRadius: 12,
    borderWidth: 1, borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  fieldText:  { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
  fieldValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  divider:    { height: 1, backgroundColor: "rgba(232,184,109,0.18)", marginHorizontal: 18 },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_700Bold", color: DANGER },

  // Delete account permanently (destructive — sits below logout)
  deleteAcctBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: `${DANGER}80`, borderStyle: "dashed",
    paddingVertical: 14, borderRadius: 16, marginTop: 10, marginBottom: 6,
  },
  deleteAcctText: { fontSize: 14, fontFamily: "Inter_700Bold", color: DANGER },

  // Notifications opt-in
  notifRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.25)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  notifRowOn: {
    backgroundColor: "rgba(232,184,109,0.10)",
    borderColor: PRIMARY,
  },
  notifRowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
  },
  notifBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${PRIMARY}18`, borderWidth: 1, borderColor: `${PRIMARY}55`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4, marginBottom: 10,
  },
  notifBtnOn: {
    backgroundColor: `${PRIMARY}08`, borderColor: `${PRIMARY}30`,
    borderStyle: "dashed",
  },
  notifText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Support
  supportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${PRIMARY}12`, borderWidth: 1, borderColor: `${PRIMARY}40`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4, marginBottom: 10,
  },
  supportText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Privacy & Governance
  privacyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: `${PRIMARY}30`,
    paddingVertical: 14, borderRadius: 16, marginBottom: 10,
  },
  privacyText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#0F0606",
    borderRadius: 24, padding: 24, gap: 16,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  closeBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap:  {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: "Inter_500Medium",
    color: "#FFF", paddingVertical: 13,
  },
  eyeBtn:  { padding: 8 },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", paddingVertical: 14,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.50)" },
  saveBtn:   { flex: 1, borderRadius: 14, backgroundColor: PRIMARY, alignItems: "center", paddingVertical: 14 },
  saveText:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Tabs
  tabsRow: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 4, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  tabTextActive: { color: "#FFF" },

  errorText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: DANGER, textAlign: "center",
    backgroundColor: `${DANGER}15`, padding: 10, borderRadius: 10,
  },

  // ── Auth modal (new) ──
  authCard: {
    width: "100%", backgroundColor: "#0F0606",
    borderRadius: 28, padding: 22, gap: 14,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  authBrand: { alignItems: "center", gap: 4, marginTop: 6 },
  authLogo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: `${PRIMARY}25`,
    borderWidth: 1.5, borderColor: `${PRIMARY}55`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  authBrandName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  authBrandSub:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  authTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 4, gap: 4,
  },
  authTab: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
  authTabActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  authTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  authTabTextActive: { color: "#FFF" },
  authPrimaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 15, marginTop: 4,
    shadowColor: PRIMARY, shadowOpacity: 0.45,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  authPrimaryText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  authSwitchText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },

  // Register avatar
  regAvatarWrap: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2, borderColor: `${PRIMARY}60`, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  },
  regAvatarImg: { width: "100%", height: "100%", borderRadius: 43 },
  regAvatarBadge: {
    position: "absolute", bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0F0606",
  },
  regAvatarHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", marginTop: 6 },

  // Gender
  genderRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  genderBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
  },
  genderBtnActiveMale:   { backgroundColor: "#4FC3F7", borderColor: "#4FC3F7" },
  genderBtnActiveFemale: { backgroundColor: "#F06292", borderColor: "#F06292" },
  genderEmoji: { fontSize: 20 },
  genderText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },

  // Confirm
  warnIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    alignItems: "center", justifyContent: "center",
  },
  confirmSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.60)", textAlign: "center", lineHeight: 20 },

  // Ranks Modal
  ranksCard: {
    width: "100%", maxHeight: "85%",
    backgroundColor: "#0F0606",
    borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  ranksHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 6,
  },
  ranksTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF" },
  ranksSubtitle: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)", textAlign: "right",
    paddingBottom: 8,
  },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.10)",
  },
  rankRowCurrent: {
    backgroundColor: "rgba(232,184,109,0.07)",
    borderColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  rankRowIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
  },
  rankRowName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  rankRowSub:  { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(232,184,109,0.65)" },
  rankRowRange:{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },
  rankRowStatus: { minWidth: 70, alignItems: "center", justifyContent: "center" },
  hereBadge: {
    backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  hereBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  checkPill: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(125,216,125,0.15)",
    borderWidth: 1, borderColor: "rgba(125,216,125,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  cupsRemainingCol: { alignItems: "center", gap: 3 },
  cupsRemainingNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  cupsRemainingLbl: {
    fontSize: 9, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.50)", textAlign: "center",
  },
  cupsPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  cupsPillNum: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  ranksFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
  },
  ranksFooterText: {
    flex: 1, fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.50)", textAlign: "right",
  },
});

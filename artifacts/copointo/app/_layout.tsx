import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/AuthGate";
import LevelRewardsGranter from "@/components/LevelRewardsGranter";
import CharacterMigrationNotice from "@/components/CharacterMigrationNotice";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { CommunityProvider } from "@/context/CommunityContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { MessagesProvider } from "@/context/MessagesContext";
import { initializeRevenueCat, SubscriptionProvider } from "@/lib/revenuecat";

SplashScreen.preventAutoHideAsync();

// Configure RevenueCat once at startup (coins are bought via Apple/Google IAP).
// Wrapped so a misconfiguration never blocks the whole app from booting.
try {
  initializeRevenueCat();
} catch (err: any) {
  Alert.alert("RevenueCat Unavailable", err?.message ?? "Unknown error");
}

// ─── Custom-domain redirect: admin domain → /admin/ ───────────────
// Visitors who land on the admin custom domain should immediately see
// the admin dashboard instead of the customer mobile app. We do this
// at the top of _layout.tsx (which runs before any screen renders) so
// the redirect happens as early as possible. The check is wrapped in
// a `pathname` guard so the admin app itself (which lives under
// `/admin`) doesn't get into a redirect loop.
const ADMIN_HOSTNAMES = [
  "copointoadmin-al-yaqathan.com",
  "www.copointoadmin-al-yaqathan.com",
];
if (typeof window !== "undefined" && typeof window.location !== "undefined") {
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname;
  if (ADMIN_HOSTNAMES.includes(host) && !path.startsWith("/admin")) {
    window.location.replace("/admin/");
  }
}

// ─── Per-route SEO metadata ────────────────────────────────────────────────
// Each indexable public route gets its own title, description, canonical URL,
// and og:url so crawlers and social previews show the correct page instead of
// the home page copy for every deep link.
type RouteMeta = { title: string; description: string; canonical: string };

const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Copointo — دليل الكوفيهات في سلطنة عمان",
    description: "كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕ تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، استمتع بقسائم الإهداء، شاهد ريلز الكوفيهات، واجمع نقاط الولاء واحصل على قهوة مجاناً.",
    canonical: "https://copointo.com/",
  },
  "/videos": {
    title: "ريلز الكوفيهات | Copointo",
    description: "اكتشف أجمل مقاطع فيديو الكوفيهات في سلطنة عمان. شاهد ريلز حصرية من أبرز الكوفيهات العُمانية عبر منصة كوبوينتو.",
    canonical: "https://copointo.com/videos",
  },
  "/cafes-map": {
    title: "خريطة الكوفيهات | Copointo",
    description: "اعثر على أقرب كوفيه إليك في سلطنة عمان. استعرض خريطة تفاعلية لجميع الكوفيهات المسجّلة في منصة كوبوينتو.",
    canonical: "https://copointo.com/cafes-map",
  },
  "/game": {
    title: "الألعاب والنقاط | Copointo",
    description: "العب واجمع نقاط كوبوينتو. استمتع بتجربة الولاء والمستويات والمكافآت في منصة كوبوينتو لعشاق القهوة في عمان.",
    canonical: "https://copointo.com/game",
  },
  "/leaderboard": {
    title: "لوحة الشرف | Copointo",
    description: "تنافس مع أبرز عشاق القهوة في عمان. استعرض لوحة شرف كوبوينتو وتعرّف على أعلى المستخدمين نقاطاً وأكثرهم ولاءً.",
    canonical: "https://copointo.com/leaderboard",
  },
};

function getRouteMeta(pathname: string): RouteMeta {
  const key = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return ROUTE_META[key] ?? ROUTE_META["/"];
}

// Web-only: force the Copointo logo as the browser favicon and inject SEO meta
// tags. Expo's dev server uses an internal HTML template that ignores
// `+html.tsx` and serves a default `/favicon.ico`, so we override the head
// at runtime so the tab icon + Google preview show our logo immediately.
// The helper is also called on popstate so SPA navigation updates the tags.
function applyWebMetadata() {
  if (typeof document === "undefined") return;
  const head = document.head;
  const ensure = (sel: string, create: () => HTMLElement) => {
    let el = head.querySelector(sel) as HTMLElement | null;
    if (!el) { el = create(); head.appendChild(el); }
    return el;
  };
  const setMeta = (attr: "name" | "property", key: string, content: string) => {
    const el = ensure(`meta[${attr}="${key}"]`, () => {
      const m = document.createElement("meta"); m.setAttribute(attr, key); return m;
    }) as HTMLMetaElement;
    el.content = content;
  };
  const setLink = (rel: string, href: string) => {
    const el = ensure(`link[rel="${rel}"]`, () => {
      const l = document.createElement("link"); l.rel = rel; return l;
    }) as HTMLLinkElement;
    el.href = href;
  };

  const { title, description, canonical } = getRouteMeta(window.location.pathname);

  document.title = title;
  document.documentElement.setAttribute("lang", "ar");
  document.documentElement.setAttribute("dir", "rtl");

  // Remove any pre-existing favicon links Expo injected, then add ours.
  head.querySelectorAll('link[rel*="icon"]').forEach(n => n.remove());
  const addLink = (rel: string, href: string, type?: string) => {
    const l = document.createElement("link");
    l.rel = rel; l.href = href;
    if (type) l.type = type;
    head.appendChild(l);
  };
  addLink("icon",            "/copointo-logo.png", "image/png");
  addLink("shortcut icon",   "/copointo-logo.png", "image/png");
  addLink("apple-touch-icon","/copointo-logo.png");

  setLink("canonical", canonical);

  setMeta("name",     "description",     description);
  setMeta("name",     "keywords",        "كوبوينتو, Copointo, كوفي عمان, قهوة عمان, كوفيهات سلطنة عمان, طلب قهوة, حجز طاولة كوفي, قسائم شرائية كوفي, coffee Oman, cafes Oman");
  setMeta("name",     "application-name","Copointo");
  setMeta("name",     "theme-color",     "#000000");
  setMeta("property", "og:type",         "website");
  setMeta("property", "og:site_name",    "Copointo");
  setMeta("property", "og:title",        title);
  setMeta("property", "og:description",  description);
  setMeta("property", "og:image",        "https://copointo.com/copointo-logo.png");
  setMeta("property", "og:url",          canonical);
  setMeta("property", "og:locale",       "ar_OM");
  setMeta("name",     "twitter:card",    "summary_large_image");
  setMeta("name",     "twitter:title",   title);
  setMeta("name",     "twitter:description", description);
  setMeta("name",     "twitter:image",   "https://copointo.com/copointo-logo.png");
}

if (typeof window !== "undefined") {
  applyWebMetadata();
  // Re-apply on all SPA navigations. Expo Router uses the History API
  // (pushState / replaceState) for in-app route changes, and popstate for
  // browser back/forward. Patch the History methods so every navigation —
  // tab switch, router.push(), etc. — also updates the head tags.
  const patchHistory = (method: "pushState" | "replaceState") => {
    const orig = history[method].bind(history);
    history[method] = function (...args: Parameters<typeof history.pushState>) {
      const result = orig(...args);
      applyWebMetadata();
      return result;
    };
  };
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", applyWebMetadata);
}

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="cafe/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="cafe/[id]/order" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="cafe/[id]/chat" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="cafe/[id]/book" options={{ headerShown: false, animation: "slide_from_right" }} />
      <Stack.Screen name="cart" options={{ headerShown: false, animation: "slide_from_bottom" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Web-only: silence the benign @expo-google-fonts load timeout. On the web
  // preview Inter is fetched over the network via an internal font observer
  // that rejects with the exact message "<n>ms timeout exceeded" when the
  // network is slow. useFonts already falls back gracefully (we render on
  // fontError above), so this rejection is harmless but surfaces as an uncaught
  // error overlay. Match ONLY that exact font-observer signature so unrelated
  // timeouts still propagate. Native bundles the fonts, so this never runs there.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = String((event?.reason as any)?.message ?? event?.reason ?? "");
      if (/^\d+ms timeout exceeded$/.test(msg)) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
         <LanguageProvider>
          <AppProvider>
            <MessagesProvider>
              <CommunityProvider>
               <SubscriptionProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    {/* Global auth gate — every entry point (including QR
                        deep-links to /cafe/[id]) must log in first. */}
                    <AuthGate>
                      <LevelRewardsGranter />
                      <CharacterMigrationNotice />
                      <RootLayoutNav />
                    </AuthGate>
                  </KeyboardProvider>
                </GestureHandlerRootView>
               </SubscriptionProvider>
              </CommunityProvider>
            </MessagesProvider>
          </AppProvider>
         </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

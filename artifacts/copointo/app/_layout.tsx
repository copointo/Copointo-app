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
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/AuthGate";
import LevelRewardsGranter from "@/components/LevelRewardsGranter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { CommunityProvider } from "@/context/CommunityContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { MessagesProvider } from "@/context/MessagesContext";

SplashScreen.preventAutoHideAsync();

// Web-only: force the Copointo logo as the browser favicon and inject SEO meta
// tags. Expo's dev server uses an internal HTML template that ignores
// `+html.tsx` and serves a default `/favicon.ico`, so we override the head
// at runtime so the tab icon + Google preview show our logo immediately.
if (typeof document !== "undefined") {
  const head = document.head;
  const ensure = (sel: string, create: () => HTMLElement) => {
    let el = head.querySelector(sel) as HTMLElement | null;
    if (!el) { el = create(); head.appendChild(el); }
    return el;
  };
  document.title = "Copointo — موقع مختص بعالم الكوفيهات في سلطنة عمان";
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

  const setMeta = (attr: "name" | "property", key: string, content: string) => {
    const el = ensure(`meta[${attr}="${key}"]`, () => {
      const m = document.createElement("meta"); m.setAttribute(attr, key); return m;
    }) as HTMLMetaElement;
    el.content = content;
  };
  setMeta("name",     "description",     "موقع مختص بعالم الكوفيهات في سلطنة عمان — اكتشف الكوفيهات، اطلب قهوتك، احجز طاولتك، واستمتع بأجواء كوبوينتو.");
  setMeta("name",     "application-name","Copointo");
  setMeta("name",     "theme-color",     "#000000");
  setMeta("property", "og:type",         "website");
  setMeta("property", "og:site_name",    "Copointo");
  setMeta("property", "og:title",        "Copointo — كوبوينتو");
  setMeta("property", "og:description",  "موقع مختص بعالم الكوفيهات في سلطنة عمان");
  setMeta("property", "og:image",        "/copointo-logo.png");
  setMeta("property", "og:locale",       "ar_OM");
  setMeta("name",     "twitter:card",    "summary");
  setMeta("name",     "twitter:title",   "Copointo — كوبوينتو");
  setMeta("name",     "twitter:description","موقع مختص بعالم الكوفيهات في سلطنة عمان");
  setMeta("name",     "twitter:image",   "/copointo-logo.png");
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

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
         <LanguageProvider>
          <AppProvider>
            <MessagesProvider>
              <CommunityProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    {/* Global auth gate — every entry point (including QR
                        deep-links to /cafe/[id]) must log in first. */}
                    <AuthGate>
                      <LevelRewardsGranter />
                      <RootLayoutNav />
                    </AuthGate>
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </CommunityProvider>
            </MessagesProvider>
          </AppProvider>
         </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

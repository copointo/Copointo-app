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

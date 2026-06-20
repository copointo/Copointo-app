import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, StyleSheet, Text, View, useColorScheme } from "react-native";

const COPOINTO_LOGO = require("../../assets/images/copointo-logo.png");
const COPOINTO_HUB = require("../../assets/images/copointo-hub.png");
import { useColors } from "@/hooks/useColors";
import { useResponsive } from "@/hooks/useResponsive";

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const r = useResponsive();
  const tbHeight = isWeb ? r.tabBarHeight : undefined;
  const icSize = r.iconSize;
  const labelSize = r.isPhone ? 10 : r.isTablet ? 12 : 13;

  // Single active "panel" that wraps BOTH the icon and the label together.
  // The default label is hidden (`tabBarShowLabel: false`) and we render it
  // ourselves inside the pill so the selected highlight covers icon + word.
  const renderTab = (label: string, icon: React.ReactNode, focused: boolean, color: string) => (
    <View style={[tabStyles.pill, focused && tabStyles.pillActive]}>
      {icon}
      <Text
        style={[tabStyles.pillLabel, { color, fontSize: labelSize }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#E8B86D",
        tabBarInactiveTintColor: "rgba(232,184,109,0.85)",
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb && tbHeight ? { height: tbHeight, paddingTop: 6, paddingBottom: 6 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
        tabBarItemStyle: isWeb && (r.isTablet || r.isDesktop)
          ? { maxWidth: 220, alignSelf: "center" }
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) =>
            renderTab(
              "Home",
              isIOS ? (
                <SymbolView name="house" tintColor={color} size={icSize} />
              ) : (
                <Feather name="home" size={icSize} color={color} />
              ),
              focused,
              color,
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) =>
            renderTab(
              "Messages",
              isIOS ? (
                <SymbolView name="message" tintColor={color} size={icSize} />
              ) : (
                <Feather name="message-circle" size={icSize} color={color} />
              ),
              focused,
              color,
            ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Reels",
          tabBarIcon: ({ color, focused }) =>
            renderTab(
              "Reels",
              isIOS ? (
                <SymbolView name="play.rectangle" tintColor={color} size={icSize} />
              ) : (
                <Feather name="play-circle" size={icSize} color={color} />
              ),
              focused,
              color,
            ),
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Copointo",
          tabBarIcon: ({ color, focused }) =>
            renderTab(
              "Copointo",
              <Image
                source={COPOINTO_HUB}
                style={{ width: icSize + 4, height: icSize + 4, resizeMode: "contain", opacity: focused ? 1 : 0.85 }}
              />,
              focused,
              color,
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) =>
            renderTab(
              "Profile",
              isIOS ? (
                <SymbolView name="person" tintColor={color} size={icSize} />
              ) : (
                <Feather name="user" size={icSize} color={color} />
              ),
              focused,
              color,
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  // Always render the brand amber tab bar on every platform. The iOS 26
  // "Liquid Glass" native tab bar forced an off-brand system-blue selection
  // highlight that could not be reliably overridden, so the custom amber bar
  // is used everywhere for a clear, consistent, on-brand result.
  return <ClassicTabLayout />;
}

const tabStyles = StyleSheet.create({
  pill: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minWidth: 48,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  pillActive: {
    backgroundColor: "rgba(232,184,109,0.15)",
    borderColor: "rgba(232,184,109,0.45)",
    shadowColor: "#E8B86D",
    shadowOpacity: 0.55,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  pillLabel: {
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
});

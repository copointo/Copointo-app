import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, StyleSheet, View, useColorScheme } from "react-native";

const COPOINTO_LOGO = require("../../assets/images/copointo-logo.png");
import { useColors } from "@/hooks/useColors";
import { useResponsive } from "@/hooks/useResponsive";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="messages">
        <Icon sf={{ default: "message", selected: "message.fill" }} />
        <Label>Messages</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="videos">
        <Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} />
        <Label>Reels</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="game">
        <Icon src={COPOINTO_LOGO} />
        <Label>Copointo Hub</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const r = useResponsive();
  const tbHeight = isWeb ? r.tabBarHeight : undefined;
  const icSize = r.iconSize;
  const labelSize = r.isPhone ? 10 : r.isTablet ? 11 : 12;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#E8B86D",
        tabBarInactiveTintColor: "#E8B86D",
        headerShown: false,
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
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: labelSize,
        },
        tabBarItemStyle: isWeb && (r.isTablet || r.isDesktop)
          ? { maxWidth: 220, alignSelf: "center" }
          : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={icSize} />
            ) : (
              <Feather name="home" size={icSize} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="message" tintColor={color} size={icSize} />
            ) : (
              <Feather name="message-circle" size={icSize} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: "Reels",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="play.rectangle" tintColor={color} size={icSize} />
            ) : (
              <Feather name="play-circle" size={icSize} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Copointo Hub",
          tabBarIcon: () => (
            <Image
              source={COPOINTO_LOGO}
              style={{ width: icSize + 4, height: icSize + 4, resizeMode: "contain" }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person" tintColor={color} size={icSize} />
            ) : (
              <Feather name="user" size={icSize} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

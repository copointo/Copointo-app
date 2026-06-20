import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COPOINTO_HUB = require("../../assets/images/copointo-hub.png");
import { useColors } from "@/hooks/useColors";
import { useResponsive } from "@/hooks/useResponsive";

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ACTIVE = "#E8B86D";
const INACTIVE = "rgba(232,184,109,0.85)";
const BUBBLE_INSET = 5; // horizontal gap between the bubble and the tab cell edge

// Renders just the raw icon for a given route (platform-aware).
function TabIcon({ routeName, color, focused, size }: { routeName: string; color: string; focused: boolean; size: number }) {
  const isIOS = Platform.OS === "ios";
  switch (routeName) {
    case "index":
      return isIOS ? <SymbolView name="house" tintColor={color} size={size} /> : <Feather name="home" size={size} color={color} />;
    case "messages":
      return isIOS ? <SymbolView name="message" tintColor={color} size={size} /> : <Feather name="message-circle" size={size} color={color} />;
    case "videos":
      return isIOS ? <SymbolView name="play.rectangle" tintColor={color} size={size} /> : <Feather name="play-circle" size={size} color={color} />;
    case "game":
      return (
        <Image
          source={COPOINTO_HUB}
          style={{ width: size + 4, height: size + 4, resizeMode: "contain", opacity: focused ? 1 : 0.85 }}
        />
      );
    case "profile":
      return isIOS ? <SymbolView name="person" tintColor={color} size={size} /> : <Feather name="user" size={size} color={color} />;
    default:
      return null;
  }
}

// Custom tab bar with a SINGLE shared amber "bubble" highlight that physically
// slides (springs) from the previously-selected tab to the newly-selected one —
// like a bubble being pulled across and re-forming in the next button. Works in
// both LTR and RTL because positions come from real measured layouts.
function LiquidTabBar({ state, descriptors, navigation }: TabBarProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const r = useResponsive();
  const insets = useSafeAreaInsets();

  const icSize = r.iconSize;
  const labelSize = r.isPhone ? 10 : r.isTablet ? 12 : 13;
  // r.tabBarHeight is 0 on native (web-only value), so fall back to a real
  // height there — otherwise the bar/row collapse and the bubble renders as a
  // thin line instead of a rounded box.
  const barHeight = isWeb ? r.tabBarHeight : r.isPhone ? 58 : r.isTablet ? 72 : 80;

  // Measured {x,width} per tab index (relative to the tab row).
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const tx = useRef(new Animated.Value(0)).current; // bubble translateX (native driver)
  const initialized = useRef(false);

  const active = layouts[state.index];

  useEffect(() => {
    if (!active) return;
    const target = active.x + BUBBLE_INSET;
    if (!initialized.current) {
      tx.setValue(target);
      initialized.current = true;
      return;
    }
    Animated.spring(tx, {
      toValue: target,
      useNativeDriver: true,
      friction: 8,
      tension: 75,
    }).start();
  }, [active?.x, active?.width, state.index, tx]);

  const onTabLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const cur = prev[index];
      if (cur && cur.x === x && cur.width === width) return prev;
      return { ...prev, [index]: { x, width } };
    });
  };

  const bubbleWidth = active ? Math.max(0, active.width - BUBBLE_INSET * 2) : 0;

  return (
    <View style={[styles.bar, { height: barHeight + insets.bottom, paddingBottom: insets.bottom }]}>
      {/* Bar background */}
      {isIOS ? (
        <BlurView intensity={100} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, borderTopWidth: isWeb ? 1 : 0, borderTopColor: colors.border }]} />
      )}

      <View style={styles.row}>
        {/* The single sliding bubble (rendered behind the tabs) */}
        {active && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              { width: bubbleWidth, transform: [{ translateX: tx }] },
            ]}
          />
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.title === "string" ? options.title : route.name;
          const focused = state.index === index;
          const color = focused ? ACTIVE : INACTIVE;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onLayout={onTabLayout(index)}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.tab}
            >
              <TabIcon routeName={route.name} color={color} focused={focused} size={icSize} />
              <Text
                style={[styles.label, { color, fontSize: labelSize }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ClassicTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="videos" options={{ title: "Reels" }} />
      <Tabs.Screen name="game" options={{ title: "Copointo" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
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

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 0,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    zIndex: 1,
  },
  bubble: {
    position: "absolute",
    left: 0,
    top: 2,
    bottom: 2,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(232,184,109,0.15)",
    borderColor: "rgba(232,184,109,0.45)",
    shadowColor: "#E8B86D",
    shadowOpacity: 0.55,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  label: {
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
});

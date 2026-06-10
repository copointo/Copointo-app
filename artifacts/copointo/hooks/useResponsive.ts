import { useMemo } from "react";
import { Platform, useWindowDimensions } from "react-native";

export type DeviceKind = "phone" | "tablet" | "desktop";

export interface Responsive {
  width: number;
  height: number;
  kind: DeviceKind;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWeb: boolean;
  scale: number;
  contentMaxWidth: number;
  hPad: number;
  tabBarHeight: number;
  iconSize: number;
  fontScale: number;
}

const PHONE_MAX = 600;
const TABLET_MAX = 1024;

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === "web";

  return useMemo<Responsive>(() => {
    const kind: DeviceKind =
      width < PHONE_MAX ? "phone" : width < TABLET_MAX ? "tablet" : "desktop";
    const isPhone = kind === "phone";
    const isTablet = kind === "tablet";
    const isDesktop = kind === "desktop";

    const scale = isPhone ? 1 : isTablet ? 1.2 : 1.3;
    const fontScale = isPhone ? 1 : isTablet ? 1.1 : 1.15;
    const contentMaxWidth = isPhone ? width : isTablet ? 720 : 960;
    const hPad = isPhone ? 16 : isTablet ? 24 : 32;
    const tabBarHeight = isWeb
      ? isPhone
        ? 70
        : isTablet
        ? 80
        : 88
      : 0;
    const iconSize = isPhone ? 22 : isTablet ? 30 : 32;

    return {
      width,
      height,
      kind,
      isPhone,
      isTablet,
      isDesktop,
      isWeb,
      scale,
      fontScale,
      contentMaxWidth,
      hPad,
      tabBarHeight,
      iconSize,
    };
  }, [width, height, isWeb]);
}

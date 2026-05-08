import React from "react";
import { Image, View, ViewStyle } from "react-native";
import { useFrames } from "../hooks/useFrames";
import { getFrame } from "../data/frames";

interface Props {
  /** Diameter of the avatar circle inside the frame (px). */
  size: number;
  /** The avatar element (Image or fallback View). Should already be sized to `size`. */
  children: React.ReactNode;
  /** If provided, force this frame id; otherwise use the user's equipped frame. */
  frameId?: string | null;
  /** Frame size multiplier relative to avatar. Default 1.55. */
  scale?: number;
  /** Optional style for the outer wrapper. */
  style?: ViewStyle;
}

/**
 * Wraps an avatar with the user's equipped decorative frame (shield badge).
 * The frame extends visually outside the avatar circle, so the wrapper allows
 * overflow.
 */
export default function AvatarWithFrame({
  size,
  children,
  frameId,
  scale = 1.55,
  style,
}: Props) {
  const { equipped } = useFrames();
  const id = frameId !== undefined ? frameId : equipped;
  const frame = getFrame(id);

  const frameSize = Math.round(size * scale);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {children}
      {frame && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: frameSize,
            height: frameSize,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={frame.source}
            style={{
              width: frameSize,
              height: frameSize,
              resizeMode: "contain",
            }}
          />
        </View>
      )}
    </View>
  );
}

import React from "react";
import { Image } from "react-native";
import { useBadges } from "../hooks/useBadges";
import { getBadge } from "../data/badges";

interface Props {
  /** Render this badge id explicitly. If undefined, use the user's equipped badge. If null, render nothing. */
  badgeId?: string | null;
  /** Size in px. Default 18. */
  size?: number;
}

/**
 * Tiny inline shield-style badge shown next to a user's name.
 * Returns null if there is nothing to render so callers can drop it in safely.
 */
export default function UserBadge({ badgeId, size = 18 }: Props) {
  const { equipped } = useBadges();
  const id = badgeId !== undefined ? badgeId : equipped;
  const badge = getBadge(id);
  if (!badge) return null;
  return (
    <Image
      source={badge.source}
      style={{ width: size, height: size, resizeMode: "contain" }}
    />
  );
}

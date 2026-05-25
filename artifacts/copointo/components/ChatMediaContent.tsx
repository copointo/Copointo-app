import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React, { useMemo, useState } from "react";
import {
  Image, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { ChatMessage } from "@/data/mockData";
import { resolveChatMediaUrl } from "@/constants/api";

const PRIMARY = "#E8B86D";
const BAR_BG  = "rgba(232,184,109,0.18)";
const TEXT    = "rgba(255,255,255,0.85)";

function fmtSec(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Inline image — tap to view fullscreen. */
function ImageAttachment({ uri }: { uri: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpen(true)}>
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.fullscreen} onPress={() => setOpen(false)}>
          <Image source={{ uri }} style={styles.fullscreenImage} resizeMode="contain" />
          <View style={styles.closeBtn}>
            <Feather name="x" size={22} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Inline video — uses expo-video. Plays inline; tap-to-fullscreen via native control. */
function VideoAttachment({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  return (
    <View style={styles.videoWrap}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls
        contentFit="cover"
        allowsFullscreen
      />
    </View>
  );
}

/** Voice note — play / pause button + progress bar + duration. */
function AudioAttachment({ uri, duration, onThemed }: {
  uri: string; duration?: number; onThemed?: boolean;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = duration && duration > 0
    ? duration
    : (status?.duration ? status.duration : 0);
  const current = status?.currentTime ?? 0;
  const playing = !!status?.playing;
  const progressPct = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  const toggle = () => {
    if (playing) { player.pause(); return; }
    // Rewind if we're at the end already.
    if (total > 0 && current >= total - 0.25) {
      try { player.seekTo(0); } catch { /* ignore */ }
    }
    player.play();
  };

  const fg = onThemed ? "rgba(0,0,0,0.85)" : PRIMARY;
  const sub = onThemed ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
  const trackBg = onThemed ? "rgba(0,0,0,0.18)" : BAR_BG;

  return (
    <View style={styles.audioRow}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.8} style={[
        styles.audioBtn, { borderColor: fg, backgroundColor: fg + "1F" },
      ]}>
        <Feather name={playing ? "pause" : "play"} size={18} color={fg} />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 120 }}>
        <View style={[styles.audioTrack, { backgroundColor: trackBg }]}>
          <View style={[
            styles.audioFill,
            { width: `${progressPct}%`, backgroundColor: fg },
          ]} />
        </View>
        <Text style={[styles.audioTime, { color: sub }]}>
          {playing || current > 0 ? `${fmtSec(current)} / ${fmtSec(total)}` : fmtSec(total)}
        </Text>
      </View>
    </View>
  );
}

interface Props {
  message: ChatMessage;
  /** True when this bubble is the user's own (amber bg) — used by audio
   *  attachment so its controls stay legible on a light background. */
  onThemed?: boolean;
}

/** Render any media attachments carried by a ChatMessage. Returns null when
 *  the message has no image/video/audio. */
export default function ChatMediaContent({ message, onThemed }: Props) {
  const imageUri = useMemo(() => resolveChatMediaUrl(message.imageUrl), [message.imageUrl]);
  const videoUri = useMemo(() => resolveChatMediaUrl(message.videoUrl), [message.videoUrl]);
  const audioUri = useMemo(() => resolveChatMediaUrl(message.audioUrl), [message.audioUrl]);
  if (!imageUri && !videoUri && !audioUri) return null;
  return (
    <View style={{ marginTop: 2, marginBottom: 4 }}>
      {!!imageUri && <ImageAttachment uri={imageUri} />}
      {!!videoUri && <VideoAttachment uri={videoUri} />}
      {!!audioUri && <AudioAttachment uri={audioUri} duration={message.mediaDuration} onThemed={onThemed} />}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 220, height: 220, borderRadius: 12,
    backgroundColor: "#111",
  },
  videoWrap: {
    width: 240, height: 240, borderRadius: 12, overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { width: "100%", height: "100%" },

  fullscreen: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center", justifyContent: "center",
  },
  fullscreenImage: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 24, right: 18,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },

  audioRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 4, minWidth: 200,
  },
  audioBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  audioTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  audioFill:  { height: "100%", borderRadius: 2 },
  audioTime:  { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 4, color: TEXT },
});

import { Platform } from "react-native";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  gainPeak = 0.18,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);
  gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
  gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + startAt);
  osc.stop(ctx.currentTime + startAt + duration + 0.05);
}

/** Soft two-tone chime — used when a new notification arrives in the game. */
export function playNotificationChime() {
  const ctx = getCtx();
  if (!ctx) return;
  playTone(ctx, 880, 0,    0.28, 0.16, "sine");
  playTone(ctx, 1320, 0.14, 0.32, 0.14, "sine");
}

/** Triumphant ascending arpeggio — used when the user levels up. */
export function playLevelUpSound() {
  const ctx = getCtx();
  if (!ctx) return;
  playTone(ctx, 523.25, 0.00, 0.18, 0.18, "triangle");
  playTone(ctx, 659.25, 0.12, 0.18, 0.18, "triangle");
  playTone(ctx, 783.99, 0.24, 0.22, 0.20, "triangle");
  playTone(ctx, 1046.5, 0.38, 0.45, 0.22, "triangle");
}

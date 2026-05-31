import { apiFetch, apiPost } from "./api";

// ── Shared view types (mirror the server's redact() output) ──────────────────
export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoKind = "num" | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export type UnoMode = "1v1" | "2v2";
export type UnoStatus = "waiting" | "playing" | "finished";

export interface UnoCard {
  id: string;
  color: UnoColor | null;
  kind: UnoKind;
  value: number | null;
}

export interface UnoViewPlayer {
  seat: number;
  name: string;
  avatar?: string;
  isBot: boolean;
  team: 0 | 1;
  handCount: number;
  saidUno: boolean;
  isYou: boolean;
}

export interface UnoView {
  id: string;
  mode: UnoMode;
  status: UnoStatus;
  capacity: number;
  isPublic: boolean;
  hostUserId: string;
  countdownMs: number;
  seq: number;
  yourSeat: number | null;
  yourTeam: 0 | 1 | null;
  isYourTurn: boolean;
  yourHand: UnoCard[];
  playableCardIds: string[];
  drawnCardId: string | null;
  canPass: boolean;
  topCard: UnoCard | null;
  activeColor: UnoColor | null;
  drawCount: number;
  turnSeat: number;
  dir: 1 | -1;
  players: UnoViewPlayer[];
  winnerSeat: number | null;
  winnerTeam: 0 | 1 | null;
  youWon: boolean;
  log: string[];
}

export interface UnoFriend {
  id: string;
  name: string;
  avatar?: string;
  level?: number;
}

export interface UnoInviteSummary {
  sessionId: string;
  mode: UnoMode;
  fromName: string;
  at: number;
  players: number;
  capacity: number;
  countdownMs: number;
}

// ── Visual mapping for card colors (amber-glow theme friendly) ───────────────
export const UNO_COLORS: Record<UnoColor, string> = {
  red: "#E0584C",
  yellow: "#E8B86D",
  green: "#4CAF73",
  blue: "#4C7FE0",
};
export const UNO_WILD = "#1A1320";

export function cardFill(card: UnoCard, activeColor?: UnoColor | null): string {
  if (card.color) return UNO_COLORS[card.color];
  // wild / wild4: tint by the chosen active color when known
  if (activeColor) return UNO_COLORS[activeColor];
  return UNO_WILD;
}

/** Short label drawn on a card face. */
export function cardLabel(card: UnoCard): string {
  switch (card.kind) {
    case "num":
      return String(card.value ?? "");
    case "skip":
      return "⦸";
    case "reverse":
      return "⮌";
    case "draw2":
      return "+2";
    case "wild":
      return "★";
    case "wild4":
      return "+4";
    default:
      return "";
  }
}

export function isWild(card: UnoCard): boolean {
  return card.kind === "wild" || card.kind === "wild4";
}

// ── Identity sent with every request (mock-auth: client-supplied) ────────────
export interface UnoIdentity {
  userId: string;
  name?: string;
  avatar?: string;
}

type StateRes = { view: UnoView };
type CreateRes = { id: string; view: UnoView };

export const unoApi = {
  create(id: UnoIdentity, mode: UnoMode, isPublic = false) {
    return apiPost<CreateRes>("/uno/sessions", { ...id, mode, isPublic });
  },
  quickmatch(id: UnoIdentity, mode: UnoMode) {
    return apiPost<CreateRes>("/uno/quickmatch", { ...id, mode });
  },
  join(sessionId: string, id: UnoIdentity) {
    return apiPost<CreateRes>(`/uno/sessions/${sessionId}/join`, id);
  },
  invite(sessionId: string, id: UnoIdentity, toUserId: string) {
    return apiPost<{ ok: boolean }>(`/uno/sessions/${sessionId}/invite`, { ...id, toUserId });
  },
  invites(userId: string) {
    return apiFetch<{ invites: UnoInviteSummary[] }>(
      `/uno/invites?userId=${encodeURIComponent(userId)}`,
    );
  },
  decline(sessionId: string, id: UnoIdentity) {
    return apiPost<{ ok: boolean }>(`/uno/sessions/${sessionId}/decline`, id);
  },
  friends(userId: string) {
    return apiFetch<{ friends: UnoFriend[] }>(
      `/uno/friends?userId=${encodeURIComponent(userId)}`,
    );
  },
  leave(sessionId: string, id: UnoIdentity) {
    return apiPost<{ ok: boolean }>(`/uno/sessions/${sessionId}/leave`, id);
  },
  state(sessionId: string, userId: string) {
    return apiFetch<StateRes>(
      `/uno/sessions/${sessionId}?userId=${encodeURIComponent(userId)}`,
    );
  },
  play(sessionId: string, id: UnoIdentity, cardId: string, color?: UnoColor) {
    return apiPost<StateRes>(`/uno/sessions/${sessionId}/play`, { ...id, cardId, color });
  },
  draw(sessionId: string, id: UnoIdentity) {
    return apiPost<StateRes>(`/uno/sessions/${sessionId}/draw`, id);
  },
  pass(sessionId: string, id: UnoIdentity) {
    return apiPost<StateRes>(`/uno/sessions/${sessionId}/pass`, id);
  },
  sayUno(sessionId: string, id: UnoIdentity) {
    return apiPost<StateRes>(`/uno/sessions/${sessionId}/uno`, id);
  },
};

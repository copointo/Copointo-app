// ─────────────────────────────────────────────────────────────────────────
// Server-authoritative UNO engine (pure — no store/HTTP deps).
//
// Holds the full game state (UnoGame) and all the rules: 108-card deck, deal,
// validity, action-card effects (skip/reverse/+2, wild/+4), direction,
// reshuffle, bot AI, and a "lazy tick" that advances the lobby countdown and
// bot/human-timeout turns whenever any client polls (so we never need a global
// setInterval, which would double-fire on autoscale).
// ─────────────────────────────────────────────────────────────────────────

export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoKind = "num" | "skip" | "reverse" | "draw2" | "wild" | "wild4";

export interface UnoCard {
  id: string;
  /** null only for wild / wild4. */
  color: UnoColor | null;
  kind: UnoKind;
  /** 0-9 for `num`, otherwise undefined. */
  value?: number;
}

export interface UnoPlayer {
  seat: number;
  /** null for bots and (briefly) empty seats. */
  userId: string | null;
  name: string;
  avatar?: string;
  isBot: boolean;
  team: 0 | 1;
  hand: UnoCard[];
  saidUno: boolean;
  connected: boolean;
}

export interface UnoInvite {
  toUserId: string;
  fromUserId: string;
  fromName: string;
  at: number;
}

export type UnoMode = "1v1" | "2v2";
export type UnoStatus = "waiting" | "playing" | "finished";

export interface UnoGame {
  id: string;
  mode: UnoMode;
  capacity: number; // 2 or 4
  status: UnoStatus;
  isPublic: boolean;
  hostUserId: string;
  createdAt: number;
  /** Waiting-room deadline (createdAt + WAIT_MS). Auto-starts when reached. */
  startsAt: number;
  players: UnoPlayer[];
  invites: UnoInvite[];

  // ── play state (populated when status === "playing") ──
  drawPile: UnoCard[];
  discard: UnoCard[]; // last element = top card
  activeColor: UnoColor | null;
  turnSeat: number;
  dir: 1 | -1;
  /** Set true after the current player draws a playable card (may play it or pass). */
  drawnThisTurn: boolean;
  drawnCardId: string | null;
  /** Wall-clock time the current player may be auto-advanced (bot think delay
   *  or human turn timeout). */
  actDeadline: number;
  winnerSeat: number | null;
  winnerTeam: 0 | 1 | null;
  log: string[];
  seq: number;
}

export const WAIT_MS = 60_000;
// Bots act within ~3s of their turn; a human gets a 10s turn timer before a bot
// auto-plays for them (so the table never stalls on an absent/idle player).
const BOT_DELAY_MS = 3_000;
const HUMAN_TIMEOUT_MS = 10_000;
const MAX_LOG = 14;

const COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];
// Realistic-looking names so bots blend in as ordinary players.
const BOT_NAME_POOL = [
  "سارة", "خالد", "نورة", "عبدالله", "ريم", "فهد", "لمى", "سعود",
  "جواهر", "ماجد", "هند", "تركي", "أمل", "بدر", "شهد", "ناصر",
  "دانة", "يوسف", "غادة", "سلطان",
];

// ── helpers ──────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function pushLog(g: UnoGame, line: string) {
  g.log.push(line);
  if (g.log.length > MAX_LOG) g.log.splice(0, g.log.length - MAX_LOG);
}

function buildDeck(): UnoCard[] {
  const d: UnoCard[] = [];
  let n = 0;
  const add = (c: Omit<UnoCard, "id">) => d.push({ ...c, id: `k${n++}` });
  for (const color of COLORS) {
    add({ color, kind: "num", value: 0 });
    for (let v = 1; v <= 9; v++) {
      add({ color, kind: "num", value: v });
      add({ color, kind: "num", value: v });
    }
    for (const k of ["skip", "reverse", "draw2"] as const) {
      add({ color, kind: k });
      add({ color, kind: k });
    }
  }
  for (let i = 0; i < 4; i++) {
    add({ color: null, kind: "wild" });
    add({ color: null, kind: "wild4" });
  }
  return d;
}

export function topCard(g: UnoGame): UnoCard | null {
  return g.discard.length ? g.discard[g.discard.length - 1]! : null;
}

export function isPlayable(card: UnoCard, top: UnoCard | null, activeColor: UnoColor | null): boolean {
  if (card.kind === "wild" || card.kind === "wild4") return true;
  if (activeColor && card.color === activeColor) return true;
  if (!top) return true;
  if (card.kind === "num" && top.kind === "num") return card.value === top.value;
  if (card.kind !== "num" && card.kind === top.kind) return true; // symbol match across colors
  return false;
}

/**
 * Real-UNO restriction for Wild Draw Four: it may only be played when the player
 * holds NO card matching the active color. (A plain Wild is always allowed.)
 */
export function isWild4Legal(hand: UnoCard[], activeColor: UnoColor | null): boolean {
  if (!activeColor) return true;
  return !hand.some(c => c.color === activeColor);
}

/** Hand-aware legality wrapper that layers the +4 restriction on top of isPlayable. */
export function isPlayableFromHand(
  card: UnoCard,
  top: UnoCard | null,
  activeColor: UnoColor | null,
  hand: UnoCard[],
): boolean {
  if (!isPlayable(card, top, activeColor)) return false;
  if (card.kind === "wild4") return isWild4Legal(hand, activeColor);
  return true;
}

function playerLabel(g: UnoGame, seat: number): string {
  return g.players[seat]?.name ?? `#${seat}`;
}

function setTurn(g: UnoGame, seat: number, now: number) {
  g.turnSeat = seat;
  g.drawnThisTurn = false;
  g.drawnCardId = null;
  const p = g.players[seat];
  g.actDeadline = now + (p && p.isBot ? BOT_DELAY_MS : HUMAN_TIMEOUT_MS);
}

function seatBy(g: UnoGame, steps: number): number {
  const cap = g.capacity;
  return (((g.turnSeat + g.dir * steps) % cap) + cap) % cap;
}

function advance(g: UnoGame, steps: number, now: number) {
  setTurn(g, seatBy(g, steps), now);
}

function reshuffleIfNeeded(g: UnoGame) {
  if (g.drawPile.length > 0) return;
  if (g.discard.length <= 1) return;
  const top = g.discard.pop()!;
  const rest = g.discard;
  g.discard = [top];
  g.drawPile = shuffle(rest);
}

function drawCards(g: UnoGame, seat: number, n: number) {
  const p = g.players[seat];
  if (!p) return;
  for (let i = 0; i < n; i++) {
    reshuffleIfNeeded(g);
    const c = g.drawPile.pop();
    if (!c) break;
    p.hand.push(c);
  }
  if (p.hand.length > 1) p.saidUno = false;
}

function finish(g: UnoGame, seat: number) {
  const p = g.players[seat]!;
  g.status = "finished";
  g.winnerSeat = seat;
  g.winnerTeam = p.team;
  g.actDeadline = Number.MAX_SAFE_INTEGER;
  pushLog(g, `🏆 فاز ${p.name}`);
}

// ── lobby / start ──────────────────────────────────────────────────────────
export function createGame(opts: {
  id: string;
  mode: UnoMode;
  isPublic: boolean;
  host: { userId: string; name: string; avatar?: string };
}): UnoGame {
  const now = Date.now();
  const capacity = opts.mode === "2v2" ? 4 : 2;
  return {
    id: opts.id,
    mode: opts.mode,
    capacity,
    status: "waiting",
    isPublic: opts.isPublic,
    hostUserId: opts.host.userId,
    createdAt: now,
    startsAt: now + WAIT_MS,
    players: [
      {
        seat: 0,
        userId: opts.host.userId,
        name: opts.host.name,
        avatar: opts.host.avatar,
        isBot: false,
        team: 0,
        hand: [],
        saidUno: false,
        connected: true,
      },
    ],
    invites: [],
    drawPile: [],
    discard: [],
    activeColor: null,
    turnSeat: 0,
    dir: 1,
    drawnThisTurn: false,
    drawnCardId: null,
    actDeadline: 0,
    winnerSeat: null,
    winnerTeam: null,
    log: [],
    seq: 0,
  };
}

export function seatedUserIds(g: UnoGame): string[] {
  return g.players.filter(p => p.userId).map(p => p.userId!) as string[];
}

export function hasOpenSeat(g: UnoGame): boolean {
  return g.status === "waiting" && g.players.length < g.capacity;
}

export function joinGame(
  g: UnoGame,
  user: { userId: string; name: string; avatar?: string },
): { ok: boolean; reason?: string } {
  if (g.status !== "waiting") return { ok: false, reason: "started" };
  if (g.players.some(p => p.userId === user.userId)) return { ok: true };
  if (g.players.length >= g.capacity) return { ok: false, reason: "full" };
  g.players.push({
    seat: g.players.length,
    userId: user.userId,
    name: user.name,
    avatar: user.avatar,
    isBot: false,
    team: 0,
    hand: [],
    saidUno: false,
    connected: true,
  });
  // Remove a consumed invite if present.
  g.invites = g.invites.filter(iv => iv.toUserId !== user.userId);
  pushLog(g, `➕ انضم ${user.name}`);
  return { ok: true };
}

function startGame(g: UnoGame, now: number) {
  // Fill remaining seats with bots using random, human-looking names that don't
  // collide with the names already seated.
  const usedNames = new Set(g.players.map(p => p.name));
  const botNames = shuffle([...BOT_NAME_POOL]).filter(n => !usedNames.has(n));
  let bi = 0;
  while (g.players.length < g.capacity) {
    const seat = g.players.length;
    g.players.push({
      seat,
      userId: null,
      name: botNames[bi++ % botNames.length] ?? `لاعب ${seat + 1}`,
      isBot: true,
      team: 0,
      hand: [],
      saidUno: false,
      connected: true,
    });
  }
  // Re-seat indices + assign teams (2v2: alternating; 1v1: own team).
  g.players.forEach((p, i) => {
    p.seat = i;
    p.team = (g.capacity === 4 ? (i % 2) : i) as 0 | 1;
    p.hand = [];
  });

  const deck = shuffle(buildDeck());
  for (let r = 0; r < 7; r++) {
    for (const p of g.players) {
      const c = deck.pop();
      if (c) p.hand.push(c);
    }
  }
  // First discard must be a number card.
  let firstIdx = deck.findIndex(c => c.kind === "num");
  if (firstIdx < 0) firstIdx = deck.length - 1;
  const first = deck.splice(firstIdx, 1)[0]!;
  g.drawPile = deck;
  g.discard = [first];
  g.activeColor = first.color;
  g.dir = 1;
  g.status = "playing";
  g.winnerSeat = null;
  g.winnerTeam = null;
  pushLog(g, "🎮 بدأت اللعبة");
  setTurn(g, 0, now);
}

// ── moves ────────────────────────────────────────────────────────────────
export function applyPlay(
  g: UnoGame,
  seat: number,
  cardId: string,
  chosenColor: UnoColor | undefined,
  now: number,
): { ok: boolean; reason?: string } {
  if (g.status !== "playing") return { ok: false, reason: "not_playing" };
  if (g.turnSeat !== seat) return { ok: false, reason: "not_your_turn" };
  const p = g.players[seat]!;
  const idx = p.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return { ok: false, reason: "no_card" };
  const card = p.hand[idx]!;
  const top = topCard(g);
  if (!isPlayable(card, top, g.activeColor)) return { ok: false, reason: "illegal" };
  if (card.kind === "wild4" && !isWild4Legal(p.hand, g.activeColor)) {
    return { ok: false, reason: "illegal_wild4" };
  }
  if ((card.kind === "wild" || card.kind === "wild4") && !chosenColor) {
    return { ok: false, reason: "need_color" };
  }

  p.hand.splice(idx, 1);
  g.discard.push(card);
  g.activeColor = card.kind === "wild" || card.kind === "wild4" ? chosenColor! : card.color;
  // Auto-declare UNO when reaching one card (no penalty variant).
  if (p.hand.length === 1) {
    p.saidUno = true;
    pushLog(g, `🔔 ${p.name}: UNO!`);
  }
  const colorWord = card.kind === "wild" || card.kind === "wild4" ? ` (${g.activeColor})` : "";
  pushLog(g, `▶️ ${p.name}: ${describeCard(card)}${colorWord}`);

  if (p.hand.length === 0) {
    finish(g, seat);
    g.seq++;
    return { ok: true };
  }

  let steps = 1;
  switch (card.kind) {
    case "draw2": {
      const t = seatBy(g, 1);
      drawCards(g, t, 2);
      pushLog(g, `➕2 ${playerLabel(g, t)}`);
      steps = 2;
      break;
    }
    case "wild4": {
      const t = seatBy(g, 1);
      drawCards(g, t, 4);
      pushLog(g, `➕4 ${playerLabel(g, t)}`);
      steps = 2;
      break;
    }
    case "skip":
      steps = 2;
      break;
    case "reverse":
      g.dir = (g.dir === 1 ? -1 : 1) as 1 | -1;
      steps = g.capacity === 2 ? 2 : 1;
      break;
    default:
      steps = 1;
  }
  advance(g, steps, now);
  g.seq++;
  return { ok: true };
}

export function applyDraw(g: UnoGame, seat: number, now: number): { ok: boolean; reason?: string } {
  if (g.status !== "playing") return { ok: false, reason: "not_playing" };
  if (g.turnSeat !== seat) return { ok: false, reason: "not_your_turn" };
  if (g.drawnThisTurn) return { ok: false, reason: "already_drew" };
  reshuffleIfNeeded(g);
  const card = g.drawPile.pop();
  const p = g.players[seat]!;
  if (!card) {
    // Nothing to draw — just pass.
    advance(g, 1, now);
    g.seq++;
    return { ok: true };
  }
  p.hand.push(card);
  if (p.hand.length > 1) p.saidUno = false;
  pushLog(g, `🃏 سحب ${p.name}`);
  if (isPlayableFromHand(card, topCard(g), g.activeColor, p.hand)) {
    g.drawnThisTurn = true;
    g.drawnCardId = card.id;
  } else {
    advance(g, 1, now);
  }
  g.seq++;
  return { ok: true };
}

export function applyPass(g: UnoGame, seat: number, now: number): { ok: boolean; reason?: string } {
  if (g.status !== "playing") return { ok: false, reason: "not_playing" };
  if (g.turnSeat !== seat) return { ok: false, reason: "not_your_turn" };
  if (!g.drawnThisTurn) return { ok: false, reason: "must_draw" };
  advance(g, 1, now);
  g.seq++;
  return { ok: true };
}

export function sayUno(g: UnoGame, seat: number): { ok: boolean } {
  const p = g.players[seat];
  if (p && p.hand.length <= 2) p.saidUno = true;
  return { ok: true };
}

// ── bot AI ──────────────────────────────────────────────────────────────
function describeCard(c: UnoCard): string {
  if (c.kind === "num") return `${c.color} ${c.value}`;
  if (c.kind === "wild") return "wild";
  if (c.kind === "wild4") return "wild+4";
  return `${c.color} ${c.kind}`;
}

function pickBotColor(hand: UnoCard[]): UnoColor {
  const count: Record<UnoColor, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) if (c.color) count[c.color]++;
  let best: UnoColor = "red";
  for (const c of COLORS) if (count[c] > count[best]) best = c;
  return best;
}

function botPickCard(hand: UnoCard[], top: UnoCard | null, activeColor: UnoColor | null): UnoCard | null {
  const playable = hand.filter(c => isPlayableFromHand(c, top, activeColor, hand));
  if (!playable.length) return null;
  const nonWild = playable.filter(c => c.kind !== "wild" && c.kind !== "wild4");
  if (nonWild.length) {
    // Shed aggressive cards first, then highest number.
    const score = (c: UnoCard) =>
      c.kind === "draw2" ? 30 : c.kind === "skip" ? 22 : c.kind === "reverse" ? 20 : (c.value ?? 0);
    nonWild.sort((a, b) => score(b) - score(a));
    return nonWild[0]!;
  }
  // Save wild4 for last resort.
  const plainWild = playable.find(c => c.kind === "wild");
  return plainWild ?? playable[0]!;
}

function botTakeTurn(g: UnoGame, now: number) {
  const seat = g.turnSeat;
  const p = g.players[seat]!;
  const choice = botPickCard(p.hand, topCard(g), g.activeColor);
  if (choice) {
    const color = choice.kind === "wild" || choice.kind === "wild4" ? pickBotColor(p.hand) : undefined;
    applyPlay(g, seat, choice.id, color, now);
    return;
  }
  // Draw one, play it if possible.
  reshuffleIfNeeded(g);
  const card = g.drawPile.pop();
  if (!card) {
    advance(g, 1, now);
    g.seq++;
    return;
  }
  p.hand.push(card);
  if (p.hand.length > 1) p.saidUno = false;
  pushLog(g, `🃏 سحب ${p.name}`);
  if (isPlayableFromHand(card, topCard(g), g.activeColor, p.hand)) {
    const color = card.kind === "wild" || card.kind === "wild4" ? pickBotColor(p.hand) : undefined;
    applyPlay(g, seat, card.id, color, now);
  } else {
    advance(g, 1, now);
    g.seq++;
  }
}

/** Auto-move on behalf of a human whose turn timer expired (disconnect guard). */
function autoMoveHuman(g: UnoGame, now: number) {
  const seat = g.turnSeat;
  const p = g.players[seat]!;
  const choice = botPickCard(p.hand, topCard(g), g.activeColor);
  if (choice) {
    const color = choice.kind === "wild" || choice.kind === "wild4" ? pickBotColor(p.hand) : undefined;
    applyPlay(g, seat, choice.id, color, now);
  } else {
    applyDraw(g, seat, now);
    if (g.drawnThisTurn) applyPass(g, seat, now);
  }
}

/**
 * Lazy advancement, called at the top of every UNO request handler. Starts the
 * game when the lobby countdown ends (or it's full) and plays out any bot turns
 * (or times-out an absent human) that are due. Time-gated so each bot move is
 * paced ~BOT_DELAY_MS apart across polls. Returns true if state changed.
 */
export function tick(g: UnoGame, now: number = Date.now()): boolean {
  let changed = false;
  if (g.status === "waiting") {
    if (g.players.length >= g.capacity || now >= g.startsAt) {
      startGame(g, now);
      return true;
    }
    return false;
  }
  if (g.status !== "playing") return false;

  let guard = 0;
  while (g.status === "playing" && now >= g.actDeadline && guard++ < 40) {
    const p = g.players[g.turnSeat]!;
    if (p.isBot) botTakeTurn(g, now);
    else autoMoveHuman(g, now);
    changed = true;
  }
  return changed;
}

// ── redaction (what one viewer is allowed to see) ──────────────────────────
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
  /** ms remaining before the current player is auto-advanced (0 when not playing). */
  actDeadlineMs: number;
  /** Total length of the current turn timer (10s human, ~3s bot). */
  turnTotalMs: number;
  players: Array<{
    seat: number;
    name: string;
    avatar?: string;
    isBot: boolean;
    team: 0 | 1;
    handCount: number;
    saidUno: boolean;
    isYou: boolean;
  }>;
  winnerSeat: number | null;
  winnerTeam: 0 | 1 | null;
  youWon: boolean;
  log: string[];
}

export function redact(g: UnoGame, userId: string, now: number = Date.now()): UnoView {
  const me = g.players.find(p => p.userId === userId) ?? null;
  const yourSeat = me ? me.seat : null;
  const top = topCard(g);
  const isYourTurn = me != null && g.status === "playing" && g.turnSeat === me.seat;
  const yourHand = me ? me.hand : [];
  const playableCardIds =
    isYourTurn && !g.drawnThisTurn
      ? yourHand.filter(c => isPlayableFromHand(c, top, g.activeColor, yourHand)).map(c => c.id)
      : isYourTurn && g.drawnThisTurn && g.drawnCardId
        ? [g.drawnCardId]
        : [];
  return {
    id: g.id,
    mode: g.mode,
    status: g.status,
    capacity: g.capacity,
    isPublic: g.isPublic,
    hostUserId: g.hostUserId,
    countdownMs: g.status === "waiting" ? Math.max(0, g.startsAt - now) : 0,
    seq: g.seq,
    yourSeat,
    yourTeam: me ? me.team : null,
    isYourTurn,
    yourHand,
    playableCardIds,
    drawnCardId: isYourTurn ? g.drawnCardId : null,
    canPass: isYourTurn && g.drawnThisTurn,
    topCard: top,
    activeColor: g.activeColor,
    drawCount: g.drawPile.length,
    turnSeat: g.turnSeat,
    dir: g.dir,
    actDeadlineMs: g.status === "playing" ? Math.max(0, g.actDeadline - now) : 0,
    turnTotalMs:
      g.status === "playing"
        ? (g.players[g.turnSeat]?.isBot ? BOT_DELAY_MS : HUMAN_TIMEOUT_MS)
        : 0,
    players: g.players.map(p => ({
      seat: p.seat,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      team: p.team,
      handCount: p.hand.length,
      saidUno: p.saidUno,
      isYou: me != null && p.seat === me.seat,
    })),
    winnerSeat: g.winnerSeat,
    winnerTeam: g.winnerTeam,
    youWon: me != null && g.status === "finished" && g.winnerTeam === me.team,
    log: g.log.slice(-MAX_LOG),
  };
}

/** Remove a user from a waiting game, or convert them to a bot mid-game. */
export function leaveGame(g: UnoGame, userId: string): { deleted: boolean } {
  const idx = g.players.findIndex(p => p.userId === userId);
  if (idx < 0) return { deleted: false };
  if (g.status === "waiting") {
    g.players.splice(idx, 1);
    g.players.forEach((p, i) => (p.seat = i));
    g.invites = g.invites.filter(iv => iv.toUserId !== userId);
    if (g.players.length === 0) return { deleted: true };
    if (g.hostUserId === userId && g.players[0]?.userId) g.hostUserId = g.players[0].userId;
    return { deleted: false };
  }
  if (g.status === "finished") return { deleted: false };
  // Mid-game: leaving is a forfeit — the leaver (and their team) loses, the
  // opposing side is declared the winner and the match ends immediately.
  const leaver = g.players[idx]!;
  leaver.connected = false;
  const winningTeam = (leaver.team === 0 ? 1 : 0) as 0 | 1;
  const winner = g.players.find(p => p.team === winningTeam) ?? null;
  g.status = "finished";
  g.winnerTeam = winningTeam;
  g.winnerSeat = winner ? winner.seat : null;
  g.actDeadline = Number.MAX_SAFE_INTEGER;
  pushLog(g, `🚪 انسحب ${leaver.name} وخسر المباراة`);
  g.seq++;
  return { deleted: false };
}

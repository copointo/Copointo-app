export interface Cafe {
  id: string;
  name: string;
  logo: string;
  rating: number;
  distance: string;
  isOpen: boolean;
  category: string;
  address: string;
  image: any;
  reviewCount: number;
  tags: string[];
  lat?: number;
  lng?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: "hot" | "cold" | "dessert";
  description: string;
  image?: any;
  cafeId: string;
  isPopular?: boolean;
}

export interface VideoPost {
  id: string;
  username: string;
  userAvatar?: string;
  cafeName: string;
  cafeId: string;
  description: string;
  likes: number;
  comments: number;
  views: number;
  thumbnailColor: string;
  duration: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  preview: string;
  timestamp: string;
  unread: number;
  type: "user" | "cafe" | "group";
}

export interface ChatMessage {
  id: string;
  text: string;
  fromMe: boolean;
  time: string;       // e.g. "10:32 ص"
  seen: boolean;      // true → ✓✓ blue, false → ✓ grey
  /** For group messages: who sent it (display purposes). */
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  /** When set, this message is a sent gift; renders a gift bubble + plays animation. */
  giftId?: string;
  giftQty?: number;
  /** Recipient's display name (gameUsername) — passed to server so the
   *  global gift-feed ticker shows real usernames even when the recipient
   *  isn't yet mirrored into the server's users[] roster. */
  recipientName?: string;
}

/** A user-created chat group. Stored per-user and mirrored to members. */
export interface Group {
  id: string;
  name: string;
  /** Optional avatar — image URI (data: or http) or a single emoji. */
  avatar?: string;
  /** All member user IDs, including the creator. */
  members: string[];
  createdBy: string;
  createdAt: number;
  /** When set, this group is auto-managed by a community. Members are
   *  added/removed in lock-step with the community's membership and the
   *  conversation displays each sender's role (leader/vice/senior/member). */
  communityId?: string;
}

/** Member roles inside a community. */
export type CommunityRole = "leader" | "vice" | "senior" | "member";

/** Arabic labels for roles (UI). */
export const COMMUNITY_ROLE_LABEL_AR: Record<CommunityRole, string> = {
  leader: "قائد",
  vice:   "قائد مساعد",
  senior: "عضو كبير",
  member: "عضو",
};
export const COMMUNITY_ROLE_LABEL_EN: Record<CommunityRole, string> = {
  leader: "Leader",
  vice:   "Vice Leader",
  senior: "Senior Member",
  member: "Member",
};

/** A game community / clan. 2-50 members. Score is the sum of members' totalOrders. */
export interface Community {
  id: string;
  name: string;
  /** Optional avatar — image URI (data: or http) or a single emoji. */
  avatar?: string;
  /** Confirmed member user IDs (includes the creator). 2 ≤ length ≤ 50. */
  members: string[];
  createdBy: string;
  createdAt: number;
  /** Per-member role. If absent for some user, fallback rule:
   *  createdBy → "leader", everyone else → "member". */
  roles?: Record<string, CommunityRole>;
}

export const COMMUNITY_MIN_MEMBERS = 2;
export const COMMUNITY_MAX_MEMBERS = 50;

/** Resolve a member's role with backward-compatible fallback. */
export function getCommunityRole(c: Community, userId: string): CommunityRole {
  if (c.roles && c.roles[userId]) return c.roles[userId];
  return userId === c.createdBy ? "leader" : "member";
}

/** A pending invitation for a user to join a community. */
export interface CommunityInvite {
  communityId: string;
  communityName: string;
  communityAvatar?: string;
  fromUserId: string;
  fromUserName: string;
  invitedAt: number;
}

export const CAFES: Cafe[] = [
  {
    id: "cafe_1",
    name: "Roastery of Muscat",
    logo: "☕",
    rating: 4.8,
    distance: "0.3 km",
    isOpen: true,
    category: "Specialty Coffee",
    address: "Al Khuwair, Muscat",
    image: require("../assets/images/cafe1.png"),
    reviewCount: 342,
    tags: ["Specialty", "Pour Over", "Quiet"],
  },
  {
    id: "cafe_2",
    name: "Brew & Beyond",
    logo: "🍵",
    rating: 4.6,
    distance: "0.8 km",
    isOpen: true,
    category: "Cafe & Bistro",
    address: "Qurum, Muscat",
    image: require("../assets/images/cafe2.png"),
    reviewCount: 218,
    tags: ["Cozy", "Work-friendly", "Pastries"],
  },
  {
    id: "cafe_3",
    name: "Desert Bloom Coffee",
    logo: "🌺",
    rating: 4.5,
    distance: "1.2 km",
    isOpen: false,
    category: "Artisan Coffee",
    address: "Madinat Sultan Qaboos",
    image: require("../assets/images/cafe3.png"),
    reviewCount: 189,
    tags: ["Artisan", "Local", "Dates"],
  },
  {
    id: "cafe_4",
    name: "The Coffee Vault",
    logo: "🔐",
    rating: 4.7,
    distance: "1.5 km",
    isOpen: true,
    category: "Specialty Coffee",
    address: "Al Mouj, Muscat",
    image: require("../assets/images/cafe1.png"),
    reviewCount: 156,
    tags: ["Premium", "Beans", "Training"],
  },
  {
    id: "cafe_5",
    name: "Karak & Co.",
    logo: "🫖",
    rating: 4.4,
    distance: "2.1 km",
    isOpen: true,
    category: "Traditional",
    address: "Ruwi, Muscat",
    image: require("../assets/images/cafe2.png"),
    reviewCount: 423,
    tags: ["Karak", "Traditional", "Cheap"],
  },
  {
    id: "cafe_6",
    name: "Altitude Cafe",
    logo: "⛰️",
    rating: 4.9,
    distance: "2.8 km",
    isOpen: true,
    category: "Specialty Coffee",
    address: "Al Ghubra, Muscat",
    image: require("../assets/images/cafe3.png"),
    reviewCount: 89,
    tags: ["New", "Trending", "Cold Brew"],
  },
];

export const PRODUCTS: Product[] = [];

export const VIDEOS: VideoPost[] = [
  {
    id: "v1",
    username: "coffee_lover_oman",
    cafeName: "Roastery of Muscat",
    cafeId: "cafe_1",
    description: "The most perfect latte art I've ever seen ☕ #CopointoOman #Coffee",
    likes: 12400,
    comments: 342,
    views: 89000,
    thumbnailColor: "#4A2C1A",
    duration: "0:32",
  },
  {
    id: "v2",
    username: "muscat_vibes",
    cafeName: "Brew & Beyond",
    cafeId: "cafe_2",
    description: "Morning routine at my favorite spot 🌅 #MusCat #MorningCoffee",
    likes: 8700,
    comments: 189,
    views: 45000,
    thumbnailColor: "#2D4A3E",
    duration: "0:45",
  },
  {
    id: "v3",
    username: "desert_bloom_fan",
    cafeName: "Desert Bloom Coffee",
    cafeId: "cafe_3",
    description: "Cold brew making process — so satisfying 🤎 #ColdBrew #CoffeeProcess",
    likes: 23100,
    comments: 567,
    views: 156000,
    thumbnailColor: "#3D2B1F",
    duration: "1:12",
  },
  {
    id: "v4",
    username: "ahmed_coffee",
    cafeName: "The Coffee Vault",
    cafeId: "cafe_4",
    description: "Level 500 unlocked! Got my FREE coffee 🏆 #CopointoGame #FreeKarak",
    likes: 45600,
    comments: 1230,
    views: 234000,
    thumbnailColor: "#1A3A4A",
    duration: "0:28",
  },
  {
    id: "v5",
    username: "karak.queen",
    cafeName: "Karak & Co.",
    cafeId: "cafe_5",
    description: "Traditional karak tea review — grandma would be proud 🫖",
    likes: 6800,
    comments: 234,
    views: 34000,
    thumbnailColor: "#4A3818",
    duration: "0:55",
  },
];

export const MESSAGES: Message[] = [];

export const CHAT_HISTORY: Record<string, ChatMessage[]> = {};

export const RANKS = [
  { min: 0, max: 100, name: "مبتدئ كوفي", nameEn: "Coffee Beginner", color: "#8B7355", icon: "☕" },
  { min: 101, max: 200, name: "هاوي كوفي", nameEn: "Coffee Enthusiast", color: "#A0522D", icon: "🫖" },
  { min: 201, max: 300, name: "محترف كوفي", nameEn: "Coffee Pro", color: "#C47B2B", icon: "⭐" },
  { min: 301, max: 400, name: "كبير كوفي", nameEn: "Coffee Expert", color: "#DAA520", icon: "🏅" },
  { min: 401, max: 500, name: "عالمي كوفي", nameEn: "Coffee Global", color: "#B8860B", icon: "🌍" },
  { min: 501, max: 600, name: "مجنون كوفي", nameEn: "Coffee Fanatic", color: "#FF6B35", icon: "🔥" },
  { min: 601, max: 700, name: "مخضرم كوفي", nameEn: "Coffee Veteran", color: "#8B0000", icon: "💎" },
  { min: 701, max: 800, name: "عمدة الكوفي", nameEn: "Coffee Mayor", color: "#4B0082", icon: "👑" },
  { min: 801, max: 900, name: "ملك الكوفي", nameEn: "Coffee King", color: "#C0392B", icon: "🏆" },
  { min: 901, max: 1000, name: "نخبة الكوفي", nameEn: "Coffee Elite", color: "#1A0E08", icon: "⚡" },
];

export function getRank(level: number) {
  return RANKS.find((r) => level >= r.min && level <= r.max) || RANKS[0];
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

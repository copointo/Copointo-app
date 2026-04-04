// ──────────────────────────────────────────────
// In-memory store (survives restarts via module cache)
// ──────────────────────────────────────────────
export interface Cafe {
  id: string;
  name: string;
  ownerPhone: string;
  logo: string;          // URL or base64
  openTime: string;      // "07:00"
  closeTime: string;     // "23:00"
  managerPassword: string;
  active: boolean;
  subscriptionPaid: boolean;
  subscriptionAmount: number; // 300 OMR
  createdAt: string;
  // Display extras
  rating: number;
  tags: string[];
  address: string;
  image: string;
}

export interface AppUser {
  id: string;
  username: string;
  phone: string;
  level: number;
  totalOrders: number;
  banned: boolean;
  joinedAt: string;
}

// ── Seed Cafes ────────────────────────────────
const seed: Cafe[] = [
  {
    id: "1", name: "Artisano Coffee", ownerPhone: "92012345",
    logo: "https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=200&q=80",
    openTime: "07:00", closeTime: "23:00", managerPassword: "pass123",
    active: true, subscriptionPaid: true, subscriptionAmount: 300,
    createdAt: "2025-01-10T08:00:00Z",
    rating: 4.8, tags: ["قهوة مختصة", "كيك", "تدليل"], address: "مسقط، شارع الروي",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80",
  },
  {
    id: "2", name: "Roast & Co.", ownerPhone: "93456789",
    logo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=80",
    openTime: "08:00", closeTime: "22:00", managerPassword: "roast456",
    active: true, subscriptionPaid: true, subscriptionAmount: 300,
    createdAt: "2025-02-05T08:00:00Z",
    rating: 4.6, tags: ["كابتشينو", "كيك", "هادئ"], address: "الخوير، طريق السلطان",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
  },
  {
    id: "3", name: "Oman Brew", ownerPhone: "99123456",
    logo: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=80",
    openTime: "06:00", closeTime: "00:00", managerPassword: "brew789",
    active: true, subscriptionPaid: true, subscriptionAmount: 300,
    createdAt: "2025-03-15T08:00:00Z",
    rating: 4.9, tags: ["إسبريسو", "شاي عُماني", "عائلي"], address: "صلالة، شارع الحمدانية",
    image: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80",
  },
];

// ── Seed Users ────────────────────────────────
const seedUsers: AppUser[] = [
  { id: "u1", username: "ahmed_oman", phone: "91234567", level: 15, totalOrders: 42, banned: false, joinedAt: "2025-01-20T10:00:00Z" },
  { id: "u2", username: "fatima_msq", phone: "92345678", level: 8, totalOrders: 21, banned: false, joinedAt: "2025-02-10T10:00:00Z" },
  { id: "u3", username: "khalid99",   phone: "93456789", level: 32, totalOrders: 89, banned: false, joinedAt: "2025-01-05T10:00:00Z" },
  { id: "u4", username: "sara_brew",  phone: "94567890", level: 5,  totalOrders: 12, banned: false, joinedAt: "2025-03-01T10:00:00Z" },
  { id: "u5", username: "omar_cafe",  phone: "95678901", level: 22, totalOrders: 60, banned: true,  joinedAt: "2025-01-15T10:00:00Z" },
];

export const cafes: Cafe[]      = [...seed];
export const users: AppUser[]   = [...seedUsers];

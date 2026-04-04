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
  type: "user" | "cafe";
}

export interface ChatMessage {
  id: string;
  text: string;
  fromMe: boolean;
  time: string;       // e.g. "10:32 ص"
  seen: boolean;      // true → ✓✓ blue, false → ✓ grey
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

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Espresso",
    price: 1.5,
    category: "hot",
    description: "Rich, bold single shot of premium espresso",
    cafeId: "cafe_1",
    isPopular: false,
  },
  {
    id: "p2",
    name: "Cappuccino",
    price: 2.0,
    category: "hot",
    description: "Perfect balance of espresso, steamed milk & foam",
    cafeId: "cafe_1",
    isPopular: true,
  },
  {
    id: "p3",
    name: "Flat White",
    price: 2.2,
    category: "hot",
    description: "Velvety microfoam over double ristretto",
    cafeId: "cafe_1",
    isPopular: true,
  },
  {
    id: "p4",
    name: "Cortado",
    price: 1.8,
    category: "hot",
    description: "Equal parts espresso and warm milk",
    cafeId: "cafe_1",
  },
  {
    id: "p5",
    name: "Latte",
    price: 2.3,
    category: "hot",
    description: "Smooth espresso with lots of steamed milk",
    cafeId: "cafe_1",
  },
  {
    id: "p6",
    name: "Iced Latte",
    price: 2.5,
    category: "cold",
    description: "Chilled espresso over ice with cold milk",
    cafeId: "cafe_1",
    isPopular: true,
  },
  {
    id: "p7",
    name: "Cold Brew",
    price: 2.8,
    category: "cold",
    description: "12-hour steeped for maximum smoothness",
    cafeId: "cafe_1",
  },
  {
    id: "p8",
    name: "Iced Americano",
    price: 2.0,
    category: "cold",
    description: "Bold espresso diluted over ice",
    cafeId: "cafe_1",
  },
  {
    id: "p9",
    name: "Frappuccino",
    price: 3.5,
    category: "cold",
    description: "Blended coffee with cream and ice",
    cafeId: "cafe_1",
    isPopular: true,
  },
  {
    id: "p10",
    name: "Chocolate Croissant",
    price: 1.8,
    category: "dessert",
    description: "Flaky buttery croissant with dark chocolate",
    cafeId: "cafe_1",
  },
  {
    id: "p11",
    name: "Cheesecake",
    price: 2.5,
    category: "dessert",
    description: "Creamy New York style with berry compote",
    cafeId: "cafe_1",
    isPopular: true,
  },
  {
    id: "p12",
    name: "Date & Walnut Cake",
    price: 2.2,
    category: "dessert",
    description: "Traditional Omani dates with walnuts",
    cafeId: "cafe_1",
  },
];

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

export const MESSAGES: Message[] = [
  {
    id: "m1",
    senderId: "cafe_1",
    senderName: "Roastery of Muscat",
    preview: "Your order is ready! Please proceed to the counter.",
    timestamp: "2 min ago",
    unread: 1,
    type: "cafe",
  },
  {
    id: "m2",
    senderId: "user_2",
    senderName: "Sara Al-Zahra",
    preview: "Are you going to Altitude Cafe today?",
    timestamp: "15 min ago",
    unread: 2,
    type: "user",
  },
  {
    id: "m3",
    senderId: "cafe_4",
    senderName: "The Coffee Vault",
    preview: "Special offer: 20% off all cold brews this weekend!",
    timestamp: "1 hr ago",
    unread: 0,
    type: "cafe",
  },
  {
    id: "m4",
    senderId: "user_3",
    senderName: "Khalid Mansoor",
    preview: "Let's grab coffee at Brew & Beyond tomorrow?",
    timestamp: "3 hrs ago",
    unread: 0,
    type: "user",
  },
  {
    id: "m5",
    senderId: "user_4",
    senderName: "Fatima Al-Balushi",
    preview: "I just hit Level 300 — Coffee Expert! 🎉",
    timestamp: "Yesterday",
    unread: 0,
    type: "user",
  },
];

export const CHAT_HISTORY: Record<string, ChatMessage[]> = {
  m1: [
    { id: "1", text: "مرحباً! طلبك جاهز للاستلام من الكاونتر 🎉", fromMe: false, time: "10:30 ص", seen: true },
    { id: "2", text: "شكراً، في الطريق الآن", fromMe: true, time: "10:31 ص", seen: true },
    { id: "3", text: "طلبك جاهز! تفضل للكاونتر من فضلك.", fromMe: false, time: "10:32 ص", seen: false },
  ],
  m2: [
    { id: "1", text: "هلا! كيفك؟", fromMe: false, time: "9:00 ص", seen: true },
    { id: "2", text: "تمام الحمدلله، وأنتِ؟", fromMe: true, time: "9:02 ص", seen: true },
    { id: "3", text: "تمام 😊 هل ستذهب لـ Altitude Cafe اليوم؟", fromMe: false, time: "9:10 ص", seen: true },
    { id: "4", text: "أفكر في ذلك، ليش؟", fromMe: true, time: "9:12 ص", seen: true },
    { id: "5", text: "فيه عرض على القهوة الباردة اليوم فقط!", fromMe: false, time: "9:13 ص", seen: true },
    { id: "6", text: "Are you going to Altitude Cafe today?", fromMe: false, time: "9:15 ص", seen: false },
  ],
  m3: [
    { id: "1", text: "عرض خاص: خصم 20% على كل القهوة الباردة هذا الأسبوع! ☕", fromMe: false, time: "أمس", seen: true },
    { id: "2", text: "رائع! سأزوركم قريباً", fromMe: true, time: "أمس", seen: true },
  ],
  m4: [
    { id: "1", text: "السلام عليكم!", fromMe: false, time: "8:00 ص", seen: true },
    { id: "2", text: "وعليكم السلام", fromMe: true, time: "8:01 ص", seen: true },
    { id: "3", text: "نتقهوى في Brew & Beyond بكرة؟", fromMe: false, time: "8:05 ص", seen: true },
    { id: "4", text: "Let's grab coffee at Brew & Beyond tomorrow?", fromMe: false, time: "8:06 ص", seen: false },
  ],
  m5: [
    { id: "1", text: "وصلت المستوى 300 — Coffee Expert! 🎉", fromMe: false, time: "أمس", seen: true },
    { id: "2", text: "مبروك! 🎊", fromMe: true, time: "أمس", seen: true },
    { id: "3", text: "شكراً يا صاحبي 😄", fromMe: false, time: "أمس", seen: true },
  ],
};

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

export interface Cafe {
  id: string; name: string; ownerPhone: string; logo: string;
  openTime: string; closeTime: string; managerPassword: string;
  active: boolean; subscriptionPaid: boolean; subscriptionAmount: number;
  createdAt: string; rating: number; tags: string[]; address: string; image: string;
}
export interface AppUser {
  id: string; username: string; phone: string; level: number;
  totalOrders: number; banned: boolean; joinedAt: string;
}
export interface MenuItem {
  id: string; cafeId: string; name: string; price: number;
  category: string; description: string; available: boolean; createdAt: string;
}
export interface CafeTable {
  id: string; cafeId: string; number: number; capacity: number;
  available: boolean; createdAt: string;
}
export interface Order {
  id: string; cafeId: string; customerName: string; customerPhone: string;
  items: { name: string; qty: number; price: number }[];
  total: number; status: "pending" | "preparing" | "ready" | "done";
  type: "dine" | "car"; tableNumber?: string; plateNumber?: string;
  createdAt: string;
}
export interface TableBooking {
  id: string; cafeId: string; customerName: string; customerPhone: string;
  tableId: string; tableNumber: number; date: string; time: string;
  guests: number; status: "pending" | "confirmed" | "cancelled"; createdAt: string;
}
export interface ChatInfo {
  id: string; cafeId: string; topic: string; content: string; createdAt: string;
}
export interface Invoice {
  id: string; cafeId: string; orderId: string; customerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number; type: "order" | "booking"; createdAt: string;
}

// ── Seed ─────────────────────────────────────────────────────
const seed: Cafe[] = [
  { id:"1", name:"Artisano Coffee", ownerPhone:"92012345",
    logo:"https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=200&q=80",
    openTime:"07:00", closeTime:"23:00", managerPassword:"pass123",
    active:true, subscriptionPaid:true, subscriptionAmount:300,
    createdAt:"2025-01-10T08:00:00Z", rating:4.8,
    tags:["قهوة مختصة","كيك","تدليل"], address:"مسقط، شارع الروي",
    image:"https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80" },
  { id:"2", name:"Roast & Co.", ownerPhone:"93456789",
    logo:"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=200&q=80",
    openTime:"08:00", closeTime:"22:00", managerPassword:"roast456",
    active:true, subscriptionPaid:true, subscriptionAmount:300,
    createdAt:"2025-02-05T08:00:00Z", rating:4.6,
    tags:["كابتشينو","كيك","هادئ"], address:"الخوير، طريق السلطان",
    image:"https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80" },
  { id:"3", name:"Oman Brew", ownerPhone:"99123456",
    logo:"https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200&q=80",
    openTime:"06:00", closeTime:"00:00", managerPassword:"brew789",
    active:true, subscriptionPaid:true, subscriptionAmount:300,
    createdAt:"2025-03-15T08:00:00Z", rating:4.9,
    tags:["إسبريسو","شاي عُماني","عائلي"], address:"صلالة، شارع الحمدانية",
    image:"https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80" },
];

const seedUsers: AppUser[] = [
  { id:"u1", username:"ahmed_oman",  phone:"91234567", level:15, totalOrders:42, banned:false, joinedAt:"2025-01-20T10:00:00Z" },
  { id:"u2", username:"fatima_msq", phone:"92345678", level:8,  totalOrders:21, banned:false, joinedAt:"2025-02-10T10:00:00Z" },
  { id:"u3", username:"khalid99",   phone:"93456789", level:32, totalOrders:89, banned:false, joinedAt:"2025-01-05T10:00:00Z" },
  { id:"u4", username:"sara_brew",  phone:"94567890", level:5,  totalOrders:12, banned:false, joinedAt:"2025-03-01T10:00:00Z" },
  { id:"u5", username:"omar_cafe",  phone:"95678901", level:22, totalOrders:60, banned:true,  joinedAt:"2025-01-15T10:00:00Z" },
];

// Seed menu items
const seedMenu: MenuItem[] = [
  { id:"m1", cafeId:"1", name:"إسبريسو مزدوج", price:1.200, category:"قهوة", description:"إسبريسو قوي بنكهة عميقة", available:true, createdAt:"2025-01-10T08:00:00Z" },
  { id:"m2", cafeId:"1", name:"كابتشينو", price:1.500, category:"قهوة", description:"كابتشينو ناعم مع رغوة الحليب", available:true, createdAt:"2025-01-10T08:00:00Z" },
  { id:"m3", cafeId:"1", name:"كيك الشوكولاتة", price:2.000, category:"حلى", description:"كيك شوكولاتة بلجيكية", available:true, createdAt:"2025-01-10T08:00:00Z" },
  { id:"m4", cafeId:"2", name:"لاتيه", price:1.800, category:"قهوة", description:"لاتيه كريمي بالحليب المبخر", available:true, createdAt:"2025-02-05T08:00:00Z" },
  { id:"m5", cafeId:"2", name:"موكا", price:2.000, category:"قهوة", description:"قهوة شوكولاتة لذيذة", available:true, createdAt:"2025-02-05T08:00:00Z" },
  { id:"m6", cafeId:"3", name:"قهوة عُمانية", price:1.000, category:"قهوة", description:"قهوة عربية بالهيل والزعفران", available:true, createdAt:"2025-03-15T08:00:00Z" },
];

// Seed tables
const seedTables: CafeTable[] = [
  { id:"t1", cafeId:"1", number:1, capacity:2, available:true, createdAt:"2025-01-10T08:00:00Z" },
  { id:"t2", cafeId:"1", number:2, capacity:4, available:true, createdAt:"2025-01-10T08:00:00Z" },
  { id:"t3", cafeId:"2", number:1, capacity:2, available:true, createdAt:"2025-02-05T08:00:00Z" },
  { id:"t4", cafeId:"3", number:1, capacity:6, available:true, createdAt:"2025-03-15T08:00:00Z" },
];

// Seed orders
const seedOrders: Order[] = [
  { id:"o1", cafeId:"1", customerName:"أحمد العماني", customerPhone:"91234567",
    items:[{name:"إسبريسو مزدوج",qty:2,price:1.200},{name:"كيك الشوكولاتة",qty:1,price:2.000}],
    total:4.400, status:"done", type:"dine", tableNumber:"2", createdAt:"2025-04-01T10:30:00Z" },
  { id:"o2", cafeId:"1", customerName:"فاطمة المسقطية", customerPhone:"92345678",
    items:[{name:"كابتشينو",qty:1,price:1.500}],
    total:1.500, status:"ready", type:"car", plateNumber:"12345 ب ق", createdAt:"2025-04-02T09:15:00Z" },
  { id:"o3", cafeId:"2", customerName:"خالد التميمي", customerPhone:"93456789",
    items:[{name:"لاتيه",qty:2,price:1.800},{name:"موكا",qty:1,price:2.000}],
    total:5.600, status:"preparing", type:"dine", tableNumber:"1", createdAt:"2025-04-03T11:00:00Z" },
];

// Seed bookings
const seedBookings: TableBooking[] = [
  { id:"b1", cafeId:"1", customerName:"سارة الكافية", customerPhone:"94567890",
    tableId:"t1", tableNumber:1, date:"2025-04-05", time:"19:00", guests:2,
    status:"confirmed", createdAt:"2025-04-01T08:00:00Z" },
  { id:"b2", cafeId:"2", customerName:"عمر المختار", customerPhone:"95678901",
    tableId:"t3", tableNumber:1, date:"2025-04-06", time:"20:00", guests:3,
    status:"pending", createdAt:"2025-04-02T09:00:00Z" },
];

// Seed chat info
const seedChatInfo: ChatInfo[] = [
  { id:"c1", cafeId:"1", topic:"ساعات العمل", content:"نعمل من الساعة 7 صباحاً حتى 11 مساءً يومياً بما فيها الجمعة والسبت", createdAt:"2025-01-10T08:00:00Z" },
  { id:"c2", cafeId:"1", topic:"العروض الخاصة", content:"كل اثنين خصم 20% على جميع مشروبات القهوة الباردة", createdAt:"2025-01-10T08:00:00Z" },
  { id:"c3", cafeId:"2", topic:"الواي فاي", content:"كلمة مرور الواي فاي: RoastCo2025", createdAt:"2025-02-05T08:00:00Z" },
];

// Seed invoices
const seedInvoices: Invoice[] = [
  { id:"inv1", cafeId:"1", orderId:"o1", customerName:"أحمد العماني",
    items:[{name:"إسبريسو مزدوج",qty:2,price:1.200},{name:"كيك الشوكولاتة",qty:1,price:2.000}],
    total:4.400, type:"order", createdAt:"2025-04-01T10:30:00Z" },
  { id:"inv2", cafeId:"1", orderId:"o2", customerName:"فاطمة المسقطية",
    items:[{name:"كابتشينو",qty:1,price:1.500}],
    total:1.500, type:"order", createdAt:"2025-04-02T09:15:00Z" },
];

export const cafes:    Cafe[]         = [...seed];
export const users:    AppUser[]      = [...seedUsers];
export const menuItems: MenuItem[]    = [...seedMenu];
export const tables:   CafeTable[]    = [...seedTables];
export const orders:   Order[]        = [...seedOrders];
export const bookings: TableBooking[] = [...seedBookings];
export const chatInfos: ChatInfo[]    = [...seedChatInfo];
export const invoices: Invoice[]      = [...seedInvoices];

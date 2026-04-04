import { Router } from "express";
import { cafes, menuItems, tables, orders, bookings, chatInfos, invoices,
  type MenuItem, type CafeTable, type Order, type TableBooking, type ChatInfo, type Invoice } from "../store";

const router = Router({ mergeParams: true });

function cafeMiddleware(req: any, res: any, next: any) {
  const cafe = cafes.find(c => c.id === req.params.cafeId);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });
  req.cafe = cafe;
  next();
}
router.use(cafeMiddleware);

// ── Stats ─────────────────────────────────────────────────────
router.get("/stats", (req: any, res) => {
  const id   = req.params.cafeId;
  const cafeOrders   = orders.filter(o => o.cafeId === id);
  const cafeBookings = bookings.filter(b => b.cafeId === id);
  const cafeMenu     = menuItems.filter(m => m.cafeId === id);
  const cafeInv      = invoices.filter(i => i.cafeId === id);
  const totalRevenue = cafeInv.reduce((s, i) => s + i.total, 0);
  const byDay: Record<string, number> = {};
  cafeOrders.forEach(o => {
    const day = o.createdAt.substring(0, 10);
    byDay[day] = (byDay[day] || 0) + o.total;
  });
  const chartData = Object.entries(byDay).map(([date, revenue]) => ({ date, revenue })).slice(-7);
  res.json({
    totalOrders: cafeOrders.length, totalBookings: cafeBookings.length,
    totalMenuItems: cafeMenu.length, totalRevenue: +totalRevenue.toFixed(3),
    pendingOrders: cafeOrders.filter(o => o.status === "pending").length,
    confirmedBookings: cafeBookings.filter(b => b.status === "confirmed").length,
    chartData,
    topItems: cafeOrders.flatMap(o => o.items)
      .reduce((acc: Record<string, number>, item) => { acc[item.name] = (acc[item.name] || 0) + item.qty; return acc; }, {}),
  });
});

// ── Orders ────────────────────────────────────────────────────
router.get("/orders", (req: any, res) => {
  res.json({ orders: orders.filter(o => o.cafeId === req.params.cafeId) });
});
router.post("/orders", (req: any, res) => {
  const o: Order = { id: Date.now().toString(), cafeId: req.params.cafeId, status: "pending", createdAt: new Date().toISOString(), ...req.body };
  orders.push(o);
  // auto-create invoice
  const inv: Invoice = { id: `inv-${Date.now()}`, cafeId: o.cafeId, orderId: o.id, customerName: o.customerName, items: o.items, total: o.total, type: "order", createdAt: o.createdAt };
  invoices.push(inv);
  res.status(201).json({ order: o });
});
router.patch("/orders/:orderId/status", (req, res) => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  order.status = req.body.status;
  res.json({ order });
});

// ── Bookings ──────────────────────────────────────────────────
router.get("/bookings", (req: any, res) => {
  res.json({ bookings: bookings.filter(b => b.cafeId === req.params.cafeId) });
});
router.post("/bookings", (req: any, res) => {
  const b: TableBooking = { id: Date.now().toString(), cafeId: req.params.cafeId, status: "pending", createdAt: new Date().toISOString(), ...req.body };
  bookings.push(b);
  res.status(201).json({ booking: b });
});
router.patch("/bookings/:bookingId/status", (req, res) => {
  const booking = bookings.find(b => b.id === req.params.bookingId);
  if (!booking) return res.status(404).json({ error: "Not found" });
  booking.status = req.body.status;
  res.json({ booking });
});

// ── Menu ──────────────────────────────────────────────────────
router.get("/menu", (req: any, res) => {
  res.json({ items: menuItems.filter(m => m.cafeId === req.params.cafeId) });
});
router.post("/menu", (req: any, res) => {
  const item: MenuItem = { id: Date.now().toString(), cafeId: req.params.cafeId, available: true, createdAt: new Date().toISOString(), ...req.body };
  menuItems.push(item);
  res.status(201).json({ item });
});
router.patch("/menu/:itemId", (req, res) => {
  const item = menuItems.find(m => m.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: "Not found" });
  Object.assign(item, req.body);
  res.json({ item });
});
router.delete("/menu/:itemId", (req, res) => {
  const idx = menuItems.findIndex(m => m.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  menuItems.splice(idx, 1);
  res.json({ success: true });
});

// ── Tables ────────────────────────────────────────────────────
router.get("/tables", (req: any, res) => {
  res.json({ tables: tables.filter(t => t.cafeId === req.params.cafeId) });
});
router.post("/tables", (req: any, res) => {
  const t: CafeTable = { id: Date.now().toString(), cafeId: req.params.cafeId, available: true, createdAt: new Date().toISOString(), ...req.body };
  tables.push(t);
  res.status(201).json({ table: t });
});
router.delete("/tables/:tableId", (req, res) => {
  const idx = tables.findIndex(t => t.id === req.params.tableId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  tables.splice(idx, 1);
  res.json({ success: true });
});

// ── Chat Info ─────────────────────────────────────────────────
router.get("/chat", (req: any, res) => {
  res.json({ items: chatInfos.filter(c => c.cafeId === req.params.cafeId) });
});
router.post("/chat", (req: any, res) => {
  const item: ChatInfo = { id: Date.now().toString(), cafeId: req.params.cafeId, createdAt: new Date().toISOString(), ...req.body };
  chatInfos.push(item);
  res.status(201).json({ item });
});
router.delete("/chat/:itemId", (req, res) => {
  const idx = chatInfos.findIndex(c => c.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  chatInfos.splice(idx, 1);
  res.json({ success: true });
});

// ── Invoices ──────────────────────────────────────────────────
router.get("/invoices", (req: any, res) => {
  res.json({ invoices: invoices.filter(i => i.cafeId === req.params.cafeId) });
});

export default router;

import { Router } from "express";
import { cafes, users, menuItems, tables, orders, bookings, chatInfos, invoices, cafeViews, discountCodes,
  expenses, invoiceTemplates, freeCoffees, inventoryItems,
  type MenuItem, type CafeTable, type Order, type TableBooking, type ChatInfo, type Invoice, type CafeView, type DiscountCode,
  type Expense, type InvoiceTemplate, type InvoiceType, type FreeCoffee, type InventoryItem } from "../store";

// ── Free-coffee code helpers ─────────────────────────────────
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
function generateUniqueCode(): string {
  for (let attempt = 0; attempt < 25; attempt++) {
    let c = "";
    for (let i = 0; i < 6; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!freeCoffees.some(f => f.code === c)) return c;
  }
  return `FC${Date.now().toString(36).toUpperCase()}`;
}
/** Issues one FreeCoffee per multiple-of-7 milestone the user has crossed but not yet been awarded for. */
function awardMilestoneCoffees(userPhone: string, userName: string, totalOrders: number) {
  const milestonesEarned = Math.floor(totalOrders / 7);
  const alreadyAwarded   = freeCoffees.filter(f => f.userPhone === userPhone).length;
  for (let i = alreadyAwarded; i < milestonesEarned; i++) {
    freeCoffees.push({
      id:               Date.now().toString() + "-" + i,
      code:             generateUniqueCode(),
      userPhone,
      userName,
      earnedAtLevel:    (i + 1) * 7,
      earnedAt:         new Date().toISOString(),
      redeemedAt:       null,
      redeemedAtCafeId: null,
      redeemedOrderId:  null,
    });
  }
}

const VALID_INVOICE_TYPES: InvoiceType[] = ["order", "expense", "daily", "monthly", "yearly"];

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
router.post("/orders", (req: any, res): any => {
  const body = req.body ?? {};
  const cafeId = req.params.cafeId;
  // Optional discount code: validate, apply, increment usage.
  let discountPercent: number | undefined;
  let discountCode: string | undefined;
  let discountAmount: number | undefined;
  let subtotal: number = Number(body.total) || 0;
  let total = subtotal;
  if (body.discountCode) {
    const code = String(body.discountCode).trim();
    const dc = discountCodes.find(d =>
      d.cafeId === cafeId && d.code === code && d.active &&
      (!d.expiresAt || new Date(d.expiresAt).getTime() > Date.now())
    );
    if (!dc) {
      return res.status(400).json({ error: "كود التخفيض غير صالح أو منتهي" });
    }
    discountCode = dc.code;
    discountPercent = dc.percent;
    discountAmount = +(subtotal * dc.percent / 100).toFixed(3);
    total = +(subtotal - discountAmount).toFixed(3);
    dc.usedCount++;
  }
  const o: Order = {
    id: Date.now().toString(),
    cafeId,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...body,
    subtotal,
    discountCode,
    discountPercent,
    discountAmount,
    total,
  };
  orders.push(o);
  // Invoice is created only when the manager confirms preparation.
  return res.status(201).json({ order: o });
});
router.get("/orders/:orderId", (req, res): any => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ order });
});
router.patch("/orders/:orderId/status", (req, res): any => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  const prevStatus = order.status;
  const next = req.body.status;
  order.status = next;
  // First time the order leaves "pending" → finalise invoice (points happen on print).
  if (prevStatus === "pending" && next !== "pending") {
    order.confirmedAt = new Date().toISOString();
    if (!invoices.some(i => i.orderId === order.id)) {
      const inv: Invoice = {
        id: `inv-${Date.now()}`,
        cafeId: order.cafeId,
        orderId: order.id,
        customerName: order.customerName,
        items: order.items,
        total: order.total,
        type: "order",
        createdAt: order.confirmedAt,
      };
      invoices.push(inv);
    }
  }
  return res.json({ order });
});

// Mark invoice printed → awards drink points to the user (idempotent) + completes order.
// Also issues a free-coffee code for every newly-crossed multiple-of-7 milestone.
router.post("/orders/:orderId/print", (req, res) => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (!order.pointsAwarded) {
    const drinks = (order.drinkCount != null)
      ? order.drinkCount
      : order.items.reduce((s, it) => s + (it.category === "حلى" ? 0 : it.qty), 0);
    if (drinks > 0) {
      const u = users.find(u => u.phone === order.customerPhone);
      if (u) {
        u.totalOrders += drinks;
        // Issue free-coffee code(s) for any milestones just crossed.
        awardMilestoneCoffees(u.phone, u.username, u.totalOrders);
      }
    }
    order.pointsAwarded = true;
    order.printedAt = new Date().toISOString();
    if (order.status !== "done") order.status = "done";
  }
  return res.json({ order });
});

// ── Free coffees ─────────────────────────────────────────────
// Validate a code (preview only — does NOT redeem). Returns owner info if valid.
router.post("/free-coffees/validate", (req: any, res) => {
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "أدخل الكود" });
  const fc = freeCoffees.find(f => f.code === code);
  if (!fc)              return res.status(404).json({ error: "الكود غير موجود" });
  if (fc.redeemedAt)    return res.status(400).json({ error: "هذا الكود تم استخدامه مسبقاً" });
  res.json({
    valid: true,
    code:           fc.code,
    userName:       fc.userName,
    userPhone:      fc.userPhone,
    earnedAtLevel:  fc.earnedAtLevel,
    earnedAt:       fc.earnedAt,
  });
});

// Redeem a code against a specific order (called when admin prints free invoice).
router.post("/free-coffees/redeem", (req: any, res) => {
  const cafeId  = req.params.cafeId;
  const code    = String(req.body?.code ?? "").trim().toUpperCase();
  const orderId = req.body?.orderId ? String(req.body.orderId) : null;
  if (!code) return res.status(400).json({ error: "أدخل الكود" });
  const fc = freeCoffees.find(f => f.code === code);
  if (!fc)             return res.status(404).json({ error: "الكود غير موجود" });
  if (fc.redeemedAt)   return res.status(400).json({ error: "هذا الكود تم استخدامه مسبقاً" });
  fc.redeemedAt        = new Date().toISOString();
  fc.redeemedAtCafeId  = cafeId;
  fc.redeemedOrderId   = orderId;
  if (orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.freeCoffeeCode  = fc.code;
      order.freeCoffeeLevel = fc.earnedAtLevel;
    }
  }
  res.json({ freeCoffee: fc });
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
router.patch("/tables/:tableId", (req, res) => {
  const t = tables.find(x => x.id === req.params.tableId);
  if (!t) return res.status(404).json({ error: "Not found" });
  Object.assign(t, req.body);
  res.json({ table: t });
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

// ── Discount codes ───────────────────────────────────────────
router.get("/discount-codes", (req: any, res) => {
  const list = discountCodes
    .filter(d => d.cafeId === req.params.cafeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ codes: list });
});
router.post("/discount-codes", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const { code, percent, expiresAt } = req.body ?? {};
  const codeStr = String(code ?? "").trim();
  const pct = Number(percent);
  if (!codeStr || !/^\d+$/.test(codeStr)) {
    return res.status(400).json({ error: "الكود يجب أن يكون أرقام فقط" });
  }
  if (![10, 20, 30, 40, 50].includes(pct)) {
    return res.status(400).json({ error: "النسبة يجب أن تكون 10 أو 20 أو 30 أو 40 أو 50" });
  }
  // expiresAt is optional. If provided it must be a valid date.
  let expiresAtIso: string | null = null;
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
    const t = new Date(expiresAt).getTime();
    if (isNaN(t)) {
      return res.status(400).json({ error: "تاريخ الانتهاء غير صالح" });
    }
    expiresAtIso = new Date(expiresAt).toISOString();
  }
  if (discountCodes.some(d => d.cafeId === cafeId && d.code === codeStr && d.active)) {
    return res.status(400).json({ error: "هذا الكود مستخدم بالفعل" });
  }
  const dc: DiscountCode = {
    id: Date.now().toString(),
    cafeId,
    code: codeStr,
    percent: pct as 10 | 20 | 30 | 40 | 50,
    expiresAt: expiresAtIso,
    active: true,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  };
  discountCodes.push(dc);
  return res.status(201).json({ code: dc });
});
router.delete("/discount-codes/:codeId", (req, res): any => {
  const idx = discountCodes.findIndex(d => d.id === req.params.codeId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  discountCodes.splice(idx, 1);
  return res.json({ success: true });
});
router.post("/discount-codes/validate", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const code = String(req.body?.code ?? "").trim();
  if (!code) return res.status(400).json({ valid: false, error: "أدخل الكود" });
  const dc = discountCodes.find(d =>
    d.cafeId === cafeId && d.code === code && d.active &&
    (!d.expiresAt || new Date(d.expiresAt).getTime() > Date.now())
  );
  if (!dc) return res.status(404).json({ valid: false, error: "كود غير صالح أو منتهي" });
  return res.json({ valid: true, percent: dc.percent, codeId: dc.id });
});

// ── Public: track a cafe-detail view ─────────────────────────
router.post("/track-view", (req: any, res) => {
  const v: CafeView = {
    id: Date.now().toString() + Math.random().toString(36).slice(2,6),
    cafeId: req.params.cafeId,
    userId: req.body?.userId,
    userPhone: req.body?.userPhone,
    source: req.body?.source,
    viewedAt: new Date().toISOString(),
  };
  cafeViews.push(v);
  res.status(201).json({ ok: true });
});

// ── Manager auth (verify password) ───────────────────────────
router.post("/auth", (req: any, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "كلمة المرور مطلوبة" });
  if (password !== req.cafe.managerPassword) return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  return res.json({ ok: true });
});

// ── Advanced manager analytics (password-protected) ──────────
router.post("/advanced-stats", (req: any, res): any => {
  const { password } = req.body || {};
  if (password !== req.cafe.managerPassword) return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
  const id = req.params.cafeId;

  const cOrders   = orders.filter(o => o.cafeId === id);
  const cBookings = bookings.filter(b => b.cafeId === id);
  const cMenu     = menuItems.filter(m => m.cafeId === id);
  const cInv      = invoices.filter(i => i.cafeId === id);
  const cViews    = cafeViews.filter(v => v.cafeId === id);

  // ── Revenue buckets ─────────────────────
  const revByDay: Record<string, number>   = {};
  const revByMonth: Record<string, number> = {};
  const revByYear: Record<string, number>  = {};
  cInv.forEach(inv => {
    const d  = inv.createdAt.substring(0,10);     // YYYY-MM-DD
    const m  = inv.createdAt.substring(0,7);      // YYYY-MM
    const y  = inv.createdAt.substring(0,4);      // YYYY
    revByDay[d]   = (revByDay[d]   || 0) + inv.total;
    revByMonth[m] = (revByMonth[m] || 0) + inv.total;
    revByYear[y]  = (revByYear[y]  || 0) + inv.total;
  });
  const dailyRevenue   = Object.entries(revByDay)  .map(([date, revenue]) => ({ date,  revenue: +revenue.toFixed(3) })).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
  const monthlyRevenue = Object.entries(revByMonth).map(([month,revenue]) => ({ month, revenue: +revenue.toFixed(3) })).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
  const yearlyRevenue  = Object.entries(revByYear) .map(([year, revenue]) => ({ year,  revenue: +revenue.toFixed(3) })).sort((a,b)=>a.year.localeCompare(b.year));

  const totalRevenue   = cInv.reduce((s,i) => s + i.total, 0);
  const todayKey       = new Date().toISOString().substring(0,10);
  const monthKey       = new Date().toISOString().substring(0,7);
  const yearKey        = new Date().toISOString().substring(0,4);
  const todayRevenue   = revByDay[todayKey]   || 0;
  const monthRevenue   = revByMonth[monthKey] || 0;
  const yearRevenue    = revByYear[yearKey]   || 0;

  // ── Order types: dine-in (داخل) vs car (خارج) ──
  const dineCount = cOrders.filter(o => o.type === "dine").length;
  const carCount  = cOrders.filter(o => o.type === "car").length;

  // ── Source: direct vs chat ──────────────
  const directCount = cOrders.filter(o => (o.source ?? "direct") === "direct").length;
  const chatCount   = cOrders.filter(o => o.source === "chat").length;

  // ── Busiest weekday ─────────────────────
  const dayNamesAr = ["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
  const byWeekday: Record<string, number> = {};
  dayNamesAr.forEach(n => byWeekday[n] = 0);
  cOrders.forEach(o => {
    const w = new Date(o.createdAt).getDay();
    byWeekday[dayNamesAr[w]]++;
  });
  const weekdayChart = dayNamesAr.map(name => ({ day: name, orders: byWeekday[name] }));
  const busiestDay   = weekdayChart.reduce((a,b) => b.orders > a.orders ? b : a, { day: "—", orders: 0 });

  // ── Top product & category ──────────────
  const productQty: Record<string, number> = {};
  const productRev: Record<string, number> = {};
  cOrders.forEach(o => o.items.forEach(it => {
    productQty[it.name] = (productQty[it.name] || 0) + it.qty;
    productRev[it.name] = (productRev[it.name] || 0) + it.qty * it.price;
  }));
  const topProducts = Object.entries(productQty)
    .map(([name, qty]) => ({ name, qty, revenue: +(productRev[name] || 0).toFixed(3) }))
    .sort((a,b) => b.qty - a.qty).slice(0, 10);

  // category lookup from menu
  const itemCategory: Record<string, string> = {};
  cMenu.forEach(m => { itemCategory[m.name] = m.category || "أخرى"; });
  const categoryQty: Record<string, number> = {};
  cOrders.forEach(o => o.items.forEach(it => {
    const cat = itemCategory[it.name] || "أخرى";
    categoryQty[cat] = (categoryQty[cat] || 0) + it.qty;
  }));
  const topCategories = Object.entries(categoryQty)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a,b) => b.qty - a.qty);

  // ── Visits & visit→order conversion ─────
  const totalViews     = cViews.length;
  const uniqueViewers  = new Set(cViews.map(v => v.userId || v.userPhone || v.id)).size;
  const orderingPhones = new Set(cOrders.map(o => o.customerPhone));
  const viewsThatOrdered = cViews.filter(v =>
    (v.userPhone && orderingPhones.has(v.userPhone))
  ).length;
  const conversionRate = totalViews > 0 ? +(viewsThatOrdered / totalViews * 100).toFixed(1) : 0;

  // ── Booking status breakdown ────────────
  const bookingPending   = cBookings.filter(b => b.status === "pending").length;
  const bookingConfirmed = cBookings.filter(b => b.status === "confirmed").length;
  const bookingCancelled = cBookings.filter(b => b.status === "cancelled").length;

  // ── Players ranking ─────────────────────
  // global Oman ranking — every user, sorted by totalOrders desc
  const globalRanked = [...users].sort((a,b) => b.totalOrders - a.totalOrders);
  const globalRank: Record<string, number> = {};
  globalRanked.forEach((u, i) => { globalRank[u.id] = i + 1; });

  // count orders per phone for this cafe
  const cafeOrdersByPhone: Record<string, number> = {};
  cOrders.forEach(o => {
    cafeOrdersByPhone[o.customerPhone] = (cafeOrdersByPhone[o.customerPhone] || 0) + 1;
  });
  const players = Object.entries(cafeOrdersByPhone).map(([phone, ordersHere]) => {
    const u = users.find(u => u.phone === phone);
    return {
      phone,
      username:    u?.username ?? phone,
      ordersHere,
      totalOrders: u?.totalOrders ?? ordersHere,
      omanRank:    u ? globalRank[u.id] : null,
      level:       u?.level ?? 1,
    };
  }).sort((a,b) => b.ordersHere - a.ordersHere);

  res.json({
    revenue: {
      total:   +totalRevenue.toFixed(3),
      today:   +todayRevenue.toFixed(3),
      month:   +monthRevenue.toFixed(3),
      year:    +yearRevenue.toFixed(3),
      daily:   dailyRevenue,
      monthly: monthlyRevenue,
      yearly:  yearlyRevenue,
    },
    orders: {
      total:    cOrders.length,
      pending:  cOrders.filter(o => o.status === "pending").length,
      preparing:cOrders.filter(o => o.status === "preparing").length,
      ready:    cOrders.filter(o => o.status === "ready").length,
      done:     cOrders.filter(o => o.status === "done").length,
      dineIn:   dineCount,
      carOut:   carCount,
      direct:   directCount,
      viaChat:  chatCount,
    },
    bookings: {
      total:     cBookings.length,
      pending:   bookingPending,
      confirmed: bookingConfirmed,
      cancelled: bookingCancelled,
    },
    visits: {
      total: totalViews,
      uniqueViewers,
      viewsThatOrdered,
      conversionRate,
    },
    weekdayChart,
    busiestDay,
    topProducts,
    topCategories,
    players,
    invoices: cInv.sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
  });
});

// ── Expenses ──────────────────────────────────────────────────
router.get("/expenses", (req: any, res) => {
  const cid = req.params.cafeId;
  const list = expenses
    .filter(e => e.cafeId === cid)
    .sort((a, b) => b.date.localeCompare(a.date));
  res.json({ expenses: list });
});

router.post("/expenses", (req: any, res): any => {
  const cid  = req.params.cafeId;
  const body = req.body ?? {};
  const title    = String(body.title ?? "").trim();
  const amount   = Number(body.amount);
  const category = String(body.category ?? "").trim();
  const notes    = body.notes ? String(body.notes).trim() : undefined;
  const date     = String(body.date ?? new Date().toISOString().slice(0, 10)).trim();
  if (!title || !category || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "title/category/amount مطلوبة ومبلغ موجب" });
  }
  const exp: Expense = {
    id: Date.now().toString(),
    cafeId: cid, title, amount, category, notes, date,
    createdAt: new Date().toISOString(),
  };
  expenses.push(exp);
  res.json({ expense: exp });
});

router.delete("/expenses/:expenseId", (req: any, res): any => {
  const idx = expenses.findIndex(e => e.id === req.params.expenseId && e.cafeId === req.params.cafeId);
  if (idx < 0) return res.status(404).json({ error: "not found" });
  expenses.splice(idx, 1);
  res.json({ ok: true });
});

// ── Inventory (المخزن) ───────────────────────────────────────
router.get("/inventory", (req: any, res) => {
  const cid = req.params.cafeId;
  const list = inventoryItems
    .filter(i => i.cafeId === cid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active   = list.filter(i => i.currentQty > 0);
  const depleted = list.filter(i => i.currentQty <= 0);
  res.json({ active, depleted });
});

router.post("/inventory", (req: any, res): any => {
  const cid  = req.params.cafeId;
  const body = req.body ?? {};
  const name       = String(body.name ?? "").trim();
  const initialQty = Math.floor(Number(body.initialQty));
  const unitPrice  = Number(body.unitPrice);
  if (!name || !Number.isFinite(initialQty) || initialQty <= 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ error: "name/initialQty/unitPrice مطلوبة وقيم موجبة" });
  }
  const item: InventoryItem = {
    id: Date.now().toString(),
    cafeId: cid,
    name,
    initialQty,
    currentQty: initialQty,
    unitPrice,
    totalCost: Number((initialQty * unitPrice).toFixed(3)),
    createdAt: new Date().toISOString(),
    depletedAt: null,
  };
  inventoryItems.push(item);
  res.json({ item });
});

router.patch("/inventory/:itemId/decrement", (req: any, res): any => {
  const item = inventoryItems.find(
    i => i.id === req.params.itemId && i.cafeId === req.params.cafeId
  );
  if (!item) return res.status(404).json({ error: "not found" });
  if (item.currentQty <= 0) {
    return res.status(400).json({ error: "المنتج منتهٍ بالفعل" });
  }
  const rawStep = Number(req.body?.step ?? 1);
  if (!Number.isFinite(rawStep) || rawStep < 1) {
    return res.status(400).json({ error: "step يجب أن يكون عدداً موجباً" });
  }
  const step = Math.max(1, Math.floor(rawStep));
  item.currentQty = Math.max(0, item.currentQty - step);
  if (item.currentQty === 0 && !item.depletedAt) {
    item.depletedAt = new Date().toISOString();
  }
  res.json({ item });
});

// ── Invoice templates (5 types per cafe) ─────────────────────
function defaultTemplate(cafeId: string, type: InvoiceType, cafe: any): InvoiceTemplate {
  return {
    cafeId, type,
    logo: cafe?.logo ?? "",
    cafeName: cafe?.name ?? "",
    commercialReg: "",
    contactPhone: cafe?.ownerPhone ?? "",
    promoText: "شكراً لزيارتكم",
    updatedAt: new Date().toISOString(),
  };
}

router.get("/invoice-templates", (req: any, res) => {
  const cid = req.params.cafeId;
  const cafe = req.cafe;
  const out: Record<InvoiceType, InvoiceTemplate> = {} as any;
  for (const t of VALID_INVOICE_TYPES) {
    out[t] = invoiceTemplates.find(it => it.cafeId === cid && it.type === t)
          ?? defaultTemplate(cid, t, cafe);
  }
  res.json({ templates: out });
});

router.get("/invoice-templates/:type", (req: any, res): any => {
  const cid  = req.params.cafeId;
  const type = req.params.type as InvoiceType;
  if (!VALID_INVOICE_TYPES.includes(type)) return res.status(400).json({ error: "نوع غير صالح" });
  const tpl = invoiceTemplates.find(it => it.cafeId === cid && it.type === type)
           ?? defaultTemplate(cid, type, req.cafe);
  res.json({ template: tpl });
});

router.put("/invoice-templates/:type", (req: any, res): any => {
  const cid  = req.params.cafeId;
  const type = req.params.type as InvoiceType;
  if (!VALID_INVOICE_TYPES.includes(type)) return res.status(400).json({ error: "نوع غير صالح" });
  const body = req.body ?? {};
  const next: InvoiceTemplate = {
    cafeId: cid, type,
    logo:          String(body.logo ?? ""),
    cafeName:      String(body.cafeName ?? "").trim(),
    commercialReg: String(body.commercialReg ?? "").trim(),
    contactPhone:  String(body.contactPhone ?? "").trim(),
    promoText:     String(body.promoText ?? "").trim(),
    updatedAt: new Date().toISOString(),
  };
  const idx = invoiceTemplates.findIndex(it => it.cafeId === cid && it.type === type);
  if (idx >= 0) invoiceTemplates[idx] = next;
  else invoiceTemplates.push(next);
  res.json({ template: next });
});

export default router;

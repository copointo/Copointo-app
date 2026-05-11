import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { cafes, users, menuItems, tables, orders, bookings, chatInfos, invoices, cafeViews, discountCodes,
  expenses, invoiceTemplates, freeCoffees, inventoryItems,
  reels, reelLikes, reelComments, reelViews, giftVouchers,
  type MenuItem, type CafeTable, type Order, type TableBooking, type ChatInfo, type Invoice, type CafeView, type DiscountCode,
  type Expense, type InvoiceTemplate, type InvoiceType, type FreeCoffee, type InventoryItem,
  type Reel, type GiftVoucher, persistStore } from "../store";

// ── Reel video uploads ────────────────────────────────────────────────
// Videos are large, so we stream them to disk via multer (multipart) instead
// of base64-encoding them through the JSON body. The file path lives on the
// reel record as "file:<filename>"; the streaming endpoint reads from disk.
const REELS_DIR = path.join(process.cwd(), "uploads", "reels");
fs.mkdirSync(REELS_DIR, { recursive: true });
const reelUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, REELS_DIR),
    filename:    (_req, file, cb) => {
      const ext = path.extname(file.originalname || "") || ".mp4";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB hard cap
});

/** Wrap multer.single() so any error (file-too-large, multipart parse error,
 *  disk write failure, …) is surfaced as a JSON response instead of falling
 *  through to Express's default HTML error page — the admin client can then
 *  show the real reason instead of the generic "فشل الرفع". */
function reelUploadSafe(req: any, res: any, next: any) {
  reelUpload.single("video")(req, res, (err: any) => {
    if (!err) return next();
    let message = err?.message || "فشل رفع الملف";
    if (err?.code === "LIMIT_FILE_SIZE") {
      message = "حجم الفيديو كبير جداً — الحد الأقصى 1 جيجابايت";
    } else if (err?.code === "LIMIT_UNEXPECTED_FILE") {
      message = "حقل الملف غير صحيح — يجب أن يكون باسم \"video\"";
    } else if (err?.code === "ENOSPC") {
      message = "لا توجد مساحة كافية على الخادم لحفظ الفيديو";
    }
    req.log?.error?.({ err, code: err?.code }, "reel upload failed");
    return res.status(400).json({ error: message, code: err?.code ?? "UPLOAD_ERROR" });
  });
}

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
/** Issues one FreeCoffee per multiple-of-7 milestone the user has crossed but not yet been awarded for.
 *  The triggering cafe is recorded so the free coffee is only redeemable there. */
function awardMilestoneCoffees(
  userPhone: string,
  userName: string,
  totalOrders: number,
  earnedAtCafeId?: string | null,
  earnedAtCafeName?: string | null,
) {
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
      earnedAtCafeId:   earnedAtCafeId ?? null,
      earnedAtCafeName: earnedAtCafeName ?? null,
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
  // ── Gift voucher stats (separate from regular orders) ─────────────
  const cafeVouchers = giftVouchers.filter(v => v.cafeId === id);
  const confirmedVouchers = cafeVouchers.filter(v => v.status === "confirmed");
  const voucherRevenue = confirmedVouchers.reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const pendingVouchers = cafeVouchers.filter(v => v.status === "pending").length;

  res.json({
    totalOrders: cafeOrders.length, totalBookings: cafeBookings.length,
    totalMenuItems: cafeMenu.length, totalRevenue: +totalRevenue.toFixed(3),
    pendingOrders: cafeOrders.filter(o => o.status === "pending").length,
    confirmedBookings: cafeBookings.filter(b => b.status === "confirmed").length,
    chartData,
    topItems: cafeOrders.flatMap(o => o.items)
      .reduce((acc: Record<string, number>, item) => { acc[item.name] = (acc[item.name] || 0) + item.qty; return acc; }, {}),
    totalVouchers: cafeVouchers.length,
    confirmedVouchers: confirmedVouchers.length,
    pendingVouchers,
    voucherRevenue: +voucherRevenue.toFixed(3),
  });
});

// ── Gift Vouchers (قسائم شرائية) ─────────────────────────────────────────
// Public POST: any mobile user can buy a voucher for this cafe (mock payment).
// Admin GET / confirm: cafe staff list and fulfil vouchers.
router.post("/gift-vouchers", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const b = req.body ?? {};
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 2) {
    return res.status(400).json({ error: "أقل قيمة للقسيمة 2 ريال عماني" });
  }
  const senderName     = String(b.senderName ?? "").trim();
  const senderPhone    = String(b.senderPhone ?? "").trim();
  const recipientName  = String(b.recipientName ?? "").trim();
  const recipientPhone = String(b.recipientPhone ?? "").trim();
  const fromMode = (b.fromMode === "anonymous" || b.fromMode === "friend" || b.fromMode === "named")
    ? b.fromMode as GiftVoucher["fromMode"]
    : null;
  if (!senderName || !senderPhone || !recipientName || !recipientPhone || !fromMode) {
    return res.status(400).json({ error: "بيانات ناقصة" });
  }
  const fromDisplay = fromMode === "named"
    ? String(b.fromDisplay ?? senderName).trim() || senderName
    : undefined;

  const now = new Date().toISOString();
  const voucher: GiftVoucher = {
    id: `gv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    cafeId,
    amount: +amount.toFixed(3),
    senderName, senderPhone, recipientName, recipientPhone,
    fromMode, fromDisplay,
    status: "pending",
    paidAt: now,
    createdAt: now,
  };
  giftVouchers.push(voucher);
  persistStore();
  res.json({ ok: true, voucher });
});

router.get("/gift-vouchers", (req: any, res) => {
  const cafeId = req.params.cafeId;
  const list = giftVouchers
    .filter(v => v.cafeId === cafeId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ vouchers: list });
});

router.post("/gift-vouchers/:id/confirm", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const v = giftVouchers.find(x => x.id === req.params.id && x.cafeId === cafeId);
  if (!v) return res.status(404).json({ error: "القسيمة غير موجودة" });
  if (v.status === "confirmed") return res.json({ ok: true, voucher: v });

  const now = new Date().toISOString();
  v.status = "confirmed";
  v.confirmedAt = now;

  // Mirror as an Invoice so it shows up in the cafe's invoices list and
  // rolls into revenue/analytics aggregations.
  const invoice: Invoice = {
    id:           `inv_v_${v.id}`,
    cafeId,
    orderId:      v.id,
    customerName: `قسيمة شرائية → ${v.recipientName}`,
    items:        [{ name: `قسيمة شرائية (${v.amount.toFixed(3)} ر.ع)`, qty: 1, price: v.amount }],
    total:        v.amount,
    type:         "order",
    createdAt:    now,
  };
  invoices.push(invoice);
  v.invoiceId = invoice.id;

  persistStore();
  res.json({ ok: true, voucher: v });
});

router.delete("/gift-vouchers/:id", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const idx = giftVouchers.findIndex(x => x.id === req.params.id && x.cafeId === cafeId);
  if (idx === -1) return res.status(404).json({ error: "القسيمة غير موجودة" });
  const [removed] = giftVouchers.splice(idx, 1);
  // Also remove the linked invoice if any.
  if (removed?.invoiceId) {
    const i = invoices.findIndex(inv => inv.id === removed.invoiceId);
    if (i !== -1) invoices.splice(i, 1);
  }
  persistStore();
  res.json({ ok: true });
});

// ── Orders ────────────────────────────────────────────────────
router.get("/orders", (req: any, res) => {
  res.json({ orders: orders.filter(o => o.cafeId === req.params.cafeId) });
});
router.post("/orders", (req: any, res): any => {
  const body = req.body ?? {};
  const cafeId = req.params.cafeId;

  // ─── PHASE 1: VALIDATE EVERYTHING (no mutations yet) ──────────
  // We must defer ALL state changes (stock decrement, discount usedCount,
  // free-coffee redeemedAt) until every validation has passed. Otherwise an
  // early 4xx return can leave inventory or discount usage in a corrupted
  // state with no order to show for it.

  // ── Stock check ─────────────────────────────────────────────
  const requested = new Map<string, number>();
  for (const it of (body.items ?? [])) {
    const n = String(it?.name ?? "").trim();
    const q = Number(it?.qty) || 0;
    if (!n || q <= 0) continue;
    requested.set(n, (requested.get(n) ?? 0) + q);
  }
  const decrements: { item: typeof menuItems[number]; qty: number }[] = [];
  for (const [name, qty] of requested) {
    const item = menuItems.find(m => m.cafeId === cafeId && m.name === name);
    if (!item) continue;
    if (item.stockQty == null) continue; // untracked → unlimited
    if (item.stockQty < qty) {
      return res.status(409).json({
        error: `نفدت كمية "${item.name}" — المتبقّي: ${item.stockQty}`,
      });
    }
    decrements.push({ item, qty });
  }

  // ── Discount code: validate (do not mutate usedCount yet) ──
  let discountPercent: number | undefined;
  let discountCode: string | undefined;
  let discountAmount: number | undefined;
  let subtotal: number = Number(body.total) || 0;
  let total = subtotal;
  let dcRef: typeof discountCodes[number] | undefined;
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
    dcRef = dc; // commit usedCount in phase 2
  }

  // ── Free-coffee redemptions: validate (do not mark redeemed yet) ──
  // Each entry redeems one free coffee against one drink in the order.
  // Validation per entry: code exists, owned by this customer's phone,
  // unredeemed, earned at THIS cafe; the drink must exist in the order,
  // its price ≤ 2 OMR, category ≠ طعام/حلى. If any validation fails,
  // the whole order is rejected and NO state has been mutated yet.
  const redemptionsInput: any[] = Array.isArray(body.freeCoffeeRedemptions)
    ? body.freeCoffeeRedemptions
    : [];
  const redemptionRecords: { code: string; level: number; itemName: string; itemPrice: number }[] = [];
  let freeCoffeeDiscount = 0;
  const fcRefs: { fc: typeof freeCoffees[number]; itemName: string; itemPrice: number }[] = [];
  if (redemptionsInput.length > 0) {
    const customerPhone = String(body.customerPhone ?? "").trim();
    if (!customerPhone) {
      return res.status(400).json({ error: "رقم الهاتف مطلوب لاستخدام كوفي مجاني" });
    }
    // Build a working count of per-name drink slots so two redemptions
    // can target two cups of the same item, but never more than were ordered.
    const slotsByName = new Map<string, number>();
    for (const it of (body.items ?? [])) {
      const name = String(it?.name ?? "").trim();
      const cat  = String(it?.category ?? "");
      const qty  = Number(it?.qty) || 0;
      if (!name || qty <= 0) continue;
      if (cat === "طعام" || cat === "حلى") continue;          // ineligible
      if ((Number(it?.price) || 0) > 2) continue;                // > 2 OMR
      slotsByName.set(name, (slotsByName.get(name) ?? 0) + qty);
    }
    const seenCodes = new Set<string>();
    for (const r of redemptionsInput) {
      const code = String(r?.code ?? "").trim().toUpperCase();
      const itemName = String(r?.itemName ?? "").trim();
      if (!code || !itemName) {
        return res.status(400).json({ error: "بيانات الكوفي المجاني ناقصة" });
      }
      if (seenCodes.has(code)) {
        return res.status(400).json({ error: "تكرار نفس كود الكوفي المجاني" });
      }
      seenCodes.add(code);
      const fc = freeCoffees.find(f => f.code === code);
      if (!fc)                                       return res.status(404).json({ error: `الكود ${code} غير موجود` });
      if (fc.userPhone !== customerPhone)            return res.status(403).json({ error: "هذا الكوفي المجاني ليس لك" });
      if (fc.redeemedAt)                             return res.status(400).json({ error: `الكود ${code} تم استخدامه مسبقاً` });
      // STRICT cafe scope: a free coffee can ONLY be redeemed at the exact
      // cafe where it was earned. No fallback for legacy null earnedAtCafeId
      // — those codes simply cannot be redeemed (the user must earn a new one
      // through the new milestone flow which always stamps the originating cafe).
      if (fc.earnedAtCafeId !== cafeId) {
        const where = fc.earnedAtCafeName
          ? `هذا الكوفي المجاني يُستخدَم فقط في "${fc.earnedAtCafeName}"`
          : "هذا الكوفي المجاني يُستخدَم فقط في الكوفي الذي حصلت منه عليه";
        return res.status(400).json({ error: where });
      }
      const remaining = slotsByName.get(itemName) ?? 0;
      if (remaining <= 0) {
        return res.status(400).json({ error: `لا يوجد مشروب مؤهل بالاسم "${itemName}" لاستخدام الكوفي المجاني عليه` });
      }
      // Lookup price from the order line (already validated ≤ 2 OMR).
      const line = (body.items ?? []).find((it: any) => String(it?.name ?? "").trim() === itemName);
      const itemPrice = Number(line?.price) || 0;
      slotsByName.set(itemName, remaining - 1);
      fcRefs.push({ fc, itemName, itemPrice });
      redemptionRecords.push({ code: fc.code, level: fc.earnedAtLevel, itemName, itemPrice });
      freeCoffeeDiscount += itemPrice;
    }
    freeCoffeeDiscount = +freeCoffeeDiscount.toFixed(3);
    total = +(total - freeCoffeeDiscount).toFixed(3);
    if (total < 0) total = 0;
  }

  // ─── PHASE 2: COMMIT ALL MUTATIONS ATOMICALLY ─────────────────
  // From this point on, every mutation succeeds together. There are no
  // further validations, async hops, or early returns.
  const orderId = Date.now().toString();

  // 2a. Stock decrements
  for (const { item, qty } of decrements) {
    item.stockQty = (item.stockQty as number) - qty;
  }
  // 2b. Discount usage bump
  if (dcRef) dcRef.usedCount++;
  // 2c. Mark free coffees redeemed against this order id
  for (const { fc } of fcRefs) {
    fc.redeemedAt       = new Date().toISOString();
    fc.redeemedAtCafeId = cafeId;
    fc.redeemedOrderId  = orderId;
  }

  const o: Order = {
    id: orderId,
    cafeId,
    status: "pending",
    createdAt: new Date().toISOString(),
    ...body,
    subtotal,
    discountCode,
    discountPercent,
    discountAmount,
    total,
    freeCoffeeRedemptions: redemptionRecords.length > 0 ? redemptionRecords : undefined,
    freeCoffeeDiscount:    redemptionRecords.length > 0 ? freeCoffeeDiscount  : undefined,
  };
  orders.push(o);
  // Invoice is created only when the manager confirms preparation.
  return res.status(201).json({ order: o });
});
// Look up a registered Copointo Hub player by phone. Used by the cafe
// dashboard's "اطلب مباشر" tab so the cashier can attach a walk-in order to
// a real game user (so loyalty points are credited). Returns { user: null } if
// no match — never errors on "not found", since this is a lightweight lookup.
router.get("/lookup-user", (req: any, res): any => {
  const phone = String(req.query?.phone ?? "").trim();
  if (!phone) return res.json({ user: null });
  const u = users.find(x => x.phone === phone);
  if (!u) return res.json({ user: null });
  return res.json({
    user: {
      id: u.id,
      username: u.username,
      phone: u.phone,
      level: u.level,
      totalOrders: u.totalOrders,
      banned: !!u.banned,
      gameBanned: !!u.gameBanned,
    },
  });
});

router.get("/orders/:orderId", (req, res): any => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  return res.json({ order });
});
// Award drink-count progress to the customer (idempotent — only fires once per order).
function awardOrderProgress(order: any) {
  if (order.pointsAwarded) return;
  // Direct in-cafe orders without a registered customer phone do NOT contribute
  // to game/loyalty progress. If the cashier captured a verified game-user
  // phone (and the lookup matched a real user), we DO award progress just like
  // any normal order.
  if (order.source === "direct") {
    const phone = String(order.customerPhone ?? "").trim();
    const matched = phone ? users.find(u => u.phone === phone) : null;
    if (!matched) {
      order.pointsAwarded = true;
      return;
    }
  }
  // Always recompute drinks server-side from items so we cannot be over-credited
  // by a client (chat / mobile / direct) that sent an inflated `drinkCount`.
  // Only drinks count toward game progress. Anything explicitly tagged as a
  // non-drink category (food/dessert) is excluded.
  const drinks = Array.isArray(order.items)
    ? order.items.reduce((s: number, it: any) => {
        const cat = String(it.category ?? "");
        if (cat === "حلى" || cat === "طعام") return s;
        return s + (Number(it.qty) || 0);
      }, 0)
    : 0;
  if (drinks > 0) {
    const u = users.find(u => u.phone === order.customerPhone);
    if (u) {
      u.totalOrders += drinks;
      const cafe = cafes.find(c => c.id === order.cafeId);
      awardMilestoneCoffees(u.phone, u.username, u.totalOrders, order.cafeId, cafe?.name ?? null);
    }
  }
  order.pointsAwarded = true;
}

router.patch("/orders/:orderId/status", (req, res): any => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  const prevStatus = order.status;
  const next = req.body.status;
  order.status = next;
  // First time the order leaves "pending" → finalise invoice AND award drink progress
  // immediately (no longer waits for the manager to print the invoice).
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
    awardOrderProgress(order);
  }
  return res.json({ order });
});

// Set the payment method on an order (cash | visa). Stored on the order so
// the printed invoice and the daily/monthly/yearly aggregates can break down
// the totals by payment method.
router.patch("/orders/:orderId/payment", (req: any, res): any => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  const raw = String(req.body?.paymentMethod ?? "").trim().toLowerCase();
  if (raw !== "cash" && raw !== "visa" && raw !== "split" && raw !== "free") {
    return res.status(400).json({ error: "paymentMethod must be 'cash', 'visa', 'split', or 'free'" });
  }
  // For free orders we don't track split amounts.
  if (raw === "free") {
    order.paymentMethod = "free";
    order.cashAmount = undefined;
    order.visaAmount = undefined;
    persistStore();
    return res.json({ order });
  }

  // For cash/visa/split: validate cashAmount + visaAmount sum to order total.
  const orderTotal = +Number(order.total ?? 0).toFixed(3);
  const cashAmt = +Number(req.body?.cashAmount ?? 0).toFixed(3);
  const visaAmt = +Number(req.body?.visaAmount ?? 0).toFixed(3);
  if (!Number.isFinite(cashAmt) || cashAmt < 0 || !Number.isFinite(visaAmt) || visaAmt < 0) {
    return res.status(400).json({ error: "المبالغ يجب أن تكون أرقاماً موجبة" });
  }
  const sum = +(cashAmt + visaAmt).toFixed(3);
  if (Math.abs(sum - orderTotal) > 0.005) {
    return res.status(400).json({ error: `مجموع المدفوع (${sum.toFixed(3)}) لا يساوي إجمالي الطلب (${orderTotal.toFixed(3)})` });
  }
  // Derive method from amounts if cashAmt/visaAmt provided & both > 0 → split.
  let method: "cash" | "visa" | "split" = raw as any;
  if (cashAmt > 0 && visaAmt > 0) method = "split";
  else if (cashAmt > 0 && visaAmt === 0) method = "cash";
  else if (visaAmt > 0 && cashAmt === 0) method = "visa";

  order.paymentMethod = method;
  order.cashAmount = cashAmt;
  order.visaAmount = visaAmt;
  persistStore();
  return res.json({ order });
});

// Apply (or replace) a discount on an existing order from the cafe dashboard.
// Body shape: either { code: string } to apply a registered discount code (uses
// the code's percent), or { amount: number } to manually deduct a fixed OMR
// amount. Either way: discountAmount/discountCode/discountPercent are updated
// on the order and `total` is recomputed = max(0, subtotal − discountAmount −
// freeCoffeeDiscount). Refuses to apply once a payment method is locked in.
router.patch("/orders/:orderId/discount", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  if (order.paymentMethod) {
    return res.status(400).json({ error: "لا يمكن تعديل الخصم بعد تثبيت طريقة الدفع" });
  }

  const subtotal = Number(order.subtotal ?? order.total ?? 0);
  const freeCoffeeDisc = Number(order.freeCoffeeDiscount ?? 0);

  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const rawAmt = req.body?.amount;
  const hasAmt = rawAmt !== undefined && rawAmt !== null && rawAmt !== "";

  let discountCode: string | undefined;
  let discountPercent: number | undefined;
  let discountAmount = 0;

  if (code) {
    const dc = discountCodes.find(d =>
      d.cafeId === cafeId && d.code === code && d.active &&
      (!d.expiresAt || new Date(d.expiresAt).getTime() > Date.now())
    );
    if (!dc) return res.status(404).json({ error: "كود غير صالح أو منتهي" });
    discountCode    = dc.code;
    discountPercent = dc.percent;
    discountAmount  = +(subtotal * dc.percent / 100).toFixed(3);
  } else if (hasAmt) {
    const amt = Number(rawAmt);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "أدخل مبلغ خصم صحيح أكبر من صفر" });
    }
    if (amt > subtotal - freeCoffeeDisc) {
      return res.status(400).json({ error: "مبلغ الخصم أكبر من قيمة الطلب" });
    }
    discountAmount = +amt.toFixed(3);
  } else {
    return res.status(400).json({ error: "يجب إرسال كود أو مبلغ" });
  }

  order.discountCode    = discountCode;
  order.discountPercent = discountPercent;
  order.discountAmount  = discountAmount;
  order.total           = +Math.max(0, subtotal - discountAmount - freeCoffeeDisc).toFixed(3);
  persistStore();
  return res.json({ order });
});

// Mark invoice printed → completes order. Drink progress was already awarded at
// confirmation time (see PATCH /status); this still calls the helper so any
// edge-case order that was printed without going through confirmation is awarded.
router.post("/orders/:orderId/print", (req, res) => {
  const order = orders.find(o => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Not found" });
  awardOrderProgress(order);
  if (!order.printedAt) order.printedAt = new Date().toISOString();
  if (order.status !== "done") order.status = "done";
  return res.json({ order });
});

// Bulk-clear orders for a cafe, optionally restricted to a date range.
// Used after generating a daily/range invoice so the orders tab doesn't
// keep accumulating already-archived orders.
router.delete("/orders", (req: any, res) => {
  const cafeId = req.params.cafeId;
  const fromStr = typeof req.query?.from === "string" ? req.query.from : null;
  const toStr   = typeof req.query?.to   === "string" ? req.query.to   : null;
  const from = fromStr ? new Date(fromStr).getTime() : null;
  const to   = toStr   ? new Date(toStr).getTime()   : null;

  let removed = 0;
  for (let i = orders.length - 1; i >= 0; i--) {
    const o = orders[i];
    if (o.cafeId !== cafeId) continue;
    if (from != null || to != null) {
      const t = new Date(o.createdAt).getTime();
      if (from != null && t < from) continue;
      if (to   != null && t >= to)  continue;
    }
    orders.splice(i, 1);
    removed++;
  }
  persistStore();
  res.json({ removed });
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
router.post("/bookings", (req: any, res): any => {
  const cafeId = req.params.cafeId;
  const body = req.body ?? {};
  const tableId = String(body.tableId ?? "");
  const guests  = Number(body.guests) || 0;
  const hours   = Number(body.hours) || 0;
  const date    = String(body.date ?? new Date().toISOString().substring(0, 10));
  const time    = String(body.time ?? "").trim();

  const table = tables.find(t => t.id === tableId && t.cafeId === cafeId);
  if (!table) return res.status(404).json({ error: "الطاولة غير موجودة" });

  // ── Capacity guard ───────────────────────────────────────────
  if (guests < 1) return res.status(400).json({ error: "عدد الأشخاص غير صحيح" });
  if (guests > table.capacity) {
    return res.status(400).json({
      error: `الطاولة ${table.number} تتسع لـ ${table.capacity} أشخاص فقط`,
    });
  }

  // ── Time slot guards ─────────────────────────────────────────
  if (!time) return res.status(400).json({ error: "اختر وقت الحجز" });
  // If admin defined a fixed list, the time MUST be from it.
  if (Array.isArray(table.availableTimes) && table.availableTimes.length > 0) {
    if (!table.availableTimes.includes(time)) {
      return res.status(400).json({ error: "هذا الوقت غير متاح للحجز في هذه الطاولة" });
    }
  }
  // Reject if the admin manually blocked this date+time.
  if (Array.isArray(table.blockedSlots) && table.blockedSlots.some(s => s.date === date && s.time === time)) {
    return res.status(409).json({ error: "هذا الوقت مغلق من إدارة الكوفي" });
  }
  // Reject if another active booking already holds this date+time.
  const collidesWithBooking = bookings.some(b =>
    b.tableId === tableId
    && b.date === date
    && b.time === time
    && b.status !== "cancelled",
  );
  if (collidesWithBooking) {
    return res.status(409).json({ error: "هذا الوقت محجوز مسبقاً — اختر وقتاً آخر" });
  }

  // ── Hourly pricing guard (now mandatory) ─────────────────────
  const tiers = Array.isArray(table.hourlyPricing) ? table.hourlyPricing : [];
  if (tiers.length === 0) {
    return res.status(400).json({ error: "لم يحدّد الكوفي أسعار التواقيت لهذه الطاولة" });
  }
  if (!hours) {
    return res.status(400).json({ error: "اختر مدة الحجز (الساعات)" });
  }
  const tier = tiers.find(t => Number(t.hours) === hours);
  if (!tier) {
    return res.status(400).json({ error: "المدة المختارة غير متوفرة لهذه الطاولة" });
  }

  const totalPrice = +Number(tier.price).toFixed(3);

  const cafe = cafes.find(c => c.id === cafeId);
  const b: TableBooking = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    cafeId,
    cafeName: cafe?.name,
    customerName: String(body.customerName ?? "").trim(),
    customerPhone: String(body.customerPhone ?? "").trim(),
    tableId,
    tableNumber: table.number,
    tableCapacity: table.capacity,
    date: String(body.date ?? new Date().toISOString().substring(0, 10)),
    time: String(body.time ?? ""),
    guests,
    hours,
    hourPrice: +Number(tier.price).toFixed(3),
    totalPrice,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  bookings.push(b);
  res.status(201).json({ booking: b });
});
router.patch("/bookings/:bookingId/status", (req, res): any => {
  const booking = bookings.find(b => b.id === req.params.bookingId);
  if (!booking) return res.status(404).json({ error: "Not found" });
  const prev = booking.status;
  // Strict status enum — reject anything outside the three known states.
  const ALLOWED: TableBooking["status"][] = ["pending", "confirmed", "cancelled"];
  const next = req.body?.status as TableBooking["status"];
  if (!ALLOWED.includes(next)) {
    return res.status(400).json({ error: "حالة الحجز غير صالحة" });
  }
  booking.status = next;

  // First time the booking transitions to confirmed → generate an invoice
  // (so it shows up in revenue, daily/monthly/yearly aggregates, and the
  // admin's print history).
  if (prev !== "confirmed" && next === "confirmed") {
    booking.confirmedAt = new Date().toISOString();
    if (!booking.invoiceId) {
      const inv: Invoice = {
        id: `inv-bk-${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        cafeId: booking.cafeId,
        orderId: booking.id,
        customerName: booking.customerName,
        items: [{
          name: `حجز طاولة ${booking.tableNumber} • ${booking.hours ?? 0} ساعة`,
          qty: 1,
          price: Number(booking.totalPrice ?? 0),
        }],
        total: Number(booking.totalPrice ?? 0),
        type: "booking",
        createdAt: booking.confirmedAt,
      };
      invoices.push(inv);
      booking.invoiceId = inv.id;
    }
  }
  res.json({ booking });
});

// ── Menu ──────────────────────────────────────────────────────
router.get("/menu", (req: any, res) => {
  res.json({ items: menuItems.filter(m => m.cafeId === req.params.cafeId) });
});
function normalizeStock(body: any) {
  // Coerce stockQty: undefined → leave alone; null/"" → null (untracked); number → integer >= 0
  if (body && Object.prototype.hasOwnProperty.call(body, "stockQty")) {
    const raw = body.stockQty;
    if (raw === null || raw === "" || typeof raw === "undefined") {
      body.stockQty = null;
    } else {
      const n = Math.floor(Number(raw));
      body.stockQty = Number.isFinite(n) && n >= 0 ? n : null;
    }
  }
}

// Normalize the optional `beans` and `sizes` fields coming from the admin UI
// so the server stores well-shaped data even if the client sends junk.
//   beans:  string[]  — non-empty trimmed strings, deduped, capped at 12
//   sizes:  { label, extraPrice }[] — label non-empty, extraPrice numeric ≥ 0
// When the field is `null` or `[]`, we coerce it to `undefined` so the menu
// item simply has no picker (instead of an empty-but-truthy array).
function normalizeVariants(body: any) {
  if (Object.prototype.hasOwnProperty.call(body, "beans")) {
    const raw = Array.isArray(body.beans) ? body.beans : [];
    const cleaned = Array.from(new Set(
      raw.map((b: any) => (typeof b === "string" ? b.trim() : ""))
         .filter((b: string) => b.length > 0)
    )).slice(0, 12);
    body.beans = cleaned.length > 0 ? cleaned : undefined;
  }
  if (Object.prototype.hasOwnProperty.call(body, "sizes")) {
    const raw = Array.isArray(body.sizes) ? body.sizes : [];
    const cleaned = raw
      .map((s: any) => ({
        label: typeof s?.label === "string" ? s.label.trim() : "",
        extraPrice: Number(s?.extraPrice),
      }))
      .filter((s: { label: string; extraPrice: number }) =>
        s.label.length > 0 && Number.isFinite(s.extraPrice) && s.extraPrice >= 0
      )
      .slice(0, 8);
    body.sizes = cleaned.length > 0 ? cleaned : undefined;
  }
}

router.post("/menu", (req: any, res) => {
  const body = req.body ?? {};
  normalizeStock(body);
  normalizeVariants(body);
  const item: MenuItem = {
    id: Date.now().toString(),
    cafeId: req.params.cafeId,
    available: true,
    createdAt: new Date().toISOString(),
    ...body,
    // Snapshot the initial total when stock is provided at creation.
    initialStockQty: typeof body.stockQty === "number" ? body.stockQty : null,
  };
  menuItems.push(item);
  res.status(201).json({ item });
});
router.patch("/menu/:itemId", (req, res) => {
  const item = menuItems.find(m => m.id === req.params.itemId);
  if (!item) return res.status(404).json({ error: "Not found" });
  const body = req.body ?? {};
  normalizeStock(body);
  normalizeVariants(body);
  // Recompute initialStockQty (the alert-threshold baseline) only when stockQty
  // is actually being changed, so editing other fields (name/price/desc) via
  // the menu form does NOT silently clear low/critical alerts.
  if (Object.prototype.hasOwnProperty.call(body, "stockQty")) {
    const next = body.stockQty;
    if (next === null) {
      // Stock tracking turned off → clear baseline.
      body.initialStockQty = null;
    } else if (typeof next === "number") {
      const prevStock = typeof item.stockQty === "number" ? item.stockQty : null;
      const prevInit  = typeof item.initialStockQty === "number" ? item.initialStockQty : null;
      if (prevStock === null) {
        // Tracking newly enabled → this IS the baseline.
        body.initialStockQty = next;
      } else if (next > (prevInit ?? prevStock)) {
        // Restock above the prior baseline → bump baseline up.
        body.initialStockQty = next;
      } else {
        // Same or lower (depletion / minor correction) → keep existing baseline
        // so 50% / 25% thresholds remain meaningful.
        body.initialStockQty = prevInit ?? prevStock;
      }
    }
  }
  Object.assign(item, body);
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
function validateHourlyPricing(body: any): string | null {
  const tiers = Array.isArray(body?.hourlyPricing) ? body.hourlyPricing : [];
  if (tiers.length === 0) {
    return "أسعار التواقيت مطلوبة — أضف على الأقل سعر ساعة واحدة";
  }
  for (const t of tiers) {
    const h = Number(t?.hours), p = Number(t?.price);
    if (!Number.isFinite(h) || h < 1 || !Number.isFinite(p) || p < 0) {
      return "تأكد من إدخال الساعات والسعر بشكل صحيح في كل صف";
    }
  }
  return null;
}
function normalizeAvailableTimes(body: any): string[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(body ?? {}, "availableTimes")) return undefined;
  const arr = Array.isArray(body.availableTimes) ? body.availableTimes : [];
  // De-dup, drop blanks, keep order, cap to 64 entries to prevent abuse.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v ?? "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 64) break;
  }
  return out;
}
function normalizeBlockedSlots(body: any): { date: string; time: string }[] | undefined {
  if (!Object.prototype.hasOwnProperty.call(body ?? {}, "blockedSlots")) return undefined;
  const arr = Array.isArray(body.blockedSlots) ? body.blockedSlots : [];
  const seen = new Set<string>();
  const out: { date: string; time: string }[] = [];
  for (const v of arr) {
    const date = String(v?.date ?? "").trim();
    const time = String(v?.time ?? "").trim();
    if (!date || !time) continue;
    const key = `${date}|${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, time });
  }
  return out;
}
router.post("/tables", (req: any, res): any => {
  const err = validateHourlyPricing(req.body);
  if (err) return res.status(400).json({ error: err });
  const availableTimes = normalizeAvailableTimes(req.body);
  const blockedSlots = normalizeBlockedSlots(req.body);
  const t: CafeTable = {
    id: Date.now().toString(),
    cafeId: req.params.cafeId,
    available: true,
    createdAt: new Date().toISOString(),
    ...req.body,
    ...(availableTimes !== undefined ? { availableTimes } : {}),
    ...(blockedSlots !== undefined ? { blockedSlots } : {}),
  };
  tables.push(t);
  res.status(201).json({ table: t });
});
router.patch("/tables/:tableId", (req, res): any => {
  const t = tables.find(x => x.id === req.params.tableId);
  if (!t) return res.status(404).json({ error: "Not found" });
  // If hourlyPricing is being replaced, validate it. (Editing other fields
  // without touching pricing is allowed.)
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "hourlyPricing")) {
    const err = validateHourlyPricing(req.body);
    if (err) return res.status(400).json({ error: err });
  }
  const availableTimes = normalizeAvailableTimes(req.body);
  const blockedSlots = normalizeBlockedSlots(req.body);
  Object.assign(t, req.body);
  if (availableTimes !== undefined) t.availableTimes = availableTimes;
  if (blockedSlots !== undefined) t.blockedSlots = blockedSlots;
  res.json({ table: t });
});
router.delete("/tables/:tableId", (req, res) => {
  const idx = tables.findIndex(t => t.id === req.params.tableId);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  tables.splice(idx, 1);
  res.json({ success: true });
});

// ── Admin: toggle a single date+time as blocked / unblocked for a table ──
//   POST   /cafe/:cafeId/tables/:tableId/block  { date, time }  → adds (idempotent)
//   DELETE /cafe/:cafeId/tables/:tableId/block  { date, time }  → removes (idempotent)
// Used by the cafe owner's "إدارة المواعيد" modal so they can toggle one slot
// at a time without resending the whole `blockedSlots` array.
router.post("/tables/:tableId/block", (req: any, res): any => {
  const t = tables.find(x => x.id === req.params.tableId && x.cafeId === req.params.cafeId);
  if (!t) return res.status(404).json({ error: "الطاولة غير موجودة" });
  const date = String(req.body?.date ?? "").trim();
  const time = String(req.body?.time ?? "").trim();
  if (!date || !time) return res.status(400).json({ error: "التاريخ والوقت مطلوبان" });
  const list = Array.isArray(t.blockedSlots) ? t.blockedSlots.slice() : [];
  if (!list.some(s => s.date === date && s.time === time)) list.push({ date, time });
  t.blockedSlots = list;
  res.json({ table: t });
});
router.delete("/tables/:tableId/block", (req: any, res): any => {
  const t = tables.find(x => x.id === req.params.tableId && x.cafeId === req.params.cafeId);
  if (!t) return res.status(404).json({ error: "الطاولة غير موجودة" });
  const date = String(req.body?.date ?? req.query?.date ?? "").trim();
  const time = String(req.body?.time ?? req.query?.time ?? "").trim();
  if (!date || !time) return res.status(400).json({ error: "التاريخ والوقت مطلوبان" });
  t.blockedSlots = (Array.isArray(t.blockedSlots) ? t.blockedSlots : []).filter(
    s => !(s.date === date && s.time === time),
  );
  res.json({ table: t });
});

// ── Chat Info ─────────────────────────────────────────────────
router.get("/chat", (req: any, res) => {
  res.json({ items: chatInfos.filter(c => c.cafeId === req.params.cafeId) });
});

// Public endpoint: top-selling items by total quantity ordered.
// Returns ONLY item name + qty count — never revenue, customer info, or
// other sensitive cafe data. Used by the in-app chat assistant to answer
// "what's the most popular drink?" without exposing sales/profit numbers.
router.get("/popular-items", (req: any, res) => {
  const cafeId = req.params.cafeId;
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.cafeId !== cafeId) continue;
    for (const it of o.items || []) {
      const key = String(it.name || "").trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + Number(it.qty || 0));
    }
  }
  const items = Array.from(counts.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  res.json({ items });
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

// ─── Reels (admin per-cafe management) ──────────────────────────────────
router.get("/reels", (req: any, res) => {
  const cid = req.params.cafeId;
  const list = reels
    .filter(r => r.cafeId === cid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => ({
      ...r,
      // Use the streaming endpoint instead of the heavy data:// URL.
      videoUrl: `/api/reels/${r.id}/video`,
      likes:    reelLikes.filter(l => l.reelId === r.id).length,
      comments: reelComments.filter(c => c.reelId === r.id).length,
    }));
  res.json({ reels: list });
});

router.post("/reels", reelUploadSafe, (req: any, res) => {
  const cid  = req.params.cafeId;
  const cafe = cafes.find(c => c.id === cid);
  if (!cafe) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    return res.status(404).json({ error: "Cafe not found" });
  }
  const body = req.body ?? {};
  // Two upload modes:
  //  1) multipart/form-data with a "video" file (preferred — used by the admin
  //     dashboard so the video bytes never go through JSON parsing).
  //  2) JSON body with `videoUrl: "data:video/...;base64,..."` (legacy).
  let videoUrl = "";
  if (req.file) {
    videoUrl = `file:${req.file.filename}`;
  } else {
    videoUrl = String(body.videoUrl ?? "").trim();
  }
  const description = String(body.description ?? "").trim();
  const orderLink   = String(body.orderLink   ?? "").trim() || `copointo://cafe/${cid}`;
  // Auto-derive map location URL from cafe coordinates (fallback: address search).
  const fallbackLocation = (cafe.lat != null && cafe.lng != null)
    ? `https://www.google.com/maps/search/?api=1&query=${cafe.lat},${cafe.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.address || cafe.name)}`;
  const locationUrl = String(body.locationUrl ?? "").trim() || fallbackLocation;
  if (!videoUrl) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    return res.status(400).json({ error: "الرجاء رفع فيديو" });
  }
  if (!description) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    return res.status(400).json({ error: "الوصف مطلوب" });
  }
  const r: Reel = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    cafeId: cid,
    cafeName: cafe.name,
    cafeLogo: cafe.logo,
    videoUrl, description, orderLink, locationUrl,
    views: 0,
    createdAt: new Date().toISOString(),
  };
  reels.push(r);
  persistStore();
  res.status(201).json({ reel: r });
});

router.delete("/reels/:rid", (req: any, res) => {
  const cid = req.params.cafeId;
  const idx = reels.findIndex(r => r.id === req.params.rid && r.cafeId === cid);
  if (idx === -1) return res.status(404).json({ error: "Reel not found" });
  const [removed] = reels.splice(idx, 1);
  // Best-effort cleanup of the on-disk video file.
  // Hard sanitize: take basename only and verify the resolved path stays
  // strictly inside REELS_DIR. This prevents a crafted `file:../...` value
  // (possible via the legacy JSON upload mode) from deleting unrelated files.
  if (removed?.videoUrl?.startsWith("file:")) {
    const safe = path.basename(removed.videoUrl.slice(5));
    if (safe && safe !== "." && safe !== "..") {
      const filePath = path.resolve(REELS_DIR, safe);
      if (filePath.startsWith(path.resolve(REELS_DIR) + path.sep)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
  }
  // Cascade-cleanup likes/comments/views.
  for (let i = reelLikes.length - 1; i >= 0; i--) {
    if (reelLikes[i]!.reelId === removed!.id) reelLikes.splice(i, 1);
  }
  for (let i = reelComments.length - 1; i >= 0; i--) {
    if (reelComments[i]!.reelId === removed!.id) reelComments.splice(i, 1);
  }
  for (let i = reelViews.length - 1; i >= 0; i--) {
    if (reelViews[i]!.reelId === removed!.id) reelViews.splice(i, 1);
  }
  res.json({ ok: true });
});

router.get("/reels/:rid/comments", (req: any, res) => {
  const cid = req.params.cafeId;
  const reel = reels.find(r => r.id === req.params.rid && r.cafeId === cid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const list = reelComments
    .filter(c => c.reelId === reel.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ comments: list });
});

router.delete("/reels/:rid/comments/:cid", (req: any, res) => {
  const cid = req.params.cafeId;
  const reel = reels.find(r => r.id === req.params.rid && r.cafeId === cid);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const idx = reelComments.findIndex(c => c.id === req.params.cid && c.reelId === reel.id);
  if (idx === -1) return res.status(404).json({ error: "Comment not found" });
  reelComments.splice(idx, 1);
  res.json({ ok: true });
});

// Notifications feed: new likes & comments since `since` ISO timestamp.
router.get("/reels-notifications", (req: any, res) => {
  const cid = req.params.cafeId;
  const since = String(req.query.since ?? "");
  const myReelIds = new Set(reels.filter(r => r.cafeId === cid).map(r => r.id));
  if (!myReelIds.size) { res.json({ items: [], latest: new Date().toISOString() }); return; }
  const items = [
    ...reelLikes
      .filter(l => myReelIds.has(l.reelId) && (!since || l.likedAt > since))
      .map(l => ({ kind: "like" as const, reelId: l.reelId, userName: l.userName ?? "مستخدم", at: l.likedAt })),
    ...reelComments
      .filter(c => myReelIds.has(c.reelId) && (!since || c.createdAt > since))
      .map(c => ({ kind: "comment" as const, reelId: c.reelId, commentId: c.id, userName: c.userName, text: c.text, at: c.createdAt })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  res.json({ items, latest: new Date().toISOString() });
});

export default router;

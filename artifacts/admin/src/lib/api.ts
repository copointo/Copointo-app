async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const A = "/api/admin";
const C = (id: string) => `/api/cafe/${id}`;

export const api = {
  // Admin
  getStats:   ()           => req<any>("GET",   `${A}/stats`),
  getCafes:   ()           => req<any>("GET",   `${A}/cafes`),
  addCafe:    (body: any)  => req<any>("POST",  `${A}/cafes`, body),
  toggleCafe: (id: string) => req<any>("PATCH", `${A}/cafes/${id}/toggle`),
  deleteCafe: (id: string) => req<any>("DELETE",`${A}/cafes/${id}`),
  getUsers:   ()           => req<any>("GET",   `${A}/users`),
  toggleBan:  (id: string) => req<any>("PATCH", `${A}/users/${id}/ban`),
  gameBan:     (id: string, reason: string)              => req<any>("POST", `${A}/users/${id}/game-ban`,     { reason }),
  gameSuspend: (id: string, days: number, reason: string) => req<any>("POST", `${A}/users/${id}/game-suspend`, { days, reason }),
  gameClear:   (id: string)                              => req<any>("POST", `${A}/users/${id}/game-clear`),
  // Broadcast notifications to all game users
  getBroadcasts:    ()                  => req<any>("GET",    `${A}/broadcasts`),
  sendBroadcast:    (message: string)   => req<any>("POST",   `${A}/broadcasts`, { message }),
  deleteBroadcast:  (id: string)        => req<any>("DELETE", `${A}/broadcasts/${id}`),

  // Cafe Dashboard
  cafeStats:     (id: string)              => req<any>("GET",    `${C(id)}/stats`),
  cafeOrders:    (id: string)              => req<any>("GET",    `${C(id)}/orders`),
  cafeOrderStatus:(id:string,oid:string,status:string) => req<any>("PATCH", `${C(id)}/orders/${oid}/status`, { status }),
  cafeOrderPayment:(id:string,oid:string,paymentMethod:"cash"|"visa") => req<any>("PATCH", `${C(id)}/orders/${oid}/payment`, { paymentMethod }),
  cafeOrderPrint: (id:string,oid:string) => req<any>("POST",  `${C(id)}/orders/${oid}/print`),
  cafeOrdersClear: (id: string, from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to",   to);
    const q = qs.toString();
    return req<{ removed: number }>("DELETE", `${C(id)}/orders${q ? `?${q}` : ""}`);
  },
  validateFreeCoffee: (id: string, code: string) =>
    req<any>("POST", `${C(id)}/free-coffees/validate`, { code }),
  redeemFreeCoffee:   (id: string, code: string, orderId: string) =>
    req<any>("POST", `${C(id)}/free-coffees/redeem`,   { code, orderId }),
  cafeBookings:  (id: string)              => req<any>("GET",    `${C(id)}/bookings`),
  cafeBookingStatus:(id:string,bid:string,status:string) => req<any>("PATCH", `${C(id)}/bookings/${bid}/status`, { status }),
  cafeMenu:      (id: string)              => req<any>("GET",    `${C(id)}/menu`),
  addMenuItem:   (id: string, body: any)   => req<any>("POST",   `${C(id)}/menu`, body),
  updateMenuItem:(id: string, mid: string, body: any) => req<any>("PATCH", `${C(id)}/menu/${mid}`, body),
  deleteMenuItem:(id: string, mid: string) => req<any>("DELETE", `${C(id)}/menu/${mid}`),
  cafeTables:    (id: string)              => req<any>("GET",    `${C(id)}/tables`),
  addTable:      (id: string, body: any)   => req<any>("POST",   `${C(id)}/tables`, body),
  updateTable:   (id: string, tid: string, body: any) => req<any>("PATCH", `${C(id)}/tables/${tid}`, body),
  deleteTable:   (id: string, tid: string) => req<any>("DELETE", `${C(id)}/tables/${tid}`),
  blockTableSlot:   (id: string, tid: string, body: { date: string; time: string }) => req<any>("POST",   `${C(id)}/tables/${tid}/block`, body),
  unblockTableSlot: (id: string, tid: string, body: { date: string; time: string }) => req<any>("DELETE", `${C(id)}/tables/${tid}/block`, body),
  cafeChat:      (id: string)              => req<any>("GET",    `${C(id)}/chat`),
  addChatInfo:   (id: string, body: any)   => req<any>("POST",   `${C(id)}/chat`, body),
  deleteChatInfo:(id: string, cid: string) => req<any>("DELETE", `${C(id)}/chat/${cid}`),
  cafeInvoices:  (id: string)              => req<any>("GET",    `${C(id)}/invoices`),

  // Discount codes
  discountCodes:       (id: string)            => req<any>("GET",    `${C(id)}/discount-codes`),
  addDiscountCode:     (id: string, body: { code: string; percent: number; expiresAt?: string | null }) =>
                                                  req<any>("POST",   `${C(id)}/discount-codes`, body),
  deleteDiscountCode:  (id: string, did: string) => req<any>("DELETE", `${C(id)}/discount-codes/${did}`),

  // Expenses
  expenses:        (id: string)              => req<any>("GET",    `${C(id)}/expenses`),
  addExpense:      (id: string, body: any)   => req<any>("POST",   `${C(id)}/expenses`, body),
  deleteExpense:   (id: string, eid: string) => req<any>("DELETE", `${C(id)}/expenses/${eid}`),

  // Inventory (المخزن)
  inventory:           (id: string) => req<any>("GET",  `${C(id)}/inventory`),
  addInventoryItem:    (id: string, body: { name: string; initialQty: number; unitPrice: number }) =>
                                       req<any>("POST", `${C(id)}/inventory`, body),
  decrementInventory:  (id: string, itemId: string, step = 1) =>
                                       req<any>("PATCH", `${C(id)}/inventory/${itemId}/decrement`, { step }),

  // Invoice templates (per type: order/expense/daily/monthly/yearly)
  invoiceTemplates:      (id: string)                       => req<any>("GET", `${C(id)}/invoice-templates`),
  invoiceTemplate:       (id: string, type: string)         => req<any>("GET", `${C(id)}/invoice-templates/${type}`),
  updateInvoiceTemplate: (id: string, type: string, body: any) => req<any>("PUT", `${C(id)}/invoice-templates/${type}`, body),

  // Manager analytics (password-protected)
  cafeAuth:          (id: string, password: string) => req<any>("POST", `${C(id)}/auth`, { password }),
  cafeAdvancedStats: (id: string, password: string) => req<any>("POST", `${C(id)}/advanced-stats`, { password }),

  // Reels (admin)
  reels:               (id: string)              => req<any>("GET",    `${C(id)}/reels`),
  addReel:             (id: string, body: { videoUrl: string; description: string; orderLink?: string; locationUrl: string }) =>
                                                    req<any>("POST",   `${C(id)}/reels`, body),
  deleteReel:          (id: string, rid: string) => req<any>("DELETE", `${C(id)}/reels/${rid}`),
  reelComments:        (id: string, rid: string) => req<any>("GET",    `${C(id)}/reels/${rid}/comments`),
  deleteReelComment:   (id: string, rid: string, cid: string) =>
                                                    req<any>("DELETE", `${C(id)}/reels/${rid}/comments/${cid}`),
  reelsNotifications:  (id: string, since: string) =>
                                                    req<any>("GET",    `${C(id)}/reels-notifications?since=${encodeURIComponent(since)}`),
};

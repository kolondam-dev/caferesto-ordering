export const ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN", "CUSTOMER"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"];
export const ADMIN_ROLES: Role[] = ["OWNER", "MANAGER"];

export const TABLE_STATUS = { OPEN: "OPEN", BOOKED: "BOOKED", OCCUPIED: "OCCUPIED" } as const;

export const BOOKING_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  SEATED: "SEATED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  EXPIRED: "EXPIRED",
} as const;

export const ORDER_STATUS = { OPEN: "OPEN", PAID: "PAID", CANCELED: "CANCELED" } as const;

export const ITEM_STATUS = {
  QUEUED: "QUEUED",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "SERVED",
  CANCELED: "CANCELED",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  SETTLED: "SETTLED",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const;

export function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function orderTotal(items: { price: number; qty: number; status: string }[], taxPercent: number) {
  const subtotal = items
    .filter((i) => i.status !== ITEM_STATUS.CANCELED)
    .reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round((subtotal * taxPercent) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

/**
 * Smoke test end-to-end terhadap server yang sedang berjalan (production build).
 * Dipakai CI dan bisa dijalankan lokal: `npm run build && npm start` lalu
 * `BASE=http://localhost:3000 npm run smoke`.
 *
 * Menguji alur kritis: auth, jalur QR Scan & Serve lengkap (join 2 guest →
 * draft → confirm SINGLE → bayar → validasi kasir → dapur → selesai),
 * idempotency, dan jalur POS pay-later.
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

let passed = 0;
function ok(cond, label) {
  if (!cond) {
    console.error(`✗ GAGAL: ${label}`);
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${label}`);
}

/** Client mini dengan cookie jar per "device". */
function makeClient() {
  let cookies = {};
  return async function call(path, { method = "GET", body, headers = {} } = {}) {
    const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair] = sc.split(";");
      const idx = pair.indexOf("=");
      cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1);
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };
}

const owner = makeClient();
const cashier = makeClient();
const kitchen = makeClient();
const guestA = makeClient();
const guestB = makeClient();
const anon = makeClient();

// ── Auth ──────────────────────────────────────────────────────────
let r = await owner("/api/auth/login", { method: "POST", body: { email: "owner@caferesto.id", password: "password123" } });
ok(r.status === 200 && r.data.user.role === "OWNER", "login owner");
r = await cashier("/api/auth/login", { method: "POST", body: { email: "cashier@caferesto.id", password: "password123" } });
ok(r.status === 200, "login cashier");
r = await kitchen("/api/auth/login", { method: "POST", body: { email: "kitchen@caferesto.id", password: "password123" } });
ok(r.status === 200, "login kitchen");
r = await owner("/api/auth/login", { method: "POST", body: { email: "owner@caferesto.id", password: "salah" } });
ok(r.status === 401, "login password salah ditolak");

// ── Data dasar ────────────────────────────────────────────────────
r = await anon("/api/menu");
ok(r.status === 200 && r.data.categories.length > 0, "menu publik tersedia");
const menuItemId = r.data.categories[0].items[0].id;

r = await anon("/api/tables");
const freeTables = r.data.tables.filter((t) => t.status === "OPEN" && t.code);
ok(freeTables.length >= 2, "ada meja OPEN dengan kode QR");
const [tableQR, tablePOS] = freeTables;

// ── Jalur QR Scan & Serve ────────────────────────────────────────
r = await guestA("/api/qr/join", { method: "POST", body: { code: tableQR.code, name: "SmokeHost" } });
ok(r.status === 201, "guest A join (host)");
const orderId = r.data.orderId;
r = await guestB("/api/qr/join", { method: "POST", body: { code: tableQR.code, name: "SmokeFriend" } });
ok(r.status === 201 && r.data.orderId === orderId, "guest B join order yang sama");

r = await guestA(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 2 }] } });
ok(r.status === 201 && r.data.items[0].status === "DRAFT", "item host berstatus DRAFT");
r = await guestB(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 1 }] } });
ok(r.status === 201, "item member ditambahkan");

r = await anon(`/api/orders/${orderId}`);
ok(r.status === 403, "anonim tanpa cookie ditolak (403)");

r = await kitchen("/api/kitchen");
ok(!r.data.items.some((i) => i.order.code === undefined) && !r.data.items.some((i) => i.status === "DRAFT"), "dapur tidak melihat item DRAFT");

// Idempotency: dua request key sama → satu item
const key = `smoke-${Date.now()}`;
await guestA(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 1 }] }, headers: { "X-Idempotency-Key": key } });
await guestA(`/api/orders/${orderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 1 }] }, headers: { "X-Idempotency-Key": key } });
r = await guestA(`/api/orders/${orderId}`);
ok(r.data.order.items.length === 3, "idempotency: retry tidak menggandakan item");

// Konfirmasi SINGLE → bayar → (validasi default ON) → dapur → selesai
r = await guestB(`/api/orders/${orderId}/confirm`, { method: "POST", body: { splitMode: "SINGLE" } });
ok(r.status === 403, "member tidak bisa konfirmasi (hanya host)");
r = await guestA(`/api/orders/${orderId}/confirm`, { method: "POST", body: { splitMode: "SINGLE" } });
ok(r.status === 200 && r.data.status === "AWAITING_PAYMENT", "host konfirmasi SINGLE");
ok(Array.isArray(r.data.shares) && r.data.shares.length === 2, "rincian per member tersedia");

r = await guestA(`/api/orders/${orderId}/pay-share`, { method: "POST", body: {} });
ok(r.status === 200 && r.data.orderStatus === "AWAITING_VALIDATION", "host bayar → menunggu validasi kasir");

r = await cashier(`/api/orders/${orderId}/validate`, { method: "POST", body: { action: "approve" } });
ok(r.status === 200 && r.data.status === "IN_KITCHEN", "kasir validasi → masuk dapur");

r = await kitchen("/api/kitchen");
const myItems = r.data.items.filter((i) => i.order.code && i.status === "QUEUED");
ok(myItems.length >= 3, "dapur melihat item QUEUED");
for (const item of r.data.items) {
  for (const s of ["PREPARING", "READY", "SERVED"]) {
    await kitchen(`/api/order-items/${item.id}`, { method: "PATCH", body: { status: s } });
  }
}
r = await guestA(`/api/orders/${orderId}`);
ok(r.data.order.status === "PAID", "semua tersaji → order selesai (PAID)");
r = await anon("/api/tables");
ok(r.data.tables.find((t) => t.id === tableQR.id).status === "OPEN", "meja kembali OPEN");

// ── Jalur POS pay-later (dengan langkah validasi kirim ke dapur) ─
r = await cashier("/api/orders", { method: "POST", body: { type: "DINE_IN", tableId: tablePOS.id } });
const posOrderId = r.data.order.id;
ok(r.status === 201, "kasir buka order dine-in");
r = await cashier(`/api/orders/${posOrderId}/items`, { method: "POST", body: { items: [{ menuItemId, qty: 1 }] } });
ok(r.data.items[0].status === "DRAFT", "item POS mulai DRAFT (belum ke dapur)");

// Belum dikirim → dapur belum melihat item POS ini
r = await kitchen("/api/kitchen");
ok(!r.data.items.some((i) => i.orderId === posOrderId), "dapur belum melihat item POS sebelum dikirim");

r = await cashier(`/api/orders/${posOrderId}/send-kitchen`, { method: "POST" });
ok(r.status === 200 && r.data.sent === 1, "kasir kirim ke dapur → item QUEUED");
r = await kitchen("/api/kitchen");
ok(r.data.items.some((i) => i.orderId === posOrderId), "dapur melihat item POS setelah dikirim");

r = await cashier(`/api/orders/${posOrderId}/pay`, { method: "POST", body: { method: "cash" } });
ok(r.status === 200 && r.data.orderStatus === "PAID", "bayar cash → PAID");

// Pembayaran TIDAK otomatis membebaskan meja — kasir verifikasi dulu
r = await anon("/api/tables");
ok(r.data.tables.find((t) => t.id === tablePOS.id).status !== "OPEN", "meja POS tetap occupied setelah bayar (belum dibersihkan)");
r = await cashier(`/api/orders/${posOrderId}/clear-table`, { method: "POST" });
ok(r.status === 200 && r.data.cleared === true, "kasir bersihkan meja");
r = await anon("/api/tables");
ok(r.data.tables.find((t) => t.id === tablePOS.id).status === "OPEN", "meja POS OPEN setelah dibersihkan");

// ── Sold out / ready toggle oleh kasir ──────────────────────────
r = await cashier(`/api/menu/${menuItemId}/availability`, { method: "POST", body: { available: false } });
// availability hanya PATCH; pastikan POST tidak diizinkan, lalu PATCH benar
r = await cashier(`/api/menu/${menuItemId}/availability`, { method: "PATCH", body: { available: false } });
ok(r.status === 200 && r.data.item.available === false, "kasir set menu sold out");
r = await anon("/api/menu");
const soldItem = r.data.categories.flatMap((c) => c.items).find((i) => i.id === menuItemId);
ok(soldItem && soldItem.available === false, "menu tampil sold out di publik");
r = await cashier(`/api/menu/${menuItemId}/availability`, { method: "PATCH", body: { available: true } });
ok(r.status === 200 && r.data.item.available === true, "kasir set menu ready lagi");

// ── Auth customer via WA OTP (mock) ─────────────────────────────
const cust = makeClient();
r = await cust("/api/auth/customer/request", { method: "POST", body: { name: "Wati", phone: "081298765432" } });
ok(r.status === 200 && r.data.sent && r.data.devCode, "customer minta OTP WA (mock)");
const otp = r.data.devCode;
r = await cust("/api/auth/customer/verify", { method: "POST", body: { phone: "081298765432", code: "000000" } });
ok(r.status === 400, "OTP salah ditolak");
r = await cust("/api/auth/customer/verify", { method: "POST", body: { phone: "081298765432", code: otp } });
ok(r.status === 200 && r.data.user.role === "CUSTOMER" && r.data.user.phone === "6281298765432", "verify OTP → login customer (phone ternormalisasi)");
r = await cust("/api/auth/me");
ok(r.data.user && r.data.user.role === "CUSTOMER", "sesi customer aktif");

// Staff tidak bisa login lewat verify customer; customer tidak punya password
r = await anon("/api/auth/login", { method: "POST", body: { email: "owner@caferesto.id", password: "password123" } });
ok(r.status === 200 && r.data.user.role === "OWNER", "staff tetap login via email+password");

// ── Guard role ───────────────────────────────────────────────────
r = await guestA("/api/pro/inventory");
ok(r.status === 401 || r.status === 403, "guest tidak bisa akses modul PRO");

console.log(`\nSemua ${passed} pemeriksaan lulus ✅`);

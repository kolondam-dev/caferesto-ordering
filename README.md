# CafeResto — Ordering, Booking & Manajemen Cafe-Resto

Aplikasi web full-stack untuk cafe-resto: ordering dari meja, booking dengan konfirmasi fee,
POS kasir, kitchen display, AI agent untuk owner, plus backend lengkap fitur PRO.

## Stack

- **Next.js 15** (App Router, TypeScript) — frontend + API routes
- **Prisma + SQLite** (dev) — ganti `datasource` untuk PostgreSQL/MySQL di production
- **Tailwind CSS v4** — tema **sunset tetrad** (orange · gold · teal · violet)
- **Plus Jakarta Sans** (next/font) + **Phosphor Icons**
- **JWT custom** (jose, httpOnly cookie) — 5 role: `OWNER`, `MANAGER`, `CASHIER`, `KITCHEN`, `CUSTOMER`
- UI **mobile-first**, dioptimalkan untuk tablet/desktop (sidebar + multi-kolom)

## Menjalankan

```bash
npm install
npm run setup     # prisma generate + db push + seed
npm run dev       # http://localhost:3000
```

Akun demo (password semua: `password123`):
`owner@caferesto.id`, `manager@`, `cashier@`, `kitchen@`, `customer@caferesto.id`

## Lifecycle Booking

```
Booking dibuat (PENDING, tercatat)
  └─ bayar booking fee (min payment) sebelum H-x  ──▶ CONFIRMED, meja BOOKED
       └─ lewat H-x tanpa bayar                   ──▶ EXPIRED
CONFIRMED
  └─ buka order ≤ N menit setelah jadwal          ──▶ SEATED, meja OCCUPIED
       └─ lewat grace period                      ──▶ CANCELED, meja OPEN
SEATED ── order dibayar ──▶ COMPLETED, meja OPEN
```

- `H-x` (hari), nominal fee, dan grace period (default 60 menit) **dapat diubah di Dashboard → Pengaturan**.
- Booking fee otomatis menjadi **deposit** tagihan order saat check-in.
- Lifecycle dijalankan opportunistik di endpoint terkait + tersedia `GET/POST /api/lifecycle` untuk cron.

## Pembayaran (Mock, Midtrans-ready)

Abstraksi `PaymentGateway` di `src/lib/payments/`:

- `mock` (default) — charge langsung settle, alur demo mulus.
- `midtrans` — implementasi Snap lengkap (create transaction, status, verifikasi signature webhook).
  **Tinggal isi** `MIDTRANS_SERVER_KEY` dan set `PAYMENT_PROVIDER=midtrans` di `.env`.
  Webhook: arahkan Notification URL ke `/api/payments/webhook`.

Split bill: **bagi rata** (N peserta) atau **per item** (pajak & deposit proporsional), satu Payment per peserta.

## AI Agent (Owner)

- Dashboard → AI Agent: chat interface bergaya **WhatsApp (mock)** — di production endpoint
  `/api/ai/chat` yang sama tinggal dihubungkan ke webhook WhatsApp Business API.
- Backend membangun **konteks data real-time** (omzet, booking, menu terlaris, stok, utang)
  lalu memanggil **Gemini Flash** (`GEMINI_API_KEY`, universal key Google AI Studio).
- Tanpa API key → **mode mock**: jawaban deterministik tetap dari data asli (teks + tabel Markdown).

## Fitur PRO (backend siap, UI placeholder)

| Modul | Endpoint | Catatan |
|---|---|---|
| Inventory | `/api/pro/inventory[...]` | stok, min-stock, mutasi IN/OUT/ADJUST |
| Supplier | `/api/pro/suppliers[...]` | terhubung inventory & payables |
| Payables | `/api/pro/payables[...]` | bayar sebagian/lunas + auto-jurnal |
| Accounting | `/api/pro/accounting/...` | CoA, jurnal double-entry tervalidasi, saldo berjalan |
| Attendance | `/api/pro/attendance` | clock-in/out per staff |
| Payroll | `/api/pro/payroll[...]` | periode → payslip otomatis, bayar + auto-jurnal |

## Struktur Penting

```
prisma/schema.prisma          # seluruh model core + PRO
src/lib/lifecycle.ts          # mesin lifecycle booking
src/lib/payments/             # abstraksi gateway (mock & midtrans)
src/lib/ai/                   # konteks laporan + klien Gemini
src/app/api/                  # seluruh REST API
src/app/(customer)            # /, /book, /orders, /order/[id], /account
src/app/dashboard/            # POS, kitchen, booking, meja, menu, AI, settings, PRO
```

# Arsitektur CafeResto

Dokumen ini menjelaskan arsitektur aplikasi serta titik integrasi **Midtrans** (pembayaran)
dan **WhatsApp/Gemini** (AI agent) — kondisi saat ini vs production.

## 1. Arsitektur Keseluruhan

```mermaid
flowchart TB
    subgraph Client["📱 Browser (mobile-first → tablet/desktop)"]
        CU["Customer UI<br>/ · /book · /orders · /order/:id"]
        ST["Staff Dashboard<br>POS · Kitchen · Booking · Menu · Settings"]
        AI["AI Chat UI<br>(gaya WhatsApp)"]
    end

    subgraph Next["Next.js 15 — satu aplikasi full-stack"]
        MW["middleware.ts<br>verifikasi JWT (cookie httpOnly)<br>guard role /dashboard"]
        API["API Routes /api/*<br>auth · menu · tables · bookings · orders<br>kitchen · payments · ai · pro/*"]
        subgraph LIB["Lapisan domain (src/lib)"]
            LC["lifecycle.ts<br>mesin status booking<br>(H-x deadline & grace 60’)"]
            PG["payments/<br>PaymentGateway (interface)<br>├ MockGateway (aktif)<br>└ MidtransGateway (siap)"]
            AIL["ai/<br>report-context.ts (data real-time)<br>gemini.ts (klien REST)"]
        end
        PR["Prisma ORM"]
    end

    DB[("SQLite dev.db<br>(production: ganti<br>PostgreSQL/MySQL)")]

    subgraph Ext["☁️ Layanan eksternal"]
        MT["Midtrans Snap<br>(belum aktif — tinggal isi API key)"]
        GM["Gemini Flash API<br>(opsional, ada mode mock)"]
        WA["WhatsApp Business API<br>(di-mock sebagai chat dashboard)"]
    end

    CU & ST & AI --> MW --> API
    API --> LC & PG & AIL
    LC & PG & AIL --> PR --> DB
    PG -.-> MT
    AIL -.-> GM
    WA -.-> API
```

Poin desain:

- **Satu aplikasi Next.js** menampung frontend + REST API; tidak ada server terpisah.
- **Lapisan domain** (`src/lib`) memisahkan logika bisnis dari route handler sehingga
  endpoint tetap tipis dan mudah diuji.
- **Lifecycle booking** dijalankan opportunistik di endpoint terkait dan tersedia sebagai
  `GET/POST /api/lifecycle` untuk cron eksternal.
- **5 role** (OWNER, MANAGER, CASHIER, KITCHEN, CUSTOMER) di-enforce dua lapis:
  middleware (akses halaman) dan `requireRole()` di tiap route (akses API).

## 2. Integrasi Midtrans (abstraksi pembayaran)

Semua pemanggil — bayar fee booking, bayar order, split bill — hanya mengenal interface
`PaymentGateway` (`src/lib/payments/gateway.ts`). Pergantian provider murni lewat env
`PAYMENT_PROVIDER=mock|midtrans`, **tanpa perubahan kode**.

```mermaid
sequenceDiagram
    participant U as Customer/Kasir
    participant API as /api/.../pay
    participant GW as PaymentGateway
    participant MT as Midtrans Snap
    participant WH as /api/payments/webhook
    participant DOM as applySettlement()

    Note over GW: SAAT INI: MockGateway<br>createCharge() → langsung SETTLED<br>(langkah MT & WH dilewati)

    U->>API: bayar (fee / order / split)
    API->>GW: createCharge(ref, amount)
    rect rgb(255, 243, 237)
        Note over GW,MT: PRODUCTION: MidtransGateway
        GW->>MT: POST /snap/v1/transactions (Basic auth SERVER_KEY)
        MT-->>GW: token + redirect_url
        GW-->>API: status PENDING + redirect_url
        API-->>U: redirect ke halaman bayar Snap
        U->>MT: bayar (QRIS/VA/kartu)
        MT->>WH: notifikasi webhook
        WH->>GW: parseWebhook() — verifikasi signature SHA-512<br>(order_id+status_code+gross_amount+server_key)
    end
    WH->>DOM: payment SETTLED
    DOM->>DOM: BOOKING_FEE → booking CONFIRMED, meja BOOKED<br>ORDER/SPLIT → jika lunas: order PAID,<br>meja OPEN, booking COMPLETED
```

Aktivasi Midtrans:

1. Isi `.env`: `PAYMENT_PROVIDER=midtrans`, `MIDTRANS_SERVER_KEY=...`
   (`MIDTRANS_IS_PRODUCTION=true` untuk live).
2. Set **Notification URL** di dashboard Midtrans ke
   `https://domain-anda/api/payments/webhook`.

Efek domain pasca-pembayaran terpusat di `src/lib/payments/settle.ts`
(`applySettlement`, `closeOrderIfPaid`) sehingga jalur mock, cash, dan webhook
Midtrans melewati logika yang sama persis.

## 3. Integrasi AI Agent / WhatsApp

```mermaid
sequenceDiagram
    participant O as Owner
    participant UI as Chat UI dashboard<br>(mock WhatsApp)
    participant API as /api/ai/chat
    participant CTX as buildReportContext()
    participant GM as Gemini Flash

    O->>UI: "Berapa omzet hari ini?"
    UI->>API: POST {message}
    API->>CTX: query Prisma real-time:<br>omzet hari/minggu, booking hari ini,<br>menu terlaris, stok menipis, utang supplier
    alt GEMINI_API_KEY terisi
        API->>GM: system prompt + konteks JSON + riwayat 10 pesan
        GM-->>API: jawaban markdown (teks/tabel)
    else mode mock (saat ini)
        API->>API: mockAnswer() — jawaban deterministik<br>dari data asli yang sama
    end
    API-->>UI: balasan tersimpan → render markdown<br>(bubble ala WhatsApp)
```

Jalur ke WhatsApp asli: logika `/api/ai/chat` sudah lengkap — tinggal menambah satu
endpoint webhook (mis. `/api/wa/webhook`) yang menerima pesan masuk dari WhatsApp
Business API / BSP (Twilio, Qiscus, dsb.), memanggil fungsi yang sama, lalu mengirim
balasan via API WA. UI dashboard tidak perlu diubah.

## 3b. Alur Scan & Serve (QR, pay-first)

Status order jalur QR: `DRAFT → AWAITING_PAYMENT → AWAITING_VALIDATION → IN_KITCHEN → PAID`
(detail di `docs/proposals/scan-and-serve-qr-self-ordering.md`).

- Mesin alur di `src/lib/qr-flow.ts`: `computeShares` (rincian per member),
  `moveToValidationOrKitchen` (hormati setting `requireCashierValidation`),
  `enterKitchen` (item DRAFT→QUEUED, meja OCCUPIED), `completeIfAllServed`.
- **Service fee** disnapshot ke Order saat dibuat (`serviceFeeType/Value`);
  pajak dihitung atas (subtotal + service fee) — terpusat di `orderTotal()`.
- Split **SINGLE**: 1 charge oleh host, settle → auto ke validasi.
  Split **UPFRONT**: charge per member via `pay-share`, lunas semua → host `finalize`.
- Jalur POS/booking tetap pay-later (`OPEN → PAID`), tidak berubah.

## 4. Lifecycle Booking (referensi)

```mermaid
stateDiagram-v2
    [*] --> PENDING: booking dibuat (tercatat)
    PENDING --> CONFIRMED: bayar fee ≤ H-x<br>(meja → BOOKED)
    PENDING --> EXPIRED: lewat H-x tanpa bayar
    CONFIRMED --> SEATED: buka order ≤ grace menit<br>setelah jadwal (meja → OCCUPIED)
    CONFIRMED --> CANCELED: lewat grace period<br>(meja → OPEN)
    SEATED --> COMPLETED: order dibayar lunas<br>(meja → OPEN)
```

Parameter H-x (hari), nominal fee, dan grace period (default 60 menit) diatur di
**Dashboard → Pengaturan**. Fee yang dibayar menjadi deposit tagihan order saat check-in.

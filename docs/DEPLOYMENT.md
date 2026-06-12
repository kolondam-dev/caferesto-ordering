# Deployment: Vercel + Neon + Cloudflare R2

Panduan deploy CafeResto ke production pada subdomain Anda.

## Arsitektur production

```
Browser ──▶ Cloudflare DNS (resto.domain.com, CNAME → Vercel)
              └─▶ Vercel (Next.js serverless)
                    ├─▶ Neon PostgreSQL (pooled connection)
                    ├─▶ Cloudflare R2 (foto menu / upload)
                    └─◀ Vercel Cron + cron eksternal → /api/lifecycle
```

## 1. Neon (PostgreSQL)

1. Buat project di [neon.tech](https://neon.tech) — region **Singapore (ap-southeast-1)**, Neon Auth off.
2. Copy **pooled connection string** (host mengandung `-pooler`) → ini `DATABASE_URL` production.
3. Untuk dev lokal: tab **Branches → New branch** dari `production`, beri nama `dev` →
   copy connection string branch itu ke `.env` laptop Anda. Data dev terpisah dan
   gratis (branch berbagi kuota storage yang sama).
4. Inisialisasi schema + seed (sekali, dari laptop, dengan `DATABASE_URL` production di shell):
   ```bash
   npx prisma db push && npm run db:seed
   ```

Alternatif dev offline: `docker compose up -d` (Postgres lokal, lihat `docker-compose.yml`).

## 2. Cloudflare R2 (foto/upload)

1. Dashboard Cloudflare → **R2 Object Storage** → Create bucket (mis. `caferesto`).
2. Bucket → **Settings → Public access** → aktifkan **r2.dev subdomain** (atau hubungkan
   custom domain) → catat URL publiknya → `R2_PUBLIC_URL`.
3. R2 → **Manage R2 API Tokens** → Create API token (permission *Object Read & Write*,
   scope bucket tsb.) → catat `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.
   `R2_ACCOUNT_ID` ada di sidebar dashboard Cloudflare.
4. Env kosong = fallback otomatis ke disk lokal (mode dev). Jangan kosongkan di Vercel.

## 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → import repo `caferesto-ordering` —
   framework terdeteksi otomatis (Next.js), build command default.
2. **Environment Variables** (Production + Preview):
   `DATABASE_URL`, `JWT_SECRET` (string acak panjang baru!), `PAYMENT_PROVIDER=mock`,
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`,
   opsional `GEMINI_API_KEY`, dan kelak `MIDTRANS_*`.
3. Deploy. Lalu **Settings → Domains** → tambah `resto.domain-anda.com`.
4. Di Cloudflare DNS: tambah record **CNAME** `resto` → `cname.vercel-dns.com`
   (proxy boleh on; SSL/TLS mode **Full (Strict)**).

## 4. Lifecycle scheduler

`vercel.json` mendaftarkan **Vercel Cron** harian ke `/api/lifecycle` (paket Hobby
membatasi cron = 1×/hari). Lifecycle juga tetap berjalan opportunistik di endpoint
yang ramai. Agar presisi menit (expire draft 30', grace booking), tambahkan cron
eksternal gratis: [cron-job.org](https://cron-job.org) → job `GET https://resto.domain-anda.com/api/lifecycle`
setiap 1–5 menit.

## 5. Catatan penting production

- **Cetak Thermal** (server → printer IP) tidak berfungsi dari Vercel (server cloud
  tidak bisa menjangkau LAN resto). Pakai jalur **Preview & Cetak** (print dialog
  browser di device kasir — printer Bluetooth/USB/driver). Direct-thermal butuh
  print-bridge lokal (roadmap).
- **`JWT_SECRET` production wajib baru & rahasia** — yang lama di repo hanya untuk dev.
- Webhook Midtrans kelak diarahkan ke `https://resto.domain-anda.com/api/payments/webhook`.

## 6. Cloudflare Turnstile (anti-bot)

1. Dashboard Cloudflare → **Turnstile** → **Add widget** → domain: `resto.domain-anda.com`,
   mode **Managed** (tantangan hanya muncul bila trafik mencurigakan — tanpa friksi untuk tamu normal).
2. Catat **Site Key** → env `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, dan **Secret Key** → `TURNSTILE_SECRET_KEY` (di Vercel).
3. Widget otomatis tampil di form scan QR, login, dan register; server memverifikasi
   token ke `siteverify`. **Kedua env kosong = fitur nonaktif** (dev/CI tetap jalan tanpa Turnstile).
   Klaim identitas peserta lama dilewatkan (bukan vektor abuse).

## Checklist go-live

- [ ] Neon project + schema + seed
- [ ] R2 bucket + token + public URL
- [ ] Vercel project + semua env + deploy hijau
- [ ] Subdomain CNAME aktif & HTTPS jalan
- [ ] cron-job.org → /api/lifecycle
- [ ] Ganti password semua akun seed (password123!) atau hapus user demo
- [ ] Cetak ulang QR meja dari /dashboard/tables/print (URL kini domain production)

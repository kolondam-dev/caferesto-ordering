import { NextResponse } from "next/server";
import { db } from "./db";
import { getSession, type Session } from "./auth";
import type { Role } from "./constants";

/**
 * RBAC CafeResto — katalog izin per modul/seksi + grant default per peran.
 *
 * Grant disimpan sebagai override JSON di tabel Setting (key `rbac:<ROLE>`),
 * sehingga tidak perlu migrasi. Bila override belum ada untuk sebuah peran,
 * sistem memakai DEFAULT_GRANTS (simulasi RBAC umum). OWNER selalu memegang
 * semua izin dan tidak bisa dikunci dari UI.
 */

export type Permission = {
  key: string;
  module: string; // pengelompokan tampilan (mis. "Menu", "Order")
  label: string; // deskripsi singkat aksi/akses
};

// Katalog izin — sumber kebenaran untuk matriks "akses per modul per seksi".
export const PERMISSIONS: Permission[] = [
  { key: "dashboard.view", module: "Ringkasan", label: "Lihat ringkasan & metrik" },

  { key: "pos.view", module: "POS Kasir", label: "Buka POS & proses order" },
  { key: "pos.cancel_order", module: "POS Kasir", label: "Batalkan order" },

  { key: "history.view", module: "Riwayat Order", label: "Lihat riwayat order" },
  { key: "kitchen.view", module: "Kitchen", label: "Lihat & proses antrian dapur" },
  { key: "bookings.view", module: "Booking", label: "Kelola booking meja" },

  { key: "tables.view", module: "Meja", label: "Lihat denah meja" },
  { key: "tables.manage", module: "Meja", label: "Tambah/ubah meja & QR" },

  { key: "menu.view", module: "Menu", label: "Lihat daftar menu" },
  { key: "menu.availability", module: "Menu", label: "Set habis / tersedia" },
  { key: "menu.edit", module: "Menu", label: "Tambah/ubah/hapus menu & foto" },
  { key: "menu.cost", module: "Menu", label: "Lihat & ubah HPP / costing" },

  { key: "ai.view", module: "AI Agent", label: "Akses asisten AI" },
  { key: "settings.view", module: "Pengaturan", label: "Ubah pengaturan kafe" },
  { key: "pro.view", module: "Fitur PRO", label: "Akses modul PRO (inventory, dll)" },

  { key: "users.manage", module: "Pengguna & Peran", label: "Kelola pengguna & tetapkan peran" },
  { key: "roles.manage", module: "Pengguna & Peran", label: "Ubah hak akses tiap peran" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// Izin yang bukan untuk OWNER dianggap nihil; OWNER selalu penuh (lihat can()).
export const DEFAULT_GRANTS: Record<Exclude<Role, "OWNER" | "CUSTOMER">, string[]> = {
  MANAGER: [
    "dashboard.view",
    "pos.view", "pos.cancel_order",
    "history.view", "kitchen.view", "bookings.view",
    "tables.view", "tables.manage",
    "menu.view", "menu.availability", "menu.edit", "menu.cost",
    "ai.view", "settings.view", "pro.view",
  ],
  // Kasir: operasional kasir, TANPA batal order (perlu persetujuan owner).
  // Boleh menandai menu habis/tersedia (tahu stok di depan), tapi tanpa edit/costing.
  CASHIER: [
    "dashboard.view",
    "pos.view",
    "history.view", "bookings.view",
    "tables.view",
    "menu.view", "menu.availability",
  ],
  // Dapur: antrian + daftar menu + set habis/tersedia, TANPA edit costing.
  KITCHEN: [
    "dashboard.view",
    "kitchen.view",
    "menu.view", "menu.availability",
  ],
};

function defaultsFor(role: Role): string[] {
  if (role === "OWNER") return [...PERMISSION_KEYS];
  if (role === "CUSTOMER") return [];
  return DEFAULT_GRANTS[role] ?? [];
}

const settingKey = (role: Role) => `rbac:${role}`;

/**
 * Grant aktif untuk sebuah peran. Override JSON di Setting menang; bila tidak
 * ada, pakai default. Override yang rusak/format salah diabaikan (fallback).
 */
export async function getGrants(role: Role): Promise<string[]> {
  if (role === "OWNER") return [...PERMISSION_KEYS]; // owner tak bisa dikunci
  const row = await db.setting.findUnique({ where: { key: settingKey(role) } });
  if (!row) return defaultsFor(role);
  try {
    const parsed = JSON.parse(row.value);
    if (Array.isArray(parsed)) return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    /* override rusak → fallback default */
  }
  return defaultsFor(role);
}

/** Simpan override grant untuk peran (set eksplisit; OWNER tidak dapat diubah). */
export async function setGrants(role: Role, perms: string[]): Promise<string[]> {
  if (role === "OWNER" || role === "CUSTOMER") return defaultsFor(role);
  const clean = [...new Set(perms.filter((p) => PERMISSION_KEYS.includes(p)))];
  await db.setting.upsert({
    where: { key: settingKey(role) },
    update: { value: JSON.stringify(clean) },
    create: { key: settingKey(role), value: JSON.stringify(clean) },
  });
  return clean;
}

/** Kembalikan ke grant default (hapus override). */
export async function resetGrants(role: Role): Promise<string[]> {
  if (role !== "OWNER" && role !== "CUSTOMER")
    await db.setting.deleteMany({ where: { key: settingKey(role) } });
  return defaultsFor(role);
}

export async function can(role: Role, permission: string): Promise<boolean> {
  if (role === "OWNER") return true;
  const grants = await getGrants(role);
  return grants.includes(permission);
}

/**
 * Guard berbasis izin RBAC untuk route handler. Mengembalikan session atau
 * 401/403. Dipisah dari auth.ts agar middleware (edge) tidak menarik Prisma.
 */
export async function requirePermission(permission: string): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await can(session.role, permission)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return session;
}

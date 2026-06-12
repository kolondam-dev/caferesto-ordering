import { db } from "./db";

export type AppSettings = {
  bookingConfirmDays: number; // H-x: hari sebelum jadwal sebagai batas bayar fee
  bookingFeeAmount: number;
  bookingGraceMinutes: number; // batas buka order setelah jadwal
  taxPercent: number;
  cafeName: string;
  // Scan & Serve
  requireCashierValidation: boolean; // order QR lunas wajib divalidasi kasir sebelum ke dapur
  serviceFeeEnabled: boolean;
  serviceFeeType: "PERCENT" | "FLAT";
  serviceFeeValue: number;
};

const DEFAULTS: AppSettings = {
  bookingConfirmDays: 3,
  bookingFeeAmount: 50000,
  bookingGraceMinutes: 60,
  taxPercent: 10,
  cafeName: "CafeResto",
  requireCashierValidation: true,
  serviceFeeEnabled: false,
  serviceFeeType: "PERCENT",
  serviceFeeValue: 5,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const bool = (k: keyof AppSettings) => String(map[k] ?? (DEFAULTS[k] ? "1" : "0")) === "1";
  return {
    bookingConfirmDays: Number(map.bookingConfirmDays ?? DEFAULTS.bookingConfirmDays),
    bookingFeeAmount: Number(map.bookingFeeAmount ?? DEFAULTS.bookingFeeAmount),
    bookingGraceMinutes: Number(map.bookingGraceMinutes ?? DEFAULTS.bookingGraceMinutes),
    taxPercent: Number(map.taxPercent ?? DEFAULTS.taxPercent),
    cafeName: String(map.cafeName ?? DEFAULTS.cafeName),
    requireCashierValidation: bool("requireCashierValidation"),
    serviceFeeEnabled: bool("serviceFeeEnabled"),
    serviceFeeType: map.serviceFeeType === "FLAT" ? "FLAT" : "PERCENT",
    serviceFeeValue: Number(map.serviceFeeValue ?? DEFAULTS.serviceFeeValue),
  };
}

export async function saveSettings(patch: Partial<Record<keyof AppSettings, string | number>>) {
  for (const [key, value] of Object.entries(patch)) {
    await db.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
}

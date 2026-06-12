"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label, PageTitle, Spinner } from "@/components/ui";

type Settings = {
  bookingConfirmDays: number;
  bookingFeeAmount: number;
  bookingGraceMinutes: number;
  taxPercent: number;
  cafeName: string;
  requireCashierValidation: boolean;
  serviceFeeEnabled: boolean;
  serviceFeeType: "PERCENT" | "FLAT";
  serviceFeeValue: number;
  draftTtlMinutes: number;
  printerHost: string;
  printerPort: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: Settings }>("/api/settings").then((d) => setSettings(d.settings));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    const { settings: next } = await api<{ settings: Settings }>("/api/settings", {
      method: "PATCH",
      body: {
        ...settings,
        requireCashierValidation: settings.requireCashierValidation ? "1" : "0",
        serviceFeeEnabled: settings.serviceFeeEnabled ? "1" : "0",
      },
    });
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) return <Spinner />;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings(
      (s) => s && { ...s, [k]: k === "cafeName" || k === "printerHost" ? e.target.value : Number(e.target.value) }
    );

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Pengaturan" subtitle="Parameter lifecycle booking & operasional" />
      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>Nama Cafe</Label>
            <Input value={settings.cafeName} onChange={set("cafeName")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Batas konfirmasi booking (H-x hari)</Label>
              <Input type="number" min={0} value={settings.bookingConfirmDays} onChange={set("bookingConfirmDays")} />
              <p className="mt-1 text-[11px] text-ink/40">Customer wajib bayar fee sebelum H-{settings.bookingConfirmDays} dari jadwal.</p>
            </div>
            <div>
              <Label>Booking fee / min payment (Rp)</Label>
              <Input type="number" min={0} value={settings.bookingFeeAmount} onChange={set("bookingFeeAmount")} />
              <p className="mt-1 text-[11px] text-ink/40">Menjadi deposit tagihan saat check-in.</p>
            </div>
            <div>
              <Label>Grace period buka order (menit)</Label>
              <Input type="number" min={5} value={settings.bookingGraceMinutes} onChange={set("bookingGraceMinutes")} />
              <p className="mt-1 text-[11px] text-ink/40">Lewat dari ini setelah jadwal → booking batal, meja dibuka.</p>
            </div>
            <div>
              <Label>Pajak (%)</Label>
              <Input type="number" min={0} max={100} value={settings.taxPercent} onChange={set("taxPercent")} />
              <p className="mt-1 text-[11px] text-ink/40">Dihitung atas subtotal + service fee.</p>
            </div>
          </div>

          <div className="border-t border-sunset-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink/40">Scan & Serve (Order QR)</p>
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={settings.requireCashierValidation}
                onChange={(e) => setSettings((s) => s && { ...s, requireCashierValidation: e.target.checked })}
                className="h-4 w-4 accent-sunset-500"
              />
              Wajib validasi kasir sebelum pesanan masuk dapur
            </label>
            <div className="mb-3 max-w-xs">
              <Label>TTL draft QR (menit)</Label>
              <Input type="number" min={5} value={settings.draftTtlMinutes} onChange={set("draftTtlMinutes")} />
              <p className="mt-1 text-[11px] text-ink/40">
                Draft idle melebihi ini otomatis kedaluwarsa; reminder muncul di POS 5 menit sebelumnya.
              </p>
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={settings.serviceFeeEnabled}
                onChange={(e) => setSettings((s) => s && { ...s, serviceFeeEnabled: e.target.checked })}
                className="h-4 w-4 accent-sunset-500"
              />
              Aktifkan service fee
            </label>
            {settings.serviceFeeEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Tipe</Label>
                  <select
                    value={settings.serviceFeeType}
                    onChange={(e) => setSettings((s) => s && { ...s, serviceFeeType: e.target.value as "PERCENT" | "FLAT" })}
                    className="w-full rounded-xl border border-sunset-200 bg-white px-3.5 py-2.5 text-sm"
                  >
                    <option value="PERCENT">Persentase (%)</option>
                    <option value="FLAT">Nominal flat (Rp)</option>
                  </select>
                </div>
                <div>
                  <Label>{settings.serviceFeeType === "PERCENT" ? "Nilai (%)" : "Nominal (Rp)"}</Label>
                  <Input type="number" min={0} value={settings.serviceFeeValue} onChange={set("serviceFeeValue")} />
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] text-ink/40">
              Service fee disnapshot ke setiap order baru — order berjalan tidak berubah.
            </p>
          </div>

          <div className="border-t border-sunset-100 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink/40">Printer Struk (Thermal)</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>IP / Host printer (kosong = nonaktif)</Label>
                <Input value={settings.printerHost} onChange={set("printerHost")} placeholder="cth. 192.168.1.50" />
              </div>
              <div>
                <Label>Port</Label>
                <Input type="number" min={1} value={settings.printerPort} onChange={set("printerPort")} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ink/40">
              Thermal printer jaringan ESC/POS (Epson-compatible), umumnya port RAW 9100. Tombol "Cetak Thermal"
              muncul di POS bila host terisi.
            </p>
          </div>
          <Button type="submit">{saved ? "Tersimpan ✓" : "Simpan Pengaturan"}</Button>
        </form>
      </Card>
    </div>
  );
}

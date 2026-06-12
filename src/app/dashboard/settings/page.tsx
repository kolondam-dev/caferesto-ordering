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
    const { settings: next } = await api<{ settings: Settings }>("/api/settings", { method: "PATCH", body: settings });
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!settings) return <Spinner />;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => s && { ...s, [k]: k === "cafeName" ? e.target.value : Number(e.target.value) });

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
            </div>
          </div>
          <Button type="submit">{saved ? "Tersimpan ✓" : "Simpan Pengaturan"}</Button>
        </form>
      </Card>
    </div>
  );
}

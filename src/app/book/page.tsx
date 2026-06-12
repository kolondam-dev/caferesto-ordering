"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Users } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Empty, Input, Label, Money, Spinner } from "@/components/ui";
import CustomerShell from "@/components/CustomerShell";

type TableT = { id: string; name: string; capacity: number; status: string };
type Booking = {
  id: string; code: string; status: string; partySize: number; scheduledAt: string;
  payDeadlineAt: string; feeAmount: number; canceledReason?: string;
  table: { name: string }; order?: { id: string } | null;
};
type Settings = { bookingConfirmDays: number; bookingFeeAmount: number; bookingGraceMinutes: number };

export default function BookPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableT[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tableId, setTableId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [partySize, setPartySize] = useState(2);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  const load = useCallback(() => {
    api<{ tables: TableT[] }>("/api/tables").then((d) => setTables(d.tables));
    api<{ settings: Settings }>("/api/settings").then((d) => setSettings(d.settings));
    api<{ user: unknown }>("/api/auth/me").then((d) => {
      setLoggedIn(!!d.user);
      if (d.user) api<{ bookings: Booking[] }>("/api/bookings").then((b) => setBookings(b.bookings));
      else setBookings([]);
    });
  }, []);
  useEffect(load, [load]);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loggedIn) return router.push("/login?next=/book");
    setBusy(true);
    try {
      await api("/api/bookings", {
        method: "POST",
        body: { tableId, scheduledAt: new Date(`${date}T${time}`).toISOString(), partySize: Number(partySize) },
      });
      setTableId("");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function payFee(id: string) {
    setBusy(true);
    try {
      const res = await api<{ redirectUrl: string | null }>(`/api/bookings/${id}/pay`, { method: "POST" });
      if (res.redirectUrl) window.location.href = res.redirectUrl; // Midtrans Snap
      else load(); // mock: langsung settle
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkIn(id: string) {
    setBusy(true);
    try {
      const { order } = await api<{ order: { id: string } }>("/api/orders", { method: "POST", body: { bookingId: id } });
      router.push(`/order/${order.id}`);
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!confirm("Batalkan booking ini?")) return;
    await api(`/api/bookings/${id}`, { method: "PATCH", body: { action: "cancel" } }).catch((e) => alert(e.message));
    load();
  }

  const fmt = (s: string) =>
    new Date(s).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <CustomerShell>
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Form booking */}
        <Card className="p-5">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold">
            <CalendarCheck size={22} weight="fill" className="text-sunset-500" /> Booking Meja
          </h2>
          {settings && (
            <p className="mb-4 text-xs leading-relaxed text-ink/50">
              Booking tercatat lalu dikonfirmasi dengan membayar booking fee{" "}
              <b><Money value={settings.bookingFeeAmount} /></b> paling lambat <b>H-{settings.bookingConfirmDays}</b>.
              Saat jadwal tiba, buka order maksimal <b>{settings.bookingGraceMinutes} menit</b> setelah jam booking —
              lewat dari itu booking otomatis batal dan meja dibuka. Fee menjadi deposit tagihan Anda.
            </p>
          )}
          <form onSubmit={createBooking} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div>
                <Label>Jam</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Jumlah Orang</Label>
              <Input type="number" min={1} max={20} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} required />
            </div>
            <div>
              <Label>Pilih Meja</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {tables.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => setTableId(t.id)}
                    className={`rounded-xl border p-2 text-center ${
                      tableId === t.id ? "border-sunset-500 bg-sunset-500 text-white" : "border-sunset-200 bg-white"
                    }`}
                  >
                    <p className="text-xs font-bold">{t.name}</p>
                    <p className={`flex items-center justify-center gap-0.5 text-[10px] ${tableId === t.id ? "text-white/80" : "text-ink/40"}`}>
                      <Users size={10} /> {t.capacity}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            <Button type="submit" full disabled={busy || !tableId || !date}>
              {loggedIn === false ? "Masuk untuk Booking" : busy ? "Memproses…" : "Buat Booking"}
            </Button>
          </form>
        </Card>

        {/* Daftar booking saya */}
        <div>
          <h2 className="mb-3 text-lg font-extrabold">Booking Saya</h2>
          {bookings === null ? (
            <Spinner />
          ) : bookings.length === 0 ? (
            <Empty text="Belum ada booking" />
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <Card key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">
                        {b.table.name} · {b.partySize} orang
                      </p>
                      <p className="text-sm text-ink/60">{fmt(b.scheduledAt)}</p>
                      <p className="text-[11px] text-ink/40">{b.code}</p>
                    </div>
                    <Badge status={b.status} />
                  </div>
                  {b.status === "PENDING" && (
                    <div className="mt-3 rounded-xl bg-gold-50 p-3">
                      <p className="text-xs text-ink/70">
                        Bayar booking fee <b><Money value={b.feeAmount} /></b> sebelum <b>{fmt(b.payDeadlineAt)}</b> untuk konfirmasi.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button onClick={() => payFee(b.id)} disabled={busy} className="flex-1">
                          Bayar Fee
                        </Button>
                        <Button variant="outline" onClick={() => cancel(b.id)}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                  {b.status === "CONFIRMED" && (
                    <div className="mt-3 flex gap-2">
                      <Button variant="teal" onClick={() => checkIn(b.id)} disabled={busy} className="flex-1">
                        Check-in & Buka Order
                      </Button>
                      <Button variant="outline" onClick={() => cancel(b.id)}>
                        Batal
                      </Button>
                    </div>
                  )}
                  {b.status === "SEATED" && b.order && (
                    <Button variant="secondary" full className="mt-3" onClick={() => router.push(`/order/${b.order!.id}`)}>
                      Lihat Order Berjalan
                    </Button>
                  )}
                  {(b.status === "CANCELED" || b.status === "EXPIRED") && b.canceledReason && (
                    <p className="mt-2 text-xs text-red-600">{b.canceledReason}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerShell>
  );
}

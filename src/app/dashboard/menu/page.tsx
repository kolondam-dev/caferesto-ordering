"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Plus, Star, Trash } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label, Money, PageTitle, Spinner } from "@/components/ui";
import MenuImage from "@/components/MenuImage";
import Sheet from "@/components/Sheet";

type Photo = { id: string; url: string; isPrimary: boolean };
type MenuItem = {
  id: string; name: string; description?: string; price: number; available: boolean;
  prepMinutes?: number | null; photos?: Photo[];
};
type Category = { id: string; name: string; items: MenuItem[] };

export default function MenuAdminPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [form, setForm] = useState({ name: "", price: "", categoryId: "", description: "", prepMinutes: "" });
  const [newCat, setNewCat] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [photoItem, setPhotoItem] = useState<MenuItem | null>(null);

  const load = useCallback(
    () => api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/menu", { method: "POST", body: { ...form, price: Number(form.price) } }).catch((err) => alert(err.message));
    setForm({ name: "", price: "", categoryId: form.categoryId, description: "", prepMinutes: "" });
    load();
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    await api("/api/menu", { method: "POST", body: { kind: "category", name: newCat.trim(), sort: categories?.length ?? 0 } });
    setNewCat("");
    load();
  }

  async function toggle(item: MenuItem) {
    await api(`/api/menu/${item.id}`, { method: "PATCH", body: { available: !item.available } });
    load();
  }

  if (!categories) return <Spinner />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle
        title="Kelola Menu"
        action={
          <Button variant="gold" onClick={() => setShowForm((v) => !v)}>
            <Plus size={16} /> Item Baru
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-4 p-4">
          <form onSubmit={addItem} className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Nama</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Harga (Rp)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} required />
            </div>
            <div>
              <Label>Kategori</Label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                required
                className="w-full rounded-xl border border-sunset-200 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="">— pilih —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <Label>Estimasi pembuatan (menit, opsional)</Label>
              <Input type="number" min={1} value={form.prepMinutes} onChange={(e) => setForm((f) => ({ ...f, prepMinutes: e.target.value }))} />
            </div>
            <Button type="submit" className="md:col-span-2">Simpan Item</Button>
          </form>
          <div className="mt-3 flex gap-2 border-t border-sunset-50 pt-3">
            <Input placeholder="Kategori baru…" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
            <Button variant="outline" onClick={addCategory}>Tambah Kategori</Button>
          </div>
        </Card>
      )}

      {categories.map((c) => (
        <div key={c.id} className="mb-5">
          <h2 className="mb-2 font-extrabold">{c.name}</h2>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {c.items.map((i) => (
              <Card key={i.id} className={`flex items-stretch overflow-hidden ${!i.available ? "opacity-50" : ""}`}>
                <div className="w-16 shrink-0">
                  <MenuImage photos={i.photos} alt={i.name} />
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{i.name}</p>
                    <p className="flex items-center gap-1.5">
                      <Money value={i.price} className="text-xs text-sunset-600" />
                      {i.prepMinutes ? <span className="text-[10px] font-semibold text-teal-700">±{i.prepMinutes} mnt</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button variant="ghost" className="!px-2 !py-1.5" onClick={() => setPhotoItem(i)} title="Kelola foto">
                      <Camera size={16} />
                    </Button>
                    <Button variant={i.available ? "outline" : "teal"} className="!py-1.5 text-xs" onClick={() => toggle(i)}>
                      {i.available ? "Habis" : "Aktifkan"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {photoItem && (
        <PhotoModal
          item={photoItem}
          onClose={() => {
            setPhotoItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}

/** Kelola katalog foto menu: upload file / tambah URL, set foto utama, hapus. */
function PhotoModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api<{ photos: Photo[] }>(`/api/menu/${item.id}/photos`).then((d) => setPhotos(d.photos)),
    [item.id]
  );
  useEffect(() => {
    load();
  }, [load]);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/menu/${item.id}/photos`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload gagal");
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await api(`/api/menu/${item.id}/photos`, { method: "POST", body: { url: url.trim() } });
      setUrl("");
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={`Foto — ${item.name}`} onClose={onClose} wide>
      <div>

        {!photos ? (
          <Spinner />
        ) : photos.length === 0 ? (
          <p className="rounded-xl bg-cream p-4 text-center text-sm text-ink/45">Belum ada foto.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className={`relative overflow-hidden rounded-xl border-2 ${p.isPrimary ? "border-sunset-500" : "border-transparent"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-24 w-full object-cover" />
                {p.isPrimary && (
                  <span className="absolute left-1 top-1 rounded-full bg-sunset-500 px-1.5 py-0.5 text-[9px] font-bold text-white">UTAMA</span>
                )}
                <div className="absolute bottom-1 right-1 flex gap-1">
                  {!p.isPrimary && (
                    <button
                      disabled={busy}
                      onClick={() => api(`/api/menu/photos/${p.id}`, { method: "PATCH" }).then(load)}
                      className="rounded-full bg-white/90 p-1 text-gold-600"
                      title="Jadikan foto utama"
                    >
                      <Star size={13} weight="fill" />
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => api(`/api/menu/photos/${p.id}`, { method: "DELETE" }).then(load)}
                    className="rounded-full bg-white/90 p-1 text-red-600"
                    title="Hapus"
                  >
                    <Trash size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink/70">Upload foto (JPG/PNG/WebP, maks 3MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
              className="w-full rounded-xl border border-sunset-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-sunset-500 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
            />
          </label>
          <div className="flex gap-2">
            <Input placeholder="…atau tempel URL foto" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button variant="outline" onClick={addUrl} disabled={busy || !url.trim()}>Tambah</Button>
          </div>
          <p className="text-[11px] text-ink/40">
            Foto utama tampil di kartu menu; katalog lengkap dipakai tema buku menu (modul PRO Menu).
          </p>
        </div>
      </div>
    </Sheet>
  );
}

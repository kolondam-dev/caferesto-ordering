"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, MagnifyingGlass, PencilSimple, Plus, Star, Trash } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, Input, Label, Money, PageTitle, Spinner } from "@/components/ui";
import MenuImage from "@/components/MenuImage";
import Sheet from "@/components/Sheet";
import { formatIDR } from "@/lib/constants";
import { usePerms } from "@/lib/use-permissions";

type Photo = { id: string; url: string; isPrimary: boolean };
type MenuItem = {
  id: string; name: string; description?: string; price: number; costPrice?: number; available: boolean;
  prepMinutes?: number | null; categoryId?: string; photos?: Photo[];
};
type Category = { id: string; name: string; items: MenuItem[] };

/** Kelola Menu — layout ala POS: grid menu di kiri, panel detail + aksi di kanan. */
export default function MenuAdminPage() {
  const { can } = usePerms();
  const canEdit = can("menu.edit");
  const canCost = can("menu.cost");
  const canAvail = can("menu.availability");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoItem, setPhotoItem] = useState<MenuItem | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | "new" | null>(null);

  const load = useCallback(
    () => api<{ categories: Category[] }>("/api/menu").then((d) => setCategories(d.categories)),
    []
  );
  useEffect(() => {
    load();
  }, [load]);

  const allItems = useMemo(() => (categories ?? []).flatMap((c) => c.items.map((i) => ({ ...i, categoryId: c.id }))), [categories]);
  const selected = allItems.find((i) => i.id === selectedId) ?? null;
  const catName = (id?: string) => categories?.find((c) => c.id === id)?.name ?? "—";

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter(
      (i) => (activeCat === "all" || i.categoryId === activeCat) && (!q || i.name.toLowerCase().includes(q))
    );
  }, [allItems, activeCat, search]);

  async function toggle(item: MenuItem) {
    await api(`/api/menu/${item.id}/availability`, { method: "PATCH", body: { available: !item.available } });
    load();
  }
  async function remove(item: MenuItem) {
    if (!confirm(`Hapus ${item.name}?`)) return;
    const res = await api<{ pending?: boolean; message?: string }>(`/api/menu/${item.id}`, { method: "DELETE" })
      .catch((e) => { alert(e.message); return null; });
    if (!res) return;
    if (res.pending) { alert(res.message ?? "Menunggu persetujuan owner."); return; }
    setSelectedId(null);
    load();
  }

  if (!categories) return <Spinner />;

  return (
    <div className="mx-auto max-w-7xl">
      <PageTitle
        title="Kelola Menu"
        action={
          canEdit ? (
            <Button variant="gold" onClick={() => setEditItem("new")}>
              <Plus size={16} /> Item Baru
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[7fr_3fr]">
        {/* Grid menu */}
        <Card className="p-3">
          <div className="relative mb-2">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu…"
              className="w-full rounded-xl border border-sunset-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-400"
            />
          </div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            <CatChip label="Semua" active={activeCat === "all"} onClick={() => setActiveCat("all")} />
            {categories.map((c) => (
              <CatChip key={c.id} label={c.name} active={activeCat === c.id} onClick={() => setActiveCat(c.id)} />
            ))}
          </div>
          <div className="grid max-h-[62dvh] grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((i) => (
              <button
                key={i.id}
                onClick={() => setSelectedId(i.id)}
                className={`relative overflow-hidden rounded-xl border bg-white text-left transition-colors ${
                  selectedId === i.id ? "border-teal-500 ring-2 ring-teal-200" : "border-sunset-100 hover:border-teal-300"
                } ${!i.available ? "opacity-60" : ""}`}
              >
                <div className="relative h-20 w-full overflow-hidden">
                  <MenuImage photos={i.photos} alt={i.name} />
                  {!i.available && <span className="soldout-ribbon">SOLD OUT</span>}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm font-bold leading-tight">{i.name}</p>
                  <Money value={i.price} className="text-xs font-bold text-teal-700" />
                </div>
              </button>
            ))}
            {visibleItems.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-ink/40">Tidak ada menu.</p>
            )}
          </div>
          {canEdit && (
            <div className="mt-3 flex gap-2 border-t border-sunset-50 pt-3">
              <CategoryAdder count={categories.length} onAdded={load} />
            </div>
          )}
        </Card>

        {/* Panel detail — tabbed: Detail (edit) + Costing */}
        <Card className="h-fit p-4">
          {!selected ? (
            <p className="py-10 text-center text-sm text-ink/40">Pilih menu untuk melihat detail.</p>
          ) : (
            <DetailPanel
              key={selected.id}
              item={selected}
              categories={categories}
              catName={catName}
              canEdit={canEdit}
              canCost={canCost}
              canAvail={canAvail}
              onSaved={load}
              onPhotos={() => setPhotoItem(selected)}
              onToggle={() => toggle(selected)}
              onRemove={() => remove(selected)}
            />
          )}
        </Card>
      </div>

      {photoItem && (
        <PhotoModal item={photoItem} onClose={() => { setPhotoItem(null); load(); }} />
      )}
      {editItem && (
        <EditModal
          item={editItem === "new" ? null : editItem}
          categories={categories}
          onClose={() => setEditItem(null)}
          onSaved={(id) => { setEditItem(null); if (id) setSelectedId(id); load(); }}
        />
      )}
    </div>
  );
}

/** Panel detail menu dengan 2 tab: Detail (edit) & Costing (HPP/margin). */
function DetailPanel({
  item, categories, catName, canEdit, canCost, canAvail, onSaved, onPhotos, onToggle, onRemove,
}: {
  item: MenuItem;
  categories: Category[];
  catName: (id?: string) => string;
  canEdit: boolean;
  canCost: boolean;
  canAvail: boolean;
  onSaved: () => void;
  onPhotos: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<"detail" | "costing">("detail");

  // Form detail
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.categoryId ?? categories[0]?.id ?? "");
  const [description, setDescription] = useState(item.description ?? "");
  const [prepMinutes, setPrep] = useState(item.prepMinutes ? String(item.prepMinutes) : "");
  // Costing
  const [price, setPrice] = useState(String(item.price));
  const [costPrice, setCost] = useState(String(item.costPrice ?? 0));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");

  const p = Number(price) || 0;
  const c = Number(costPrice) || 0;
  const marginRp = p - c;
  const marginPct = p > 0 ? Math.round((marginRp / p) * 100) : 0;

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setSaved("");
    try {
      const res = await api<{ pending?: boolean }>(`/api/menu/${item.id}`, { method: "PATCH", body });
      setSaved(res?.pending ? "Menunggu persetujuan" : "Tersimpan ✓");
      if (!res?.pending) onSaved();
      setTimeout(() => setSaved(""), 2200);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 overflow-hidden rounded-xl">
        <div className="relative h-40 w-full overflow-hidden">
          <MenuImage photos={item.photos} alt={item.name} />
          {!item.available && <span className="soldout-ribbon">SOLD OUT</span>}
        </div>
      </div>

      {/* Tab header dengan border-bottom penanda aktif (Costing hanya bila berizin) */}
      <div className="mb-3 flex border-b border-sunset-100">
        {(canCost ? ([["detail", "Detail"], ["costing", "Costing"]] as const) : ([["detail", "Detail"]] as const)).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
              tab === v ? "border-teal-600 text-teal-700" : "border-transparent text-ink/45 hover:text-ink/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "detail" || !canCost ? (
        <div className="space-y-3">
          <div>
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Kategori</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!canEdit}
              className="w-full rounded-xl border border-sunset-200 bg-white px-3.5 py-2.5 text-sm disabled:opacity-60"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-ink/40">Saat ini: {catName(item.categoryId)}</p>
          </div>
          <div>
            <Label>Estimasi pembuatan (menit)</Label>
            <Input type="number" min={1} value={prepMinutes} onChange={(e) => setPrep(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
          </div>
          {canEdit && (
            <Button
              full
              disabled={busy}
              onClick={() => save({ name, categoryId, description, prepMinutes: prepMinutes ? Number(prepMinutes) : null })}
            >
              {busy ? "Menyimpan…" : saved || "Simpan Detail"}
            </Button>
          )}

          <div className="grid gap-2 border-t border-sunset-50 pt-3">
            {canEdit && <Button variant="outline" onClick={onPhotos}><Camera size={16} /> Kelola Foto</Button>}
            {canAvail && (
              <Button variant={item.available ? "outline" : "teal"} onClick={onToggle}>
                {item.available ? "Jadikan Habis" : "Jadikan Tersedia"}
              </Button>
            )}
            {canEdit && <Button variant="danger" onClick={onRemove}><Trash size={16} /> Hapus</Button>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Harga jual (Rp)</Label>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <Label>HPP / modal (Rp)</Label>
            <Input type="number" min={0} value={costPrice} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="rounded-xl bg-cream p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink/55">Harga jual</span><Money value={p} className="font-semibold" /></div>
            <div className="flex justify-between"><span className="text-ink/55">HPP</span><Money value={c} className="font-semibold" /></div>
            <div className="mt-1 flex justify-between border-t border-sunset-100 pt-1 font-extrabold">
              <span>Margin</span>
              <span className={marginRp >= 0 ? "text-teal-700" : "text-red-600"}>
                {formatIDR(marginRp)} · {marginPct}%
              </span>
            </div>
          </div>
          <Button full disabled={busy} onClick={() => save(canEdit ? { price: Number(price), costPrice: Number(costPrice) } : { costPrice: Number(costPrice) })}>
            {busy ? "Menyimpan…" : saved || "Simpan Costing"}
          </Button>
          <p className="text-[11px] text-ink/40">
            Margin = harga jual − HPP. Persentase dihitung terhadap harga jual.
          </p>
        </div>
      )}
    </div>
  );
}

function CatChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
        active ? "bg-teal-600 text-white" : "border border-sunset-100 bg-white text-ink/55 hover:border-teal-300"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryAdder({ count, onAdded }: { count: number; onAdded: () => void }) {
  const [name, setName] = useState("");
  async function add() {
    if (!name.trim()) return;
    await api("/api/menu", { method: "POST", body: { kind: "category", name: name.trim(), sort: count } });
    setName("");
    onAdded();
  }
  return (
    <>
      <Input placeholder="Kategori baru…" value={name} onChange={(e) => setName(e.target.value)} />
      <Button variant="outline" onClick={add} disabled={!name.trim()}>Tambah Kategori</Button>
    </>
  );
}

/** Sheet tambah/ubah detail menu. */
function EditModal({
  item, categories, onClose, onSaved,
}: {
  item: MenuItem | null; categories: Category[]; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    price: item ? String(item.price) : "",
    categoryId: item?.categoryId ?? categories[0]?.id ?? "",
    description: item?.description ?? "",
    prepMinutes: item?.prepMinutes ? String(item.prepMinutes) : "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: form.name,
        price: Number(form.price),
        categoryId: form.categoryId,
        description: form.description,
        prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : null,
      };
      if (item) {
        const res = await api<{ pending?: boolean; message?: string }>(`/api/menu/${item.id}`, { method: "PATCH", body });
        if (res?.pending) alert(res.message ?? "Perubahan menunggu persetujuan owner.");
        onSaved(item.id);
      } else {
        const { item: created } = await api<{ item: { id: string } }>("/api/menu", { method: "POST", body });
        onSaved(created.id);
      }
    } catch (err) {
      alert((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={item ? `Ubah — ${item.name}` : "Item Baru"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div>
          <Label>Nama</Label>
          <Input value={form.name} onChange={set("name")} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Harga (Rp)</Label>
            <Input type="number" value={form.price} onChange={set("price")} required />
          </div>
          <div>
            <Label>Estimasi (menit)</Label>
            <Input type="number" min={1} value={form.prepMinutes} onChange={set("prepMinutes")} />
          </div>
        </div>
        <div>
          <Label>Kategori</Label>
          <select
            value={form.categoryId}
            onChange={set("categoryId")}
            required
            className="w-full rounded-xl border border-sunset-200 bg-white px-3.5 py-2.5 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Deskripsi</Label>
          <Input value={form.description} onChange={set("description")} />
        </div>
        <Button type="submit" full disabled={busy}>{busy ? "Menyimpan…" : "Simpan"}</Button>
      </form>
    </Sheet>
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `Upload gagal (${res.status})`);
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

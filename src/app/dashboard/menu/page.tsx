"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Button, Card, Input, Label, Money, PageTitle, Spinner } from "@/components/ui";

type MenuItem = { id: string; name: string; description?: string; price: number; available: boolean };
type Category = { id: string; name: string; items: MenuItem[] };

export default function MenuAdminPage() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [form, setForm] = useState({ name: "", price: "", categoryId: "", description: "" });
  const [newCat, setNewCat] = useState("");
  const [showForm, setShowForm] = useState(false);

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
    setForm({ name: "", price: "", categoryId: form.categoryId, description: "" });
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
              <Card key={i.id} className={`flex items-center justify-between p-3 ${!i.available ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{i.name}</p>
                  <Money value={i.price} className="text-xs text-sunset-600" />
                </div>
                <Button variant={i.available ? "outline" : "teal"} className="!py-1.5 text-xs" onClick={() => toggle(i)}>
                  {i.available ? "Habis" : "Aktifkan"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

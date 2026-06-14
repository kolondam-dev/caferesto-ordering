"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowCounterClockwise, Check, ShieldCheck, UsersThree } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, PageTitle, Spinner } from "@/components/ui";
import { usePerms } from "@/lib/use-permissions";

type StaffUser = { id: string; name: string; email: string | null; role: string; createdAt: string };
type Permission = { key: string; module: string; label: string };
type RolesData = { permissions: Permission[]; roles: string[]; grants: Record<string, string[]> };

const ASSIGNABLE_ROLES = ["OWNER", "MANAGER", "CASHIER", "KITCHEN"] as const;
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner", MANAGER: "Manajer", CASHIER: "Kasir", KITCHEN: "Dapur", CUSTOMER: "Pelanggan",
};

export default function UsersPage() {
  const { can } = usePerms();
  const [tab, setTab] = useState<"users" | "roles">("users");

  if (!can("users.manage"))
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-8 text-center">
          <ShieldCheck size={36} className="mx-auto mb-2 text-ink/30" />
          <p className="text-sm text-ink/55">Anda tidak punya akses ke manajemen pengguna & peran.</p>
        </Card>
      </div>
    );

  const canRoles = can("roles.manage");

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle title="Pengguna & Peran" subtitle="Kelola staf dan hak akses tiap peran" />

      <div className="mb-4 flex border-b border-sunset-100">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<UsersThree size={16} />}>
          Pengguna
        </TabBtn>
        {canRoles && (
          <TabBtn active={tab === "roles"} onClick={() => setTab("roles")} icon={<ShieldCheck size={16} />}>
            Peran & Akses
          </TabBtn>
        )}
      </div>

      {tab === "users" || !canRoles ? <UsersTab /> : <RolesTab />}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => api<{ users: StaffUser[] }>("/api/users").then((d) => setUsers(d.users)), []);
  useEffect(() => { load(); }, [load]);

  async function assign(u: StaffUser, role: string) {
    if (role === u.role) return;
    setBusyId(u.id);
    setMsg("");
    try {
      await api(`/api/users/${u.id}`, { method: "PATCH", body: { role } });
      setMsg(`Peran ${u.name} → ${ROLE_LABEL[role]}`);
      await load();
      setTimeout(() => setMsg(""), 2200);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (!users) return <Spinner />;

  return (
    <Card className="divide-y divide-sunset-50 p-0">
      {msg && <p className="bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700">{msg}</p>}
      {users.map((u) => (
        <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{u.name}</p>
            <p className="truncate text-[11px] text-ink/45">{u.email ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={u.role} label={ROLE_LABEL[u.role] ?? u.role} />
            <select
              value={u.role}
              disabled={busyId === u.id}
              onChange={(e) => assign(u, e.target.value)}
              className="rounded-xl border border-sunset-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {users.length === 0 && <p className="p-8 text-center text-sm text-ink/40">Belum ada staf.</p>}
    </Card>
  );
}

function RolesTab() {
  const [data, setData] = useState<RolesData | null>(null);

  const load = useCallback(() => api<RolesData>("/api/roles").then(setData), []);
  useEffect(() => { load(); }, [load]);

  const modules = useMemo(() => {
    if (!data) return [];
    const seen: string[] = [];
    for (const p of data.permissions) if (!seen.includes(p.module)) seen.push(p.module);
    return seen.map((m) => ({ module: m, perms: data!.permissions.filter((p) => p.module === m) }));
  }, [data]);

  if (!data) return <Spinner />;

  // Peran yang dapat diedit (OWNER selalu penuh & terkunci).
  const editable = data.roles.filter((r) => r !== "OWNER");

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-cream px-3 py-2 text-xs text-ink/55">
        Centang akses tiap peran per modul. <b>Owner</b> selalu punya akses penuh dan tidak dapat diubah.
        Perubahan berlaku setelah disimpan; staf perlu memuat ulang untuk melihat efeknya.
      </p>
      {editable.map((role) => (
        <RoleCard key={role} role={role} modules={modules} initial={data.grants[role] ?? []} onSaved={load} />
      ))}
    </div>
  );
}

function RoleCard({
  role, modules, initial, onSaved,
}: {
  role: string;
  modules: { module: string; perms: Permission[] }[];
  initial: string[];
  onSaved: () => void;
}) {
  const [grants, setGrants] = useState<Set<string>>(new Set(initial));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(() => {
    if (grants.size !== initial.length) return true;
    return initial.some((p) => !grants.has(p));
  }, [grants, initial]);

  function toggle(key: string) {
    setGrants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/roles/${role}`, { method: "PUT", body: { permissions: [...grants] } });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm(`Kembalikan akses ${ROLE_LABEL[role]} ke default?`)) return;
    setBusy(true);
    try {
      const { grants: def } = await api<{ grants: string[] }>(`/api/roles/${role}`, { method: "DELETE" });
      setGrants(new Set(def));
      setSaved(false);
      onSaved();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold">
          <Badge status={role} label={ROLE_LABEL[role] ?? role} />
          <span className="text-xs font-normal text-ink/45">{grants.size} izin</span>
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={reset} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-ink/45 hover:text-ink/70">
            <ArrowCounterClockwise size={14} /> Default
          </button>
          <Button variant={dirty ? "teal" : "outline"} disabled={busy || !dirty} onClick={save} className="!py-1.5 text-xs">
            {saved ? <><Check size={14} /> Tersimpan</> : busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map(({ module, perms }) => (
          <div key={module} className="rounded-xl border border-sunset-100 p-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink/40">{module}</p>
            <div className="space-y-1.5">
              {perms.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={grants.has(p.key)}
                    onChange={() => toggle(p.key)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600"
                  />
                  <span className="text-ink/75">{p.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-bold transition-colors ${
        active ? "border-teal-600 text-teal-700" : "border-transparent text-ink/45 hover:text-ink/70"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle, XCircle, ShieldCheck, ClockCounterClockwise } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Button, Card, PageTitle, Spinner } from "@/components/ui";
import { usePerms } from "@/lib/use-permissions";
import { formatIDR } from "@/lib/constants";

type Req = {
  id: string;
  type: string;
  status: string;
  requestedName: string;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  reason: string | null;
  payload: Record<string, unknown>;
  decidedBy: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

const TYPE_LABEL: Record<string, string> = {
  ORDER_CANCEL: "Pembatalan Order",
  ORDER_DELETE: "Penghapusan Order",
  MENU_UPDATE: "Perubahan Menu",
  MENU_DELETE: "Penghapusan Menu",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Nama", description: "Deskripsi", price: "Harga jual", costPrice: "HPP",
  categoryId: "Kategori", prepMinutes: "Estimasi (menit)", available: "Tersedia",
};

const MONEY_FIELDS = ["price", "costPrice"];

export default function ApprovalsPage() {
  const { can } = usePerms();
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING");
  const [data, setData] = useState<{ requests: Req[]; pendingCount: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setData(null);
    api<{ requests: Req[]; pendingCount: number }>(`/api/approvals?status=${tab}`).then(setData);
  }, [tab]);

  useEffect(() => {
    if (can("approvals.review")) load();
  }, [load, can]);

  if (!can("approvals.review"))
    return (
      <div className="mx-auto max-w-md">
        <Card className="p-8 text-center">
          <ShieldCheck size={36} className="mx-auto mb-2 text-ink/30" />
          <p className="text-sm text-ink/55">Hanya owner yang dapat meninjau permintaan persetujuan.</p>
        </Card>
      </div>
    );

  async function decide(id: string, decision: "approve" | "reject") {
    const note = decision === "reject" ? prompt("Catatan penolakan (opsional):") ?? undefined : undefined;
    setBusyId(id);
    try {
      await api(`/api/approvals/${id}`, { method: "POST", body: { decision, note } });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Persetujuan" subtitle="Tinjau permintaan aksi sensitif dari staf" />

      <div className="mb-4 flex border-b border-sunset-100">
        <TabBtn active={tab === "PENDING"} onClick={() => setTab("PENDING")} icon={<ShieldCheck size={16} />}>
          Menunggu
        </TabBtn>
        <TabBtn active={tab === "ALL"} onClick={() => setTab("ALL")} icon={<ClockCounterClockwise size={16} />}>
          Riwayat
        </TabBtn>
      </div>

      {!data ? (
        <Spinner />
      ) : data.requests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-ink/40">
          {tab === "PENDING" ? "Tidak ada permintaan menunggu." : "Belum ada riwayat persetujuan."}
        </Card>
      ) : (
        <div className="space-y-3">
          {data.requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-bold">
                    {TYPE_LABEL[r.type] ?? r.type}
                    {r.targetLabel && <span className="text-ink/50">· {r.targetLabel}</span>}
                  </p>
                  <p className="text-[11px] text-ink/45">
                    Diminta oleh <b className="text-ink/70">{r.requestedName}</b> ·{" "}
                    {new Date(r.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Badge status={r.status} label={STATUS_LABEL[r.status] ?? r.status} />
              </div>

              {r.reason && <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-ink/70">Alasan: {r.reason}</p>}

              {r.type === "MENU_UPDATE" && Object.keys(r.payload).length > 0 && (
                <div className="mt-2 rounded-lg border border-sunset-100 p-2.5 text-xs">
                  <p className="mb-1 font-semibold text-ink/55">Perubahan diminta:</p>
                  <ul className="space-y-0.5">
                    {Object.entries(r.payload).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-3">
                        <span className="text-ink/55">{FIELD_LABEL[k] ?? k}</span>
                        <span className="font-semibold text-ink">{fmtVal(k, v)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.status === "PENDING" ? (
                <div className="mt-3 flex gap-2">
                  <Button variant="teal" disabled={busyId === r.id} onClick={() => decide(r.id, "approve")} className="flex-1">
                    <CheckCircle size={16} /> Setujui
                  </Button>
                  <Button variant="danger" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")} className="flex-1">
                    <XCircle size={16} /> Tolak
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-ink/45">
                  {r.status === "APPROVED" ? "Disetujui" : "Ditolak"} oleh {r.decidedBy ?? "—"}
                  {r.decidedAt ? ` · ${new Date(r.decidedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                  {r.decisionNote ? ` · "${r.decisionNote}"` : ""}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = { PENDING: "Menunggu", APPROVED: "Disetujui", REJECTED: "Ditolak" };

function fmtVal(key: string, v: unknown) {
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (v === null || v === "") return "—";
  if (MONEY_FIELDS.includes(key) && !isNaN(Number(v))) return formatIDR(Number(v));
  return String(v);
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

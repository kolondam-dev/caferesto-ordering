"use client";

import { formatIDR } from "@/lib/constants";

export type ReceiptData = {
  cafeName: string;
  code: string;
  tableName?: string | null;
  createdAt: string;
  closedAt?: string | null;
  items: { nameSnapshot: string; qty: number; price: number; status: string }[];
  bill: { subtotal: number; serviceFee: number; tax: number; total: number; deposit: number; settled: number; due: number };
  payments: { payerName?: string | null; amount: number; provider: string; status: string }[];
};

/**
 * Template struk 80mm — satu sumber untuk: preview & cetak browser di POS,
 * download struk customer, dan (bentuk teksnya) thermal printer ESC/POS.
 */
export default function Receipt({ data }: { data: ReceiptData }) {
  const items = data.items.filter((i) => i.status !== "CANCELED");
  const when = new Date(data.closedAt ?? data.createdAt).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="receipt-print mx-auto w-[300px] bg-white p-4 font-mono text-[12px] leading-relaxed text-black">
      <div className="text-center">
        <p className="text-base font-bold">{data.cafeName}</p>
        <p>{data.tableName ?? "Takeaway"} · {data.code}</p>
        <p>{when}</p>
      </div>
      <Hr />
      {items.map((i, idx) => (
        <div key={idx} className="flex justify-between gap-2">
          <span className="min-w-0 flex-1">
            {i.qty}x {i.nameSnapshot}
          </span>
          <span className="shrink-0">{formatIDR(i.price * i.qty)}</span>
        </div>
      ))}
      <Hr />
      <Row label="Subtotal" value={data.bill.subtotal} />
      {data.bill.serviceFee > 0 && <Row label="Service fee" value={data.bill.serviceFee} />}
      <Row label="Pajak" value={data.bill.tax} />
      {data.bill.deposit > 0 && <Row label="Deposit booking" value={-data.bill.deposit} />}
      <div className="flex justify-between font-bold">
        <span>TOTAL</span>
        <span>{formatIDR(data.bill.total - data.bill.deposit)}</span>
      </div>
      {data.payments.filter((p) => p.status === "SETTLED").length > 0 && (
        <>
          <Hr />
          {data.payments
            .filter((p) => p.status === "SETTLED")
            .map((p, idx) => (
              <Row key={idx} label={`${p.payerName ?? "Pembayaran"} (${p.provider})`} value={p.amount} />
            ))}
        </>
      )}
      <Hr />
      <p className="text-center font-bold">{data.bill.due <= 0 ? "*** LUNAS ***" : `SISA: ${formatIDR(data.bill.due)}`}</p>
      <p className="mt-2 text-center">Terima kasih sudah mampir! 🌅</p>
    </div>
  );
}

function Hr() {
  return <div className="my-1.5 border-t border-dashed border-black" />;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="min-w-0 flex-1">{label}</span>
      <span className="shrink-0">{formatIDR(value)}</span>
    </div>
  );
}

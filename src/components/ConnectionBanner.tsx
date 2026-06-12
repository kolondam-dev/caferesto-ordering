"use client";

import { useEffect, useState } from "react";
import { WifiSlash } from "@phosphor-icons/react";
import { subscribeConnection, type ConnectionState } from "@/lib/client";

/**
 * Banner offline global — muncul saat jaringan putus / server tak terjangkau,
 * menampilkan waktu sinkron terakhir agar staf tahu data di layar mungkin basi.
 */
export default function ConnectionBanner() {
  const [conn, setConn] = useState<ConnectionState>({ online: true, lastSyncAt: null });

  useEffect(() => subscribeConnection(setConn), []);

  if (conn.online) return null;
  const last = conn.lastSyncAt
    ? new Date(conn.lastSyncAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-xs font-bold text-white">
      <WifiSlash size={16} weight="bold" className="shrink-0 animate-pulse" />
      Koneksi terputus — mencoba menghubungkan ulang…
      {last && <span className="font-normal text-white/80">(data terakhir {last})</span>}
    </div>
  );
}

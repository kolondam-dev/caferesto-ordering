"use client";

/**
 * Lapis resiliensi sisi client:
 * - Status koneksi global (online/offline + waktu sinkron terakhir) yang bisa
 *   di-subscribe komponen (ConnectionBanner).
 * - api(): auto-retry dengan backoff saat jaringan putus; setiap aksi tulis
 *   membawa X-Idempotency-Key sehingga retry tidak menggandakan efek.
 */

export type ConnectionState = { online: boolean; lastSyncAt: number | null };

let state: ConnectionState = { online: true, lastSyncAt: null };
const listeners = new Set<(s: ConnectionState) => void>();

function update(patch: Partial<ConnectionState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export function getConnectionState() {
  return state;
}

export function subscribeConnection(cb: (s: ConnectionState) => void) {
  listeners.add(cb);
  cb(state);
  return () => {
    listeners.delete(cb);
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => update({ online: true }));
  window.addEventListener("offline", () => update({ online: false }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRYABLE_STATUS = [502, 503, 504];

/** Fetch helper JSON in/out + retry + idempotency + pelaporan status koneksi. */
export async function api<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; retry?: boolean } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const isWrite = method !== "GET";
  const attempts = options.retry === false ? 1 : 3;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (isWrite) headers["X-Idempotency-Key"] = crypto.randomUUID();

  let lastError: Error = new Error("Gagal terhubung");
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      if (RETRYABLE_STATUS.includes(res.status) && attempt < attempts - 1) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      // Respons apa pun = server terjangkau
      update({ online: true, lastSyncAt: Date.now() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`);
      return data as T;
    } catch (e) {
      if (e instanceof ApiError) throw e; // error aplikasi: jangan retry/tandai offline
      update({ online: false });
      lastError = new Error("Koneksi terputus — periksa jaringan Anda lalu coba lagi");
      if (attempt < attempts - 1) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

class ApiError extends Error {}

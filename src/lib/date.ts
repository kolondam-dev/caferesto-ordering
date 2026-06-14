/** Util tanggal bersama (dipakai report-context & endpoint dashboard). */

/** Awal hari (00:00:00.000) dari tanggal tertentu (default: hari ini). */
export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Kunci tanggal "YYYY-MM-DD" (UTC) untuk bucket harian. */
export function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

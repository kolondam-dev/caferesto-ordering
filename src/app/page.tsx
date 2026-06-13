import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Storefront from "./Storefront";

/**
 * Akses langsung (tanpa scan QR) wajib login customer dulu — supaya tidak ada
 * alur buntu (lihat menu tapi tak bisa checkout). Jalur QR (/t, /o) tetap tanpa
 * login. Staff yang login juga boleh melihat storefront.
 */
export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/");
  return <Storefront />;
}

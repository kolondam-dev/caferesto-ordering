import { redirect } from "next/navigation";

/**
 * Registrasi customer kini menyatu dengan login (berbasis no HP + OTP WA).
 * Redirect ke /login sambil mempertahankan ?next.
 */
export default async function RegisterRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignOut, UserCircle, SquaresFour } from "@phosphor-icons/react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Card, Spinner } from "@/components/ui";
import CustomerShell from "@/components/CustomerShell";

type User = { sub: string; name: string; email: string; role: string; phone?: string };

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api<{ user: User | null }>("/api/auth/me").then((d) => setUser(d.user));
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <CustomerShell>
      <h1 className="mb-4 text-xl font-extrabold">Akun</h1>
      {user === undefined ? (
        <Spinner />
      ) : user === null ? (
        <Card className="p-6 text-center">
          <p className="mb-3 text-sm text-ink/60">Anda belum masuk.</p>
          <Button onClick={() => router.push("/login")}>Masuk / Daftar</Button>
        </Card>
      ) : (
        <Card className="max-w-md p-6">
          <div className="mb-4 flex items-center gap-3">
            <UserCircle size={48} weight="fill" className="text-sunset-400" />
            <div>
              <p className="font-extrabold">{user.name}</p>
              <p className="text-sm text-ink/50">{user.email || user.phone}</p>
              <p className="text-[11px] font-bold text-violet-700">{user.role}</p>
            </div>
          </div>
          {user.role !== "CUSTOMER" && (
            <Link href="/dashboard">
              <Button variant="secondary" full className="mb-2">
                <SquaresFour size={18} /> Buka Dashboard Staff
              </Button>
            </Link>
          )}
          <Button variant="outline" full onClick={logout}>
            <SignOut size={18} /> Keluar
          </Button>
        </Card>
      )}
    </CustomerShell>
  );
}

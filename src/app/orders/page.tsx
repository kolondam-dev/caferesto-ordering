"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Badge, Card, Empty, Money, Spinner } from "@/components/ui";
import CustomerShell from "@/components/CustomerShell";

type Order = {
  id: string; code: string; status: string; type: string; createdAt: string;
  table?: { name: string } | null;
  items: { price: number; qty: number; status: string }[];
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    api<{ orders: Order[] }>("/api/orders")
      .then((d) => setOrders(d.orders))
      .catch(() => setNeedLogin(true));
  }, []);

  return (
    <CustomerShell>
      <h1 className="mb-4 text-xl font-extrabold">Order Saya</h1>
      {needLogin ? (
        <Empty text="Masuk dulu untuk melihat order Anda" />
      ) : orders === null ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <Empty text="Belum ada order" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => {
            const subtotal = o.items.filter((i) => i.status !== "CANCELED").reduce((s, i) => s + i.price * i.qty, 0);
            return (
              <Link key={o.id} href={`/order/${o.id}`}>
                <Card className="flex items-center justify-between p-4 hover:border-sunset-300">
                  <div>
                    <p className="font-bold">
                      {o.code} {o.table ? `· ${o.table.name}` : "· Takeaway"}
                    </p>
                    <p className="text-xs text-ink/50">
                      {new Date(o.createdAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <Money value={subtotal} className="text-sm font-bold text-sunset-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={o.status} />
                    <CaretRight size={16} className="text-ink/30" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </CustomerShell>
  );
}

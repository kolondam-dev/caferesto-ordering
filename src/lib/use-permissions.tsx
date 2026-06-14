"use client";

import { createContext, useContext } from "react";

type PermCtx = { role: string; permissions: string[] };

const Ctx = createContext<PermCtx>({ role: "", permissions: [] });

export function PermProvider({
  role,
  permissions,
  children,
}: {
  role: string;
  permissions: string[];
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ role, permissions }}>{children}</Ctx.Provider>;
}

/** Hook akses RBAC sisi klien. `can(perm)` mencerminkan grant peran user aktif. */
export function usePerms() {
  const { role, permissions } = useContext(Ctx);
  const can = (perm: string) => role === "OWNER" || permissions.includes(perm);
  return { role, permissions, can };
}

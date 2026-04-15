"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton({ label = "Log out" }: { label?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    router.push("/login");
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
      {label}
    </Button>
  );
}

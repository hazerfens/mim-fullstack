"use client";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/actions/auth-action";
import { useRouter } from "next/navigation";
import { clearClientSession } from "@/lib/session-helpers";

export function UserStatus() {
  const { user, isLoading, refreshSession } = useSession();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logoutAction();
      clearClientSession(); // Zustand store'u temizle
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handleRefresh = async () => {
    await refreshSession();
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <div>Not logged in</div>;
  }

  return (
    <div className="flex items-center gap-4">
      <div>
        <p>Welcome, {user.email}</p>
        <p>Role: {user.role}</p>
      </div>
      <Button onClick={handleRefresh} variant="outline" size="sm">
        Refresh Session
      </Button>
      <Button onClick={handleLogout} variant="destructive" size="sm">
        Logout
      </Button>
    </div>
  );
}
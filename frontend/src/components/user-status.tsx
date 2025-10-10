"use client";

import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useLogoutClient } from '@/stores/session-store';
import { useCompanyStore } from '@/stores/company-store';

export function UserStatus() {
  const { user, isLoading, refreshSession } = useSession();
  const router = useRouter();
  const logoutClient = useLogoutClient();
  const { clearCompanies } = useCompanyStore();

  const handleLogout = async () => {
    try {
      const res = await logoutClient();
      if (res.status !== 'success') {
        console.error('Logout failed', res.message);
        return;
      }
      clearCompanies();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error', error);
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
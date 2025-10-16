"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/features/actions/auth-action";
import { useCompanyStore } from "@/stores/company-store";


// User tipi tanımlaması
interface UserProps {
  id: string;
  name: string;
  email?: string;
  image?: string | null;
  image_url?: string | null;
  role: "customer" | "user" | "admin" | "super_admin";
}

interface UserMenuProps {
  user?: UserProps;
}

const UserMenu = ({ user }: UserMenuProps) => {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { clearCompanies } = useCompanyStore();

  // Memoized initial characters and role label for performance
  const initials = useMemo(() => {
    const raw = user?.name || user?.email || "";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1][0] ?? "")).toUpperCase();
  }, [user]);

  const roleLabel = useMemo(() => {
    const map: Record<string, string> = {
      customer: "Müşteri",
      user: "Kullanıcı",
      admin: "Yönetici",
      super_admin: "Süper Yönetici",
    };
    return map[user?.role ?? ""] ?? "Kullanıcı";
  }, [user?.role]);

  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      const res = await logoutAction();
      if (res.status !== 'success') {
        toast.error(res.message || 'Çıkış sırasında bir hata oluştu');
        setIsLoggingOut(false);
        return;
      }
      toast.success('Çıkış yapıldı');
      clearCompanies();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error', error);
      toast.error('Çıkış sırasında bir hata oluştu');
      setIsLoggingOut(false);
    }
  }, [router, clearCompanies]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
          <Link href="/auth/login" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Giriş Yap
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {/* Prefer `image`, fall back to `image_url`. Avoid passing empty string as src. */}
            <AvatarImage src={user.image ?? user.image_url ?? undefined} alt={user.name} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {roleLabel}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(user.role === "admin" || user.role === "super_admin") && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              <span>Yönetim Paneli</span>
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {/* Menu link items */}
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            <span>Profil</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/orders" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            <span>Siparişlerim</span>
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Ayarlar</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isLoggingOut ? 'Çıkış yapılıyor...' : 'Çıkış Yap'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { UserMenu };
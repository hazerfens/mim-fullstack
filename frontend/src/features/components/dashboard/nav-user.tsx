"use client";

import * as React from "react";
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSession } from "@/components/providers/session-provider";
import { logoutAction } from "@/features/actions/auth-action";
import { useRouter } from "next/navigation";
import { clearClientSession } from "@/lib/session-helpers";

export function NavUser() {
  const { user } = useSession();
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [imageError, setImageError] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const initials = React.useMemo(() => {
    if (user?.full_name) {
      return user.full_name
        .split(" ")
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2) || "CN";
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "CN";
  }, [user?.full_name, user?.email]);
  const showImage = Boolean(user?.image_url) && !imageError;

  React.useEffect(() => {
    setImageError(false);
  }, [user?.image_url]);

  const handleLogout = React.useCallback(async () => {
    try {
      setIsLoggingOut(true);
      await logoutAction();
      clearClientSession(); // Zustand store'u temizle
      toast.success("Çıkış yapıldı");
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error("Logout error", error);
      toast.error("Çıkış sırasında bir hata oluştu");
      setIsLoggingOut(false);
    }
  }, [router]);

  const AvatarVisual = () => (
    <Avatar className="h-8 w-8 rounded-lg">
      {showImage ? (
        <Image
          src={user?.image_url as string}
          alt={user?.full_name || user?.email || "Kullanıcı avatarı"}
          fill
          sizes="32px"
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
      )}
    </Avatar>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <AvatarVisual />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user?.full_name}</span>

                <span className="truncate text-xs">{user?.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <AvatarVisual />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {user?.full_name}
                  </span>
                  <span className="truncate text-xs">{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isLoggingOut}
              onSelect={(event) => {
                event.preventDefault();
                if (!isLoggingOut) {
                  void handleLogout();
                }
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

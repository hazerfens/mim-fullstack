"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCompanyStore } from "@/stores/company-store";
import { useSessionStore } from '@/stores/session-store'
import { useSession } from "@/components/providers/session-provider";
import { toast } from "sonner";

export default function DashboardGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useSession();

  const { companies, activeCompany, clearCompanies } = useCompanyStore();

  React.useEffect(() => {
    // Only run for dashboard routes
    if (!pathname || !pathname.startsWith("/dashboard")) return;

    // Wait until session is loaded
    if (isLoading) return;

    // INITIALIZATION: if store not yet initialized, clear it and mark initialized.
    // Do NOT redirect on this first pass — user landed on dashboard and we should
    // allow the page to show selection UI.
    if (!useCompanyStore.getState().initialized) {
      clearCompanies();
      useCompanyStore.getState().setInitialized(true);
      return;
    }

    // Post-initialization enforcement:
    // If activeCompany existed but no longer present in companies list => clear and redirect
    if (activeCompany && !companies.find((c) => c.id === activeCompany.id)) {
      clearCompanies();
      toast.error("Seçili şirket artık mevcut değil veya erişiminiz kaldırıldı. Lütfen yeni bir şirket seçin.");
      router.replace("/");
      return;
    }

    // If no activeCompany selected, restrict dashboard access for non-admins
    if (!activeCompany) {
      const role = user?.role || "";
      const isLoggedOut = useSessionStore.getState().isLoggedOut;
      if (role !== "super_admin" && role !== "admin") {
        // If the session is actively logging out, suppress the 'select a company' toast
        if (isLoggedOut) {
          clearCompanies();
          router.replace("/");
          return;
        }
        // Non-admin users must select a company first
        clearCompanies();
        toast.error("Dashboard'a erişmek için önce bir şirket seçin.");
        router.replace("/");
      }
    }
  }, [pathname, isLoading, user, activeCompany, companies, clearCompanies, router]);

  return null;
}

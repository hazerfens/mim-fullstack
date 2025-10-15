import React from "react";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { AppSidebar } from "@/features/components/dashboard/app-sidebar";
import MyBreadCrumbs from "@/features/components/dashboard/breadcrumbs";
import DashboardGuard from '@/features/components/dashboard/DashboardGuard';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Yönetim Paneli",
  description: "Mim Reklam yönetim paneli - Şirketlerinizi yönetin, reklam kampanyalarınızı takip edin ve raporlarınızı görüntüleyin.",
  robots: {
    index: false,
    follow: false,
  },
};

// import Image from "next/image";

const DashboardLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  

  return (
    <div>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex w-full items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex w-full items-center">
                <MyBreadCrumbs />
                <div className="ml-auto flex items-center gap-4">
                  <div className="flex items-center gap-x-2 text-xs cursor-pointer">
                  </div>
                </div>
              </div>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 p-4 md:min-h-min">
              <DashboardGuard />
              {children}
              
            </div>
          </div>{" "}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
};

export default DashboardLayout;
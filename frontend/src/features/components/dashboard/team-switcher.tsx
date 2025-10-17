"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Check, Loader2 } from "lucide-react"
import { useCompanyStore } from "@/stores/company-store"
import { toast } from "sonner"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser } from '@/hooks/use-session'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CreateCompanyForm } from "./settings/company/CreateCompanyForm"


export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const companies = useCompanyStore((state) => state.companies)
  const activeCompany = useCompanyStore((state) => state.activeCompany)
  const fetchCompanies = useCompanyStore((state) => state.fetchCompanies)
  const fetchActiveCompany = useCompanyStore((state) => state.fetchActiveCompany)
  const switchCompany = useCompanyStore((state) => state.switchCompany)
  const isLoading = useCompanyStore((state) => state.isLoading)

  const user = useUser()
  
  const [switching, setSwitching] = React.useState(false)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  // Fetch companies on mount. Only fetch active company if store not initialized
  React.useEffect(() => {
    // Only fetch companies if we don't already have them
    if (companies.length === 0) {
      fetchCompanies()
    }
    if (!(useCompanyStore.getState().initialized)) {
      fetchActiveCompany()
    }
    console.log('[team-switcher] Mounted/Updated with activeCompany:', activeCompany);
  }, [fetchCompanies, fetchActiveCompany, companies.length, activeCompany])

  const handleSwitchCompany = async (companyId: string) => {
    if (switching) return
    
    setSwitching(true)
    try {
      const res = await switchCompany(companyId)
      if (res.ok) {
        // Fetch confirmed active company from server and set it in store
  await fetchActiveCompany()
        const company = companies.find((c: { id: string }) => c.id === companyId)
        toast.success('Şirket değiştirildi', {
          description: `${company?.name || company?.unvani || 'Şirket'} aktif edildi`
        })
        // Refresh using Next.js router instead of full page reload
        router.refresh()
      } else {
        if (res.statusCode === 403) {
          toast.error(res.message || 'Bu şirkete erişiminiz yok');
          // Refresh company list to remove inaccessible entries
          await fetchCompanies();
          await fetchActiveCompany();
          router.refresh();
        } else {
          toast.error(res.message || 'Şirket değiştirme başarısız oldu');
        }
      }
    } catch (error) {
      toast.error('Hata', {
        description: error instanceof Error ? error.message : 'Şirket değiştirilemedi'
      })
    } finally {
      setSwitching(false)
    }
  }

  const handleCreateSuccess = async () => {
    setShowCreateDialog(false)
    
  // Refresh companies list and force refresh active company (we just created one)
  await fetchCompanies()
  await fetchActiveCompany(true)
    
    // Refresh using Next.js router instead of full page reload
    router.refresh()
  }

  // If no active company and no companies, show create prompt OR no permission message
  // If the current user is a system admin and there is no active company,
  // hide the TeamSwitcher (admins see system dashboard instead)
  if (!activeCompany && (user?.role === 'super_admin' || user?.role === 'admin')) {
    return null
  }

  if (!activeCompany && companies.length === 0 && !isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent cursor-default">
            <div className="bg-muted text-muted-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Building2 className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium text-muted-foreground">Yetkisiz Erişim</span>
              <span className="truncate text-xs text-muted-foreground">Şirket yetkiniz bulunmamaktadır</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Loading state
  if (isLoading && !activeCompany) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Yükleniyor...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={switching}
            >
              <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                {switching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : activeCompany?.logo ? (
                  <Image 
                    src={activeCompany.logo} 
                    alt={activeCompany.name || activeCompany.unvani || ''} 
                    width={32}
                    height={32}
                    className="size-8 object-contain" 
                  />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeCompany?.name || activeCompany?.unvani || 'Şirket Seçin'}
                </span>
                <span className="truncate text-xs capitalize">
                  Aktif Şirket
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Companies
            </DropdownMenuLabel>
            {companies.map((company: { id: string; logo?: string; name?: string; unvani?: string }) => (
              <DropdownMenuItem
                key={company.id}
                onClick={() => handleSwitchCompany(company.id)}
                className="gap-2 p-2"
                disabled={switching}
              >
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  {company.logo ? (
                    <Image 
                      src={company.logo} 
                      alt={company.name || company.unvani || ''} 
                      width={16}
                      height={16}
                      className="size-4 object-contain" 
                    />
                  ) : (
                    <Building2 className="size-3.5 shrink-0" />
                  )}
                </div>
                <div className="flex-1 truncate">
                  {company.name || company.unvani || 'İsimsiz Şirket'}
                </div>
                {activeCompany?.id === company.id && (
                  <Check className="ml-auto size-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <DropdownMenuItem key="create-new-company" onSelect={(e) => e.preventDefault()} className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground font-medium">Yeni Şirket</div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="min-w-6xl w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4">
                  <DialogTitle className="text-2xl">Yeni Şirket Oluştur</DialogTitle>
                  <DialogDescription>
                    Şirket bilgilerinizi girin ve hızlıca başlayın
                  </DialogDescription>
                </DialogHeader>
                <CreateCompanyForm 
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setShowCreateDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

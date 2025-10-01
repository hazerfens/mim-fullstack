"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Building2, Check, Loader2 } from "lucide-react"
import { useCompanyStore, useActiveCompany, useCompanies } from "@/stores/company-store"
import { toast } from "sonner"
import Image from "next/image"
import { getAccessToken } from "@/lib/auth-utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { CreateCompanyForm } from "@/features/components/dashboard/settings/company/CreateCompanyForm"

export function TeamSwitcher() {
  const { isMobile } = useSidebar()
  const companies = useCompanies()
  const activeCompany = useActiveCompany()
  const { fetchCompanies, fetchActiveCompany, switchCompany, loading } = useCompanyStore()
  
  const [switching, setSwitching] = React.useState(false)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)

  // Fetch companies on mount
  React.useEffect(() => {
    const token = getAccessToken()
    if (token) {
      fetchCompanies(token)
      fetchActiveCompany(token)
    }
  }, [fetchCompanies, fetchActiveCompany])

  const handleSwitchCompany = async (companyId: string) => {
    const token = getAccessToken()
    if (!token || switching) return
    
    setSwitching(true)
    try {
      await switchCompany(token, companyId)
      const company = companies.find(c => c.id === companyId)
      toast.success('Şirket değiştirildi', {
        description: `${company?.adi || company?.unvani || 'Şirket'} aktif edildi`
      })
      
      // Reload the page to refresh company-specific data
      window.location.reload()
    } catch (error) {
      toast.error('Hata', {
        description: error instanceof Error ? error.message : 'Şirket değiştirilemedi'
      })
    } finally {
      setSwitching(false)
    }
  }

  const handleCreateSuccess = async () => {
    const token = getAccessToken()
    setShowCreateDialog(false)
    
    if (token) {
      // Refresh companies list
      await fetchCompanies(token)
      await fetchActiveCompany(token)
    }
    
    // Reload to update company context
    window.location.reload()
  }

  // If no active company and no companies, show create prompt
  if (!activeCompany && companies.length === 0 && !loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Şirket Oluştur</span>
                  <span className="truncate text-xs text-muted-foreground">İlk şirketinizi oluşturun</span>
                </div>
                <Plus className="ml-auto" />
              </SidebarMenuButton>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Yeni Şirket Oluştur</DialogTitle>
                <DialogDescription>
                  İlk şirketinizi oluşturarak başlayın
                </DialogDescription>
              </DialogHeader>
              <CreateCompanyForm 
                onSuccess={handleCreateSuccess}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Loading state
  if (loading && !activeCompany) {
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
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                {switching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeCompany?.adi || activeCompany?.unvani || 'Şirket Seçin'}
                </span>
                <span className="truncate text-xs capitalize">
                  {activeCompany?.plan_type || 'free'} plan
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
              Şirketlerim
            </DropdownMenuLabel>
            {companies.map((company) => (
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
                      alt={company.adi || company.unvani || ''} 
                      width={16}
                      height={16}
                      className="size-4 object-contain" 
                    />
                  ) : (
                    <Building2 className="size-3.5 shrink-0" />
                  )}
                </div>
                <div className="flex-1 truncate">
                  {company.adi || company.unvani || 'İsimsiz Şirket'}
                </div>
                {activeCompany?.id === company.id && (
                  <Check className="ml-auto size-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground font-medium">Yeni Şirket</div>
                </DropdownMenuItem>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Yeni Şirket Oluştur</DialogTitle>
                  <DialogDescription>
                    Yeni bir şirket hesabı oluşturun
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

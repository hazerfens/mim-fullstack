"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { UserRoleAssignment } from "@/features/components/dashboard/settings/roles/UserRoleAssignment"
import { getCompanyMembers, removeMember, type CompanyMember } from "@/features/actions/company-member-action"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Trash } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
}

export default function OrphanedMembersModal({ open, onOpenChange, companyId }: Props) {
  const [orphaned, setOrphaned] = useState<CompanyMember[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toDelete, setToDelete] = useState<CompanyMember[] | null>(null)
  const [allMembers, setAllMembers] = useState<CompanyMember[]>([])
  const [ignoredIds, setIgnoredIds] = useState<string[]>([])

  const loadOrphaned = useCallback(async () => {
    const res = await getCompanyMembers(companyId)
    if (res.success && res.data) {
      setAllMembers(res.data)
      const orph = res.data.filter((m: CompanyMember) => m.user_exists === false || m.user == null)
      setOrphaned(orph)
    }
  }, [companyId])

  useEffect(() => {
    if (open) loadOrphaned()
  }, [open, loadOrphaned])

  // Deletion is handled via a confirmation dialog (see confirmOpen / toDelete)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>Problemli Kayıt Yapılan Üyeler - {orphaned.length} adet</DialogTitle>
            <div className="flex items-center gap-2">
              
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <Tabs defaultValue="roles">
            <TabsList>
              <TabsTrigger value="roles">Kullanıcı Rol</TabsTrigger>
              <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
              <TabsTrigger value="problems">Problemli Kullanıcılar</TabsTrigger>
            </TabsList>

            <TabsContent value="roles">
              {/* Show all company users here but highlight problem records */}
              <UserRoleAssignment onUpdate={loadOrphaned} companyId={companyId} />
            </TabsContent>

            <TabsContent value="overview">
              {/* Show matrix and an explicit orphaned list with actions */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Orphaned Üyeler</h3>
                  {orphaned.length === 0 ? (
                    <div className="text-muted-foreground text-sm">Orphaned üye bulunmuyor</div>
                  ) : (
                    <div className="grid gap-2 mt-2">
                      {orphaned.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-4 p-2 border rounded">
                          <div>
                            <div className="font-medium">{m.user?.full_name || m.user_id}</div>
                            <div className="text-xs text-muted-foreground">{m.user?.email || 'E-posta yok'}</div>
                          </div>
                          <div>
                            <Button variant="destructive" size="sm" className="flex items-center gap-2 min-w-[96px]" onClick={() => { setToDelete([m]); setConfirmOpen(true); }}>
                              <Trash className="h-4 w-4" /> Üyeyi Sil
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold">Genel İzin Matrisi</h3>
                  <div className="text-sm text-muted-foreground mt-2">
                    İzin matrisi artık Casbin tabanlı sistem ile yönetilmektedir. 
                    Kullanıcı özel izinleri için Ayarlar &gt; Roller bölümünü kullanın.
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="problems">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Problemli Kullanıcılar</h3>
                {allMembers.length === 0 ? (
                  <div className="text-muted-foreground text-sm">Yükleniyor...</div>
                ) : (
                  <div className="grid gap-2">
                    {(() => {
                      // Compute problems: orphaned, missing email, duplicate emails, inactive
                      const emailCounts: Record<string, number> = {}
                      for (const m of allMembers) {
                        const e = m.user?.email || ''
                        if (e) emailCounts[e] = (emailCounts[e] || 0) + 1
                      }

                      const problems = allMembers.filter((m) => {
                        if (ignoredIds.includes(m.id)) return false
                        if (!m.user) return true
                        if (!m.user.email) return true
                        if (emailCounts[m.user.email] > 1) return true
                        if (!m.is_active) return true
                        return false
                      })

                      if (problems.length === 0) return (<div className="text-muted-foreground">Tespit edilmiş problem yok</div>)

                      return problems.map((m) => {
                        const issues: string[] = []
                        if (!m.user) issues.push('Orphaned')
                        if (!m.user?.email) issues.push('E-posta yok')
                        if (m.user?.email && emailCounts[m.user.email] > 1) issues.push('Çift e-posta')
                        if (!m.is_active) issues.push('Pasif')

                        return (
                          <div key={m.id} className="flex items-center justify-between gap-4 p-2 border rounded">
                            <div>
                              <div className="font-medium">{m.user?.full_name || m.user_id}</div>
                              <div className="text-xs text-muted-foreground">{m.user?.email || 'E-posta yok'}</div>
                              <div className="text-xs mt-1 flex gap-2">
                                {issues.map((i) => (
                                  <span key={i} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{i}</span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => { setToDelete([m]); setConfirmOpen(true) }} className="min-w-[84px] flex items-center gap-2"><Trash className="h-4 w-4"/>Sil</Button>
                              <Button size="sm" variant="outline" onClick={() => setIgnoredIds((s) => s.includes(m.id) ? s.filter(id => id !== m.id) : [...s, m.id])}>{ignoredIds.includes(m.id) ? 'İşaret Kaldır' : 'İşaretle'}</Button>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
      {/* Confirmation dialog for bulk or individual deletes */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Silme Onayı</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="mb-2">Aşağıdaki {toDelete?.length || 0} kayıt silinecek:</p>
            <ul className="max-h-48 overflow-auto list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {toDelete?.map((t) => (
                <li key={t.id}>
                  <div className="font-medium">{t.user?.full_name || t.user_id}</div>
                  <div className="text-xs">{t.user?.email || 'E-posta yok'}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setToDelete(null) }}>İptal</Button>
            <Button variant="destructive" onClick={async () => {
              if (!toDelete || toDelete.length === 0) return
              toast.loading('Siliniyor...')
              let success = 0
              let fail = 0
              for (const m of toDelete) {
                const res = await removeMember(companyId, m.id)
                if (res.success) {
                  success++
                } else {
                  fail++
                }
              }
              toast.dismiss()
              if (fail === 0) {
                toast.success(`${success} kayıt silindi`)
              } else {
                toast.error(`${success} silindi, ${fail} hata`)
              }
              setConfirmOpen(false)
              setToDelete(null)
              await loadOrphaned()
            }}><Trash className="h-4 w-4 mr-2" /> Sil</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

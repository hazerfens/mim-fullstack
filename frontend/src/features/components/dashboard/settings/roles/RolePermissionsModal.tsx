'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Shield, Plus, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getCompanyRolePermissionsAction,
  createCompanyRolePermissionAction,
  updateCompanyRolePermissionAction,
  getRolePermissionsAction,
  createRolePermissionAction,
  updateRolePermissionAction,
  getPermissionCatalogAction,
  updateRoleAction,
  type RolePermission,
} from '@/features/actions/settings/roles/role-actions'
import type { Role } from '@/features/actions/settings/roles/role-actions'
import type { PermissionCatalogEntry, Permissions, PermissionDetail } from '@/lib/permissions'

interface Props {
  role: Role | null
  companyId?: string | null
  open: boolean
  onClose: () => void
  // Optional resource options allows parent to pass dynamic model/resource list
  resources?: { value: string; label: string }[]
}

// Resource list will be populated from permission catalog when available

const actions = [
  { value: 'create', label: 'Oluştur (C)' },
  { value: 'read', label: 'Oku (R)' },
  { value: 'update', label: 'Güncelle (U)' },
  { value: 'delete', label: 'Sil (D)' },
]

interface TimeRestriction {
  allowed_days?: number[]
  start_time?: string
  end_time?: string
  start_date?: string | null
  end_date?: string | null
}

interface RolePermissionConditions {
  time_restriction?: TimeRestriction
  allowed_ips?: string[]
}

interface NewPermissionForm {
  resource: string
  action: string
  domain: string
  is_active: boolean
  effect: string
  priority: number
  useTimeRestriction: boolean
  timeRestriction: TimeRestriction
  allowedIpsRaw: string
}

export const RolePermissionsModal: React.FC<Props> = ({ role, companyId, open, onClose, resources: resourcesProp }) => {
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const [newPermission, setNewPermission] = useState<NewPermissionForm>({
    resource: '',
    action: '',
    domain: companyId ? `company:${companyId}` : '*',
    is_active: true,
    effect: 'allow',
    priority: 0,
    useTimeRestriction: false,
    timeRestriction: { allowed_days: [], start_time: '08:00', end_time: '18:00' },
    allowedIpsRaw: '',
  })

  const [resourceOptions, setResourceOptions] = useState<{ value: string; label: string }[]>(resourcesProp || [])
  const [resourcesLoading, setResourcesLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    // If parent provided resources, do not fetch catalog
    if (resourcesProp) return
    let cancelled = false
    ;(async () => {
      setResourcesLoading(true)
      try {
        const res = await getPermissionCatalogAction()
        if (res.status === 'success' && Array.isArray(res.permissions) && res.permissions.length > 0) {
          // Derive base resource names (split on ':' or '.') and keep unique
          const map = new Map<string, PermissionCatalogEntry>()
          res.permissions.forEach((entry: PermissionCatalogEntry) => {
            const raw = entry.name || ''
            const base = raw.includes(':') ? raw.split(':')[0] : raw.includes('.') ? raw.split('.')[0] : raw
            if (!map.has(base)) map.set(base, entry)
          })
          const opts = Array.from(map.entries()).map(([base, entry]) => ({ value: base, label: entry.display_name || base }))
          if (!cancelled) setResourceOptions(opts)
        }
      } catch (err) {
        // ignore — keep default
        console.error('Failed to load permission catalog for resources', err)
      } finally {
        if (!cancelled) setResourcesLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, resourcesProp])

  useEffect(() => {
    if (open && role) {
      fetchPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, role])

  const fetchPermissions = async () => {
    if (!role) return
    setLoading(true)
    try {
      const res = companyId ? await getCompanyRolePermissionsAction(companyId, role.id) : await getRolePermissionsAction(role.id)
      if (res.status === 'success') {
        setPermissions(res.permissions || [])
      } else {
        toast.error('Rol izinleri yüklenemedi')
      }
    } catch (err) {
      console.error('fetchPermissions error', err)
      toast.error('Rol izinleri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!role) return
    if (!newPermission.resource || !newPermission.action) {
      toast.error('Kaynak ve işlem gerekli')
      return
    }

    setSaving(true)
    try {
  const conditions: RolePermissionConditions = {}
      if (newPermission.useTimeRestriction) {
        conditions.time_restriction = newPermission.timeRestriction
      }
  const ips = newPermission.allowedIpsRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
      if (ips.length > 0) conditions.allowed_ips = ips

      const payload = {
        resource: newPermission.resource,
        action: newPermission.action,
        domain: newPermission.domain,
        conditions: Object.keys(conditions).length > 0 ? conditions : null,
        is_active: newPermission.is_active,
        effect: newPermission.effect,
        priority: newPermission.priority,
      }

      const res = companyId ? await createCompanyRolePermissionAction(companyId, role.id, payload) : await createRolePermissionAction(role.id, payload)
      if (res.status === 'success') {
        toast.success('Rol izni oluşturuldu')
        fetchPermissions()
        setShowAddForm(false)
        setNewPermission({ ...newPermission, resource: '', action: '', allowedIpsRaw: '' })
      } else {
        toast.error(res.message || 'Rol izni oluşturulamadı')
      }
    } catch (err) {
      console.error('handleCreate error', err)
      toast.error('Rol izni oluşturulurken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (perm: RolePermission, checked: boolean) => {
    if (!role) return
    setSaving(true)
    try {
      // Prefer updating the canonical role.permissions via PUT so the
      // aggregate permission matrix and other UI that reads role.permissions
      // are kept in sync. Build an updated permissions blob reflecting the
      // toggle and call updateRoleAction. If updateRoleAction fails, fall
      // back to toggling the persisted row via PATCH.
      const currentPermissions = (role.permissions || {}) as Permissions
      const resourceDetail = (currentPermissions as unknown as Record<string, PermissionDetail | undefined>)[perm.resource] || {}
      const updatedPermissions: Permissions = {
        ...currentPermissions,
        [perm.resource]: {
          ...(resourceDetail as PermissionDetail),
          [perm.action]: checked
        }
      }

      const result = await updateRoleAction(role.id, {
        name: role.name,
        description: role.description,
        permissions: updatedPermissions,
        is_active: role.is_active
      }, companyId ?? undefined)

      if (result.status === 'success') {
        toast.success('İzin durumu güncellendi')
        // refresh permissions and persisted rows
        fetchPermissions()
      } else {
        // Fallback to row-level PATCH if PUT didn't work for this case
        try {
          const payload = { is_active: checked }
          const res = companyId ? await updateCompanyRolePermissionByIdAction(companyId, role.id, perm.id, payload) : await updateRolePermissionByIdAction(role.id, perm.id, payload)
          if (res.status === 'success') {
            toast.success('İzin durumu güncellendi')
            fetchPermissions()
          } else {
            toast.error(res.message || 'Güncelleme başarısız')
          }
        } catch (err) {
          console.error('toggle fallback error', err)
          toast.error('Güncelleme sırasında hata oluştu')
        }
      }
    } catch (err) {
      console.error('toggle error', err)
      toast.error('Güncelleme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="w-full max-w-[96vw] sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Rol İzinleri - {role?.name}
          </DialogTitle>
          <DialogDescription>Rol için koşullu izinler oluşturun ve yönetin.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 flex-1 overflow-hidden px-2">
          {/* Left: permissions list (scrollable) */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto pr-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : permissions.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Bu role ait ek izin bulunmamaktadır</p>
                  <Button type="button" onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Yeni Ek İzin
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Mevcut Ek İzinler</h3>
                    <Badge variant="secondary">{permissions.length} izin</Badge>
                  </div>

                  {permissions.map((p) => (
                    <div key={p.id} className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="font-mono">{p.resource}.{p.action}</Badge>
                            <Badge variant={p.is_active ? 'default' : 'destructive'}>{p.is_active ? 'Aktif' : 'Pasif'}</Badge>
                          </div>

                          {p.domain && <div className="text-xs text-muted-foreground">Domain: {p.domain}</div>}

                          {/* Show conditions if present */}
                          {p.conditions && (
                            <div className="text-sm text-muted-foreground mt-2">
                              {/* conditions is an object with time_restriction and allowed_ips */}
                              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(p.conditions, null, 2)}</pre>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch checked={p.is_active} onCheckedChange={(v) => handleToggle(p, v)} disabled={saving} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: sticky create form */}
          <div className="w-96 shrink-0">
            <div className="sticky top-4">
              {!showAddForm ? (
                <Button type="button" onClick={() => setShowAddForm(true)} variant="outline" className="w-full mb-2">
                  <Plus className="h-4 w-4 mr-2" /> Yeni Ek İzin Ekle
                </Button>
              ) : (
                <div className="border rounded-md p-4 bg-card">
                  <h4 className="font-semibold mb-3">Yeni Ek İzin</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>
                        Kaynak *
                        {resourcesLoading && <Loader2 className="inline-block h-4 w-4 ml-2 animate-spin text-muted-foreground" />}
                      </Label>
                      <Select value={newPermission.resource} onValueChange={(v) => setNewPermission({ ...newPermission, resource: v })}>
                        <SelectTrigger><SelectValue placeholder="Kaynak seçin..." /></SelectTrigger>
                        <SelectContent>
                          {resourceOptions.length === 0 ? (
                                <SelectItem key="no-resources" value="__no_resources__" disabled>
                                  İzin kaynağı bulunamadı
                                </SelectItem>
                              ) : (
                            resourceOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>İşlem *</Label>
                      <Select value={newPermission.action} onValueChange={(v) => setNewPermission({ ...newPermission, action: v })}>
                        <SelectTrigger><SelectValue placeholder="İşlem seçin..." /></SelectTrigger>
                        <SelectContent>
                          {actions.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Domain</Label>
                      <Input value={newPermission.domain} onChange={(e) => setNewPermission({ ...newPermission, domain: e.target.value })} />
                      <p className="text-xs text-muted-foreground">Varsayılan: {companyId ? `company:${companyId}` : '*'}</p>
                    </div>

                    <div>
                      <Label>Allowed IPs (virgülle ayrılmış)</Label>
                      <Input value={newPermission.allowedIpsRaw} onChange={(e) => setNewPermission({ ...newPermission, allowedIpsRaw: e.target.value })} placeholder="10.0.0.1, 192.168.1.0/24" />
                      <p className="text-xs text-muted-foreground">Boş bırakırsanız IP kısıtlaması olmaz</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5"><Label>İzin Aktif mi?</Label><p className="text-xs text-muted-foreground">Bu izin aktifse Casbin politikasına eklenecektir</p></div>
                      <Switch checked={newPermission.is_active} onCheckedChange={(v) => setNewPermission({ ...newPermission, is_active: v })} />
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5"><Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Zaman Kısıtlaması</Label><p className="text-xs text-muted-foreground">Hafta günleri ve saat aralığı</p></div>
                        <Switch checked={newPermission.useTimeRestriction} onCheckedChange={(v) => setNewPermission({ ...newPermission, useTimeRestriction: v })} />
                      </div>

                      {newPermission.useTimeRestriction && (
                        <div className="space-y-2 mt-2">
                          <Input type="time" value={newPermission.timeRestriction.start_time} onChange={(e) => setNewPermission({ ...newPermission, timeRestriction: { ...newPermission.timeRestriction, start_time: e.target.value } })} />
                          <Input type="time" value={newPermission.timeRestriction.end_time} onChange={(e) => setNewPermission({ ...newPermission, timeRestriction: { ...newPermission.timeRestriction, end_time: e.target.value } })} />
                        </div>
                      )}
                    </div>

                    <Button type="button" onClick={handleCreate} disabled={saving} className="w-full">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Oluştur</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowAddForm(false)} className="w-full mt-2">Kapat</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RolePermissionsModal

'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Shield, Loader2 } from 'lucide-react'
import TimeInput from '@/components/ui/time-input'
import { toast } from 'sonner'
import {
  createUserCustomPermissionAction,
  updateUserCustomPermissionAction,
  type UserPermission,
  type TimeRestriction,
} from '@/features/actions/settings/roles/user-permission-actions'
import { getPermissionCatalogAction } from '@/features/actions/settings/roles/role-actions'
import type { PermissionCatalogEntry } from '@/lib/permissions'
import type { User } from '@/features/actions/settings/roles/role-actions'

interface UserPermissionsModalProps {
  user: User
  onClose: () => void
  resources?: { value: string; label: string }[]
  initialPermission?: UserPermission | null
}

// Resource list will be populated from permission catalog when available

const actions = [
  { value: 'create', label: 'Oluştur (C)', short: 'C' },
  { value: 'read', label: 'Oku (R)', short: 'R' },
  { value: 'update', label: 'Güncelle (U)', short: 'U' },
  { value: 'delete', label: 'Sil (D)', short: 'D' },
]


export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({ user, onClose, resources: resourcesProp, initialPermission }) => {
  const [saving, setSaving] = useState(false)
  // We only show the form inside the modal; permission listing is handled by the caller (accordion)
  // The modal receives an optional initialPermission for edit mode.
  const [editingPermission, setEditingPermission] = useState<UserPermission | null>(null)

  // New permission form state
  const [newPermission, setNewPermission] = useState({
    resource: '',
    action: '',
    is_allowed: true,
    priority: 10,
    useTimeRestriction: false,
    timeRestriction: {
      allowed_days: [] as number[],
      start_time: '08:00',
      end_time: '18:00',
    } as TimeRestriction,
    allowedIpsRaw: '',
  })

  const [resourceOptions, setResourceOptions] = useState<{ value: string; label: string }[]>(resourcesProp || [])
  const [resourcesLoading, setResourcesLoading] = useState(false)

  useEffect(() => {
    if (resourcesProp) return
    let cancelled = false
    ;(async () => {
      setResourcesLoading(true)
      try {
        const res = await getPermissionCatalogAction()
        if (res.status === 'success' && Array.isArray(res.permissions) && res.permissions.length > 0) {
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
        console.error('Failed to load permission catalog for user modal', err)
      } finally { if (!cancelled) setResourcesLoading(false) }
    })()
    return () => { cancelled = true }
  }, [resourcesProp])

  // No local permission fetch — listing lives in the users accordion/parent

  useEffect(() => {
    if (initialPermission) {
      const ip = initialPermission as UserPermission
      setEditingPermission(ip)
      // Prefill form for edit
      setNewPermission({
        resource: ip.resource,
        action: ip.action,
        is_allowed: ip.is_allowed,
        priority: ip.priority || 10,
        useTimeRestriction: !!ip.time_restriction,
        timeRestriction: ip.time_restriction || { allowed_days: [], start_time: '08:00', end_time: '18:00' },
        allowedIpsRaw: ip.allowed_ips ? ip.allowed_ips.join(', ') : '',
      })
    }
  }, [initialPermission])

  // permission listing removed from modal; parent component is responsible for loading

  const handleAddPermission = async () => {
    if (!newPermission.resource || !newPermission.action) {
      toast.error('Kaynak ve işlem seçimi zorunludur')
      return
    }

    setSaving(true)
    try {
      const ips = (newPermission.allowedIpsRaw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const data = {
        resource: newPermission.resource,
        action: newPermission.action,
        is_allowed: newPermission.is_allowed,
        priority: newPermission.priority,
        time_restriction: newPermission.useTimeRestriction ? newPermission.timeRestriction : null,
        allowed_ips: ips.length > 0 ? ips : undefined,
      }
      if (editingPermission) {
        // Update flow
        const result = await updateUserCustomPermissionAction(user.id, editingPermission.id, data)
        if (result.status === 'success') {
          toast.success('✅ İzin başarıyla güncellendi')
          resetNewPermission()
          setEditingPermission(null)
          // Close modal so parent can refresh the listing in the accordion
          onClose()
          return
        } else {
          toast.error('❌ İzin güncellenemedi', { description: result.message })
        }
      } else {
        const result = await createUserCustomPermissionAction(user.id, data)
        if (result.status === 'success') {
          toast.success('✅ İzin başarıyla eklendi')
          resetNewPermission()
          // Close modal so parent can refresh the listing in the accordion
          onClose()
          return
        } else {
          toast.error('❌ İzin eklenemedi', {
            description: result.message,
          })
        }
      }
    } catch (error) {
      console.error('Error adding permission:', error)
      toast.error('İzin eklenirken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  // Deletion handled by parent listing; modal focuses on create/update only

  const resetNewPermission = () => {
    setNewPermission({
      resource: '',
      action: '',
      is_allowed: true,
      priority: 10,
      useTimeRestriction: false,
      timeRestriction: {
        allowed_days: [],
        start_time: '08:00',
        end_time: '18:00',
      },
      allowedIpsRaw: '',
    })
  }

  // week day toggling intentionally left out for compact UI; can be added later

  return (
    <Dialog open={true} onOpenChange={onClose}>
  <DialogContent className="w-full max-w-[96vw] sm:max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Özel İzinler - {user.first_name} {user.last_name}
          </DialogTitle>
          <DialogDescription>
            Bu kullanıcıya özel zaman bazlı izinler tanımlayın. Özel izinler rol izinlerini geçersiz kılar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-3">
          <div className="mx-auto w-full">
            <div className="border rounded-md p-4 bg-card">
              <h4 className="font-semibold mb-3">{editingPermission ? 'Özel İzni Düzenle' : 'Yeni Özel İzin'}</h4>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className='flex flex-col gap-3'>
                    <Label>
                      Kaynak
                      {resourcesLoading && <Loader2 className="inline-block h-4 w-4 ml-2 animate-spin text-muted-foreground" />}
                    </Label>
                    <Select value={newPermission.resource} onValueChange={(v) => setNewPermission({ ...newPermission, resource: v })} >
                      <SelectTrigger className='w-full'><SelectValue placeholder="Kaynak seçin..." /></SelectTrigger>
                      <SelectContent>
                        {resourceOptions.length === 0 ? (
                          <SelectItem key="no-resources" value="__no_resources__" disabled>İzin kaynağı bulunamadı</SelectItem>
                        ) : (
                          resourceOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='flex flex-col gap-3'>
                    <Label>İşlem</Label>
                    <Select value={newPermission.action} onValueChange={(v) => setNewPermission({ ...newPermission, action: v })}>
                      <SelectTrigger className='w-full'><SelectValue placeholder="İşlem seçin..." /></SelectTrigger>
                      <SelectContent>
                        {actions.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='flex flex-col gap-3'>
                  <Label>Allowed IPs</Label>
                  <Input value={newPermission.allowedIpsRaw} onChange={(e) => setNewPermission({ ...newPermission, allowedIpsRaw: e.target.value })} placeholder="10.0.0.1, 192.168.0.0/24" />
                </div>

                <div className='flex flex-col gap-3'>
                  <Label>Zaman Kısıtlaması</Label>
                  <div className="flex items-center gap-2">
                    <Switch checked={newPermission.useTimeRestriction} onCheckedChange={(v) => setNewPermission({ ...newPermission, useTimeRestriction: v })} />
                    <span className="text-xs text-muted-foreground">Aktif</span>
                  </div>
                  {newPermission.useTimeRestriction && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <TimeInput
                      id={`${user.id}-start-time`}
                      label="Başlangıç"
                      step={1}
                      value={newPermission.timeRestriction.start_time}
                      onChange={(v: string) => setNewPermission({ ...newPermission, timeRestriction: { ...newPermission.timeRestriction, start_time: v } })}
                    />
                      <TimeInput
                        id={`${user.id}-end-time`}
                        label="Bitiş"
                        step={1}
                        value={newPermission.timeRestriction.end_time}
                        onChange={(v: string) => setNewPermission({ ...newPermission, timeRestriction: { ...newPermission.timeRestriction, end_time: v } })}
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  <Button type="button" onClick={handleAddPermission} disabled={saving} className="flex-1">{editingPermission ? 'Güncelle' : 'Kaydet'}</Button>
                  <Button type="button" variant="ghost" onClick={() => { resetNewPermission(); setEditingPermission(null); onClose(); }} className="w-32">Kapat</Button>
                </div>
              </div>
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

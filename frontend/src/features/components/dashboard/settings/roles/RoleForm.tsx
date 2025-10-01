'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Shield, Check, X, Loader2 } from 'lucide-react'
import { createRoleAction, updateRoleAction, type Role, type Permissions, type PermissionDetail } from '@/features/actions/settings/roles/role-actions'
import { toast } from 'sonner'

interface RoleFormProps {
  role: Role | null
  onClose: () => void
}

const permissionResources = [
  { 
    key: 'users', 
    label: 'Kullanıcılar', 
    description: 'Kullanıcı CRUD işlemleri',
    actions: ['create', 'read', 'update', 'delete']
  },
  { 
    key: 'roles', 
    label: 'Roller', 
    description: 'Rol CRUD işlemleri',
    actions: ['create', 'read', 'update', 'delete']
  },
  { 
    key: 'settings', 
    label: 'Ayarlar', 
    description: 'Sistem ayarları yönetimi',
    actions: ['create', 'read', 'update', 'delete']
  },
  { 
    key: 'reports', 
    label: 'Raporlar', 
    description: 'Rapor görüntüleme ve oluşturma',
    actions: ['create', 'read', 'update', 'delete']
  },
]

const actionLabels: Record<string, string> = {
  create: 'Oluştur',
  read: 'Oku',
  update: 'Güncelle',
  delete: 'Sil',
}

export const RoleForm: React.FC<RoleFormProps> = ({ role, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    permissions: {} as Permissions,
  })

  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name,
        description: role.description || '',
        is_active: role.is_active,
        permissions: role.permissions || {},
      })
    }
  }, [role])

  const handlePermissionChange = (resource: string, action: string, enabled: boolean) => {
    setFormData((prev) => {
      const resourcePerms = prev.permissions[resource as keyof Permissions] || {} as PermissionDetail
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resource]: {
            ...resourcePerms,
            [action]: enabled,
          },
        },
      }
    })
  }

  const toggleAllPermissions = (resource: string, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [resource]: {
          create: enabled,
          read: enabled,
          update: enabled,
          delete: enabled,
        },
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (role) {
        await updateRoleAction(role.id, formData)
        toast.success('✅ Rol başarıyla güncellendi')
      } else {
        await createRoleAction(formData)
        toast.success('✅ Rol başarıyla oluşturuldu')
      }
      onClose()
    } catch (error) {
      console.error('Error submitting role:', error)
      toast.error(role ? '❌ Rol güncellenemedi' : '❌ Rol oluşturulamadı')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {role ? 'Rolü Düzenle' : 'Yeni Rol Oluştur'}
          </DialogTitle>
          <DialogDescription>
            {role ? 'Mevcut rolü düzenleyin ve izinlerini güncelleyin' : 'Yeni rol oluşturun ve izinlerini tanımlayın'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Rol Adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ör: Yönetici"
                  required
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active">Aktif Durum</Label>
                  <p className="text-xs text-muted-foreground">Rol kullanılabilir mi?</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Rol hakkında açıklama..."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <Separator />

          {/* Permissions Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  İzinler
                </h3>
                <p className="text-sm text-muted-foreground">
                  Her kaynak için izinleri seçin
                </p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Kaynak</th>
                    <th className="text-center p-3 font-medium text-sm w-24">Tümü</th>
                    {permissionResources[0].actions.map((action) => (
                      <th key={action} className="text-center p-3 font-medium text-sm w-24">
                        {actionLabels[action]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {permissionResources.map((resource) => {
                    const resourcePerms = formData.permissions[resource.key as keyof Permissions] || {} as PermissionDetail
                    const allEnabled = resource.actions.every(action => resourcePerms[action as keyof PermissionDetail])
                    const someEnabled = resource.actions.some(action => resourcePerms[action as keyof PermissionDetail])
                    
                    return (
                      <tr key={resource.key} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-sm">{resource.label}</div>
                            <div className="text-xs text-muted-foreground">{resource.description}</div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAllPermissions(resource.key, !allEnabled)}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                              allEnabled 
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                : someEnabled
                                ? 'bg-primary/50 text-primary-foreground hover:bg-primary/70'
                                : 'bg-muted hover:bg-muted/70'
                            }`}
                          >
                            {allEnabled ? (
                              <Check className="h-4 w-4" />
                            ) : someEnabled ? (
                              <Check className="h-4 w-4 opacity-50" />
                            ) : (
                              <X className="h-4 w-4 opacity-50" />
                            )}
                          </button>
                        </td>
                        {resource.actions.map((action) => (
                          <td key={action} className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => 
                                handlePermissionChange(
                                  resource.key, 
                                  action, 
                                  !resourcePerms[action as keyof PermissionDetail]
                                )
                              }
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                                resourcePerms[action as keyof PermissionDetail]
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                  : 'bg-muted hover:bg-muted/70'
                              }`}
                            >
                              {resourcePerms[action as keyof PermissionDetail] ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <X className="h-4 w-4 opacity-50" />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {role ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
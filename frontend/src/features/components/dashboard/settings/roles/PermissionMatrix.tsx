'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Shield, Loader2 } from 'lucide-react'
import { updateRoleAction, updateRoleWithPermissionNames, getPermissionCatalogAction, type Role } from '@/features/actions/settings/roles/role-actions'
import { permissionNamesFromPermissions, type Permissions, type PermissionDetail, type PermissionCatalogEntry } from '@/lib/permissions'
import { toast } from 'sonner'
import { useRolesStore } from '@/stores/roles-store'

interface PermissionMatrixProps {
  role: Role
  companyId?: string | undefined
}

const resources = [
  { 
    key: 'users', 
    label: 'Kullanıcılar', 
    description: 'Kullanıcı yönetimi',
    actions: ['create', 'read', 'update', 'delete']
  },
  { 
    key: 'roles', 
    label: 'Roller', 
    description: 'Rol yönetimi',
    actions: ['create', 'read', 'update', 'delete'] // Full CRUD for super_admin
  },
  { 
    key: 'settings', 
    label: 'Ayarlar', 
    description: 'Sistem ayarları',
    actions: ['create', 'read', 'update', 'delete'] // Full CRUD for super_admin
  },
  { 
    key: 'reports', 
    label: 'Raporlar', 
    description: 'Sistem raporları',
    actions: ['create', 'read', 'update', 'delete'] // Full CRUD for super_admin
  },
]

const actionLabels: Record<string, string> = {
  create: 'Oluştur',
  read: 'Oku',
  update: 'Güncelle',
  delete: 'Sil',
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({ role, companyId }) => {
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[] | null>(null)
  const [usingCatalog, setUsingCatalog] = useState(false)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [localPermissions, setLocalPermissions] = useState<Permissions>(role.permissions)

  // Check if this is super_admin role
  const isSuperAdmin = role.name?.toLowerCase() === 'super_admin' || role.name?.toLowerCase() === 'super admin'

  // Sync local state when role changes
  useEffect(() => {
    setLocalPermissions(role.permissions)
    // Attempt to load permission catalog (admin only). If available,
    // enable catalog-driven UI for finer-grained named permissions. Even
    // when the catalog is empty we still prefer the catalog-driven
    // approach so admins can create entries and then bind them using the matrix.
    void (async () => {
      try {
        const res = await getPermissionCatalogAction()
        if (res.status === 'success' && Array.isArray(res.permissions)) {
          setCatalog(res.permissions)
          // prefer catalog-driven UI when the endpoint exists
          setUsingCatalog(true)
        } else {
          setCatalog(null)
          setUsingCatalog(false)
        }
      } catch (e) {
        setCatalog(null)
        setUsingCatalog(false)
      }
    })()
  }, [role.permissions])

  const handlePermissionChange = async (resource: string, action: string, checked: boolean) => {
    const updateKey = `${resource}-${action}`
    setUpdating(prev => ({ ...prev, [updateKey]: true }))

    // Optimistic update
    setLocalPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource as keyof Permissions],
        [action]: checked
      }
    }))

    try {
      const updatedPermissions = {
        ...role.permissions,
        [resource]: {
          ...role.permissions[resource as keyof Permissions],
          [action]: checked
        }
      }

      const result = await updateRoleAction(role.id, {
        name: role.name,
        description: role.description,
        permissions: updatedPermissions,
        is_active: role.is_active
      }, companyId)

      if (result.status === 'success' && result.role) {
        toast.success('İzin güncellendi', {
          description: `${role.name} rolü için ${actionLabels[action]} izni ${checked ? 'verildi' : 'kaldırıldı'}`,
        })
        // Update the local roles store so the UI reflects the change immediately
        const setRoles = useRolesStore.getState().setRoles
        const current = useRolesStore.getState().roles || []
        const updated = current.map((r) => (r.id === result.role.id ? result.role : r))
        if (!updated.find((r) => r.id === result.role.id)) updated.push(result.role)
        setRoles(updated)
      } else {
        // Revert on error
        setLocalPermissions(role.permissions)
        toast.error('Hata', {
          description: result.message || "İzin güncellenirken hata oluştu",
        })
      }
    } catch (error) {
      console.error('Update permission error:', error)
      // Revert on error
      setLocalPermissions(role.permissions)
      toast.error('Hata', {
        description: "İzin güncellenirken bir hata oluştu",
      })
    } finally {
      setUpdating(prev => ({ ...prev, [updateKey]: false }))
    }
  }

  // When catalog-driven UI toggles, map named permission to role update
  const handleNamedPermissionChange = async (name: string, checked: boolean) => {
    // Build current list of names from role.permissions then add/remove
    const currentNames = new Set<string>(permissionNamesFromPermissions(role.permissions))
    if (checked) {
      currentNames.add(name)
    } else {
      currentNames.delete(name)
    }
    setUpdating(prev => ({ ...prev, [name]: true }))
    try {
      const result = await updateRoleWithPermissionNames(role.id, Array.from(currentNames), companyId)
      if (result.status === 'success') {
        toast.success('İzin güncellendi')
        const setRoles = useRolesStore.getState().setRoles
        const current = useRolesStore.getState().roles || []
        const updated = current.map((r) => (r.id === result.role.id ? result.role : r))
        if (!updated.find((r) => r.id === result.role.id)) updated.push(result.role)
        setRoles(updated)
      } else {
        toast.error('İzin güncellenirken hata oluştu')
      }
    } finally {
      setUpdating(prev => ({ ...prev, [name]: false }))
    }
  }

  const getPermissionValue = (resource: string, action: string): boolean => {
    const resourcePerms = localPermissions?.[resource as keyof Permissions]
    return resourcePerms?.[action as keyof PermissionDetail] || false
  }

  return (
    <div className="space-y-3">
      {isSuperAdmin && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="font-medium">Super Admin Rolü</span>
          </div>
          <p className="text-muted-foreground text-xs mt-1">
            Bu rol tüm modüllere tam erişime sahiptir. İzinler değiştirilemez.
          </p>
        </div>
      )}
      
      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
          {/* If using permission catalog, render a flat list of named permissions */}
          {usingCatalog ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium">Permission Catalog</div>
                <div className="text-xs text-muted-foreground">Named permissions for fine-grained control</div>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {/* Header for catalog-driven matrix (match legacy CRUD columns) */}
                <div className="grid grid-cols-[2fr_repeat(4,1fr)] gap-2 px-4 py-2 border-b bg-muted/50 font-medium text-xs">
                  <div>İzin</div>
                  <div className="text-center">Oluştur</div>
                  <div className="text-center">Oku</div>
                  <div className="text-center">Güncelle</div>
                  <div className="text-center">Sil</div>
                </div>
                {catalog && catalog.length > 0 ? (
                  catalog.map((entry) => {
                    const currentNames = new Set(permissionNamesFromPermissions(localPermissions))
                    return (
                      <div key={entry.name} className="grid grid-cols-[2fr_repeat(4,1fr)] gap-2 p-2 border rounded items-center">
                        <div>
                          <div className="font-medium">{entry.display_name || entry.name}</div>
                          <div className="text-xs text-muted-foreground">{entry.description}</div>
                        </div>
                        {['create', 'read', 'update', 'delete'].map((action) => {
                          const permName = `${entry.name}:${action}`
                          const isChecked = currentNames.has(permName)
                          const isUpdating = Boolean(updating[permName])
                          return (
                            <div key={action} className="flex items-center justify-center">
                              <div className="relative">
                                <Switch
                                  checked={isSuperAdmin ? true : isChecked}
                                  onCheckedChange={(checked) => !isSuperAdmin && handleNamedPermissionChange(permName, checked)}
                                  disabled={isSuperAdmin || isUpdating}
                                  className="data-[state=checked]:bg-green-600 scale-90"
                                />
                                {isUpdating && <Loader2 className="h-4 w-4 animate-spin absolute -right-5 top-1/2 -translate-y-1/2 text-primary" />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">İzin kataloğu boş. Üstteki "İzin Kataloğu" bölümünden izinler ekleyin, ardından bu matriste roller için izinleri işaretleyebilirsiniz.</div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-[2fr_repeat(4,1fr)] gap-2 px-4 py-2 border-b bg-muted/50 font-medium text-xs">
            <div>Modül</div>
            <div className="text-center">Oluştur</div>
            <div className="text-center">Oku</div>
            <div className="text-center">Güncelle</div>
            <div className="text-center">Sil</div>
              </div>

              {/* Rows */}
              {resources.map((resource) => { return (
            <div
              key={resource.key}
              className="grid grid-cols-[2fr_repeat(4,1fr)] gap-2 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{resource.description}</div>
                  <div className="text-xs text-muted-foreground truncate">{resource.label}</div>
                </div>
              </div>

              {['create', 'read', 'update', 'delete'].map((action) => {
                const isSupported = resource.actions.includes(action)
                const updateKey = `${resource.key}-${action}`
                const isUpdating = updating[updateKey]
                const isChecked = getPermissionValue(resource.key, action)

                // For super_admin, all permissions should be enabled and read-only
                const shouldBeDisabled = isSuperAdmin || isUpdating

                return (
                  <div key={action} className="flex items-center justify-center">
                    {isSupported ? (
                      <div className="relative">
                        <Switch
                          checked={isSuperAdmin ? true : isChecked}
                          onCheckedChange={(checked) =>
                            !isSuperAdmin && handlePermissionChange(resource.key, action, checked)
                          }
                          disabled={shouldBeDisabled}
                          className="data-[state=checked]:bg-green-600 scale-90"
                        />
                        {isUpdating && (
                          <Loader2 className="h-3 w-3 animate-spin absolute -right-5 top-1/2 -translate-y-1/2 text-primary" />
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        N/A
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )})}
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  )
}
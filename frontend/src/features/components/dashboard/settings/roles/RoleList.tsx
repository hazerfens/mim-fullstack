'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Users, Shield } from 'lucide-react'
import { deleteRoleAction, type Role, type Permissions } from '@/features/actions/settings/roles/role-actions'

interface RoleListProps {
  roles: Role[]
  onEdit: (role: Role) => void
  onRefresh: () => void
}

export const RoleList: React.FC<RoleListProps> = ({ roles, onEdit, onRefresh }) => {
  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Bu rolü silmek istediğinizden emin misiniz?')) return

    try {
      const result = await deleteRoleAction(roleId)
      if (result.status === 'success') {
        onRefresh()
      } else {
        alert(result.message || 'Rol silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Delete role error:', error)
      alert('Rol silinirken hata oluştu')
    }
  }

  const getPermissionCount = (permissions: Permissions) => {
    if (!permissions) return 0

    let count = 0
    Object.values(permissions).forEach(perm => {
      if (perm?.create) count++
      if (perm?.read) count++
      if (perm?.update) count++
      if (perm?.delete) count++
    })
    return count
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {roles.map((role) => (
        <Card key={role.id} className="relative">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{role.description}</CardTitle>
              </div>
              <Badge variant={role.is_active ? "default" : "secondary"}>
                {role.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
            <CardDescription>{role.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{getPermissionCount(role.permissions)} izin</span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(role)}
                className="flex-1"
              >
                <Edit className="h-4 w-4 mr-2" />
                Düzenle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteRole(role.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {roles.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          Henüz hiç rol oluşturulmamış
        </div>
      )}
    </div>
  )
}
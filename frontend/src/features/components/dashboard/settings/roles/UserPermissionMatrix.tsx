'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, CheckCircle2, XCircle, Shield } from 'lucide-react'
import { getUsersAction, getUserPermissionsAction, type User as UserType, type Permissions } from '@/features/actions/settings/roles/role-actions'

const resources = [
  { key: 'users', label: 'Kullanıcılar', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'roles', label: 'Roller', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'settings', label: 'Ayarlar', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'reports', label: 'Raporlar', actions: ['create', 'read', 'update', 'delete'] },
]

const actionLabels: Record<string, string> = {
  create: 'C',
  read: 'R',
  update: 'U',
  delete: 'D',
}

const getUserInitials = (firstName: string, lastName: string) => {
  return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
}

export const UserPermissionMatrix: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([])
  const [userPermissions, setUserPermissions] = useState<Record<string, Permissions>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const result = await getUsersAction()
      if (result.status === 'success') {
        setUsers(result.users)
        await fetchAllUserPermissions(result.users)
      } else {
        console.error('Failed to fetch users:', result.message)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const fetchAllUserPermissions = async (userList: UserType[]) => {
    const permissions: Record<string, Permissions> = {}

    for (const user of userList) {
      try {
        const result = await getUserPermissionsAction(user.id)
        if (result.status === 'success') {
          console.log(`📋 User ${user.first_name} ${user.last_name} permissions:`, result.permissions)
          permissions[user.id] = result.permissions
        } else {
          console.warn(`⚠️ Failed to fetch permissions for user ${user.id}:`, result.message)
          permissions[user.id] = {}
        }
      } catch (error) {
        console.error(`❌ Error fetching permissions for user ${user.id}:`, error)
        permissions[user.id] = {}
      }
    }

    console.log('📊 All user permissions:', permissions)
    setUserPermissions(permissions)
  }

  const getPermissionValue = (userId: string, resource: string, action: string): boolean => {
    const userPerms = userPermissions[userId]
    if (!userPerms) return false

    const resourcePerms = userPerms[resource as keyof Permissions]
    if (!resourcePerms) return false

    return resourcePerms?.[action as keyof typeof resourcePerms] || false
  }

  const filteredUsers = users.filter(user => {
    const search = searchQuery.toLowerCase()
    return (
      user.first_name?.toLowerCase().includes(search) ||
      user.last_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role_name?.toLowerCase().includes(search)
    )
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info Card */}
      {users.length > 0 && (
        <div className="bg-muted/30 border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">İzin Durumu</h4>
              <p className="text-sm text-muted-foreground">
                Toplam <span className="font-semibold text-foreground">{users.length}</span> kullanıcı bulunmaktadır.
                {' '}Kullanıcıların rol ve izin durumlarını aşağıdaki matriste inceleyebilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kullanıcı, email veya rol ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Matrix */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-[250px_repeat(4,1fr)] gap-2 p-3 border-b bg-muted/50 text-sm font-medium">
              <div>Kullanıcı</div>
              {resources.map(resource => (
                <div key={resource.key} className="text-center">
                  <div className="font-semibold">{resource.label}</div>
                  <div className="text-xs text-muted-foreground font-normal mt-1">
                    {resource.actions.map(a => actionLabels[a]).join(' · ')}
                  </div>
                </div>
              ))}
            </div>

            {/* Rows */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz hiç kullanıcı bulunmuyor'}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="grid grid-cols-[250px_repeat(4,1fr)] gap-2 p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={user.image_url || ''} alt={user.first_name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {getUserInitials(user.first_name, user.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                      {user.role_name ? (
                        <Badge variant="secondary" className="mt-1 text-xs">
                          {user.role_name}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="mt-1 text-xs">
                          Rol atanmamış
                        </Badge>
                      )}
                    </div>
                  </div>

                  {resources.map((resource) => (
                    <div key={resource.key} className="flex items-center justify-center gap-1">
                      {resource.actions.map((action) => {
                        const hasPermission = getPermissionValue(user.id, resource.key, action)
                        return (
                          <div
                            key={action}
                            className="flex flex-col items-center"
                            title={`${resource.label} - ${actionLabels[action]} (${action}) - ${hasPermission ? 'İzin var' : 'İzin yok'}`}
                          >
                            {hasPermission ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Kısaltmalar:</span>
          <span>C = Create</span>
          <span>R = Read</span>
          <span>U = Update</span>
          <span>D = Delete</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-green-600" />
          <span>İzin var</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-3 w-3 text-gray-300" />
          <span>İzin yok</span>
        </div>
      </div>
    </div>
  )
}
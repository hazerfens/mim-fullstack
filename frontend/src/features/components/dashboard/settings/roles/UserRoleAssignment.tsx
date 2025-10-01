'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { RefreshCw, UserCheck, Search, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { useRolesStore, useRoles } from '@/stores/roles-store'
import { getUsersAction, assignRoleToUserAction, type User } from '@/features/actions/settings/roles/role-actions'
import { toast } from 'sonner'
import { UserPermissionsModal } from './UserPermissionsModal'
import { UserPermissionDetails } from './UserPermissionDetails'

interface UserRoleAssignmentProps {
  onUpdate: () => void
}

export const UserRoleAssignment: React.FC<UserRoleAssignmentProps> = ({ onUpdate }) => {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const roles = useRoles();
  const fetchRolesFromStore = useRolesStore((state) => state.fetchRoles);
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
    fetchRolesFromStore()
  }, [fetchRolesFromStore])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const result = await getUsersAction()
      if (result.status === 'success') {
        setUsers(result.users)
      } else {
        toast.error('Kullanıcılar yüklenemedi', {
          description: result.message
        })
      }
    } catch (error) {
      console.error('Fetch users error:', error)
      toast.error('Hata', {
        description: 'Kullanıcılar yüklenirken bir hata oluştu'
      })
    } finally {
      setLoading(false)
    }
  }

  const assignRoleToUser = async (userId: string, roleId: string, userName: string) => {
    setSaving(userId)
    try {
      const result = await assignRoleToUserAction(userId, roleId)
      if (result.status === 'success') {
        const role = roles.find(r => r.id === roleId)
        toast.success('Rol atandı', {
          description: `${userName} kullanıcısına ${role?.name} rolü atandı`
        })
        await fetchUsers()
        onUpdate()
      } else {
        toast.error('Rol atanamadı', {
          description: result.message || 'Bilinmeyen hata'
        })
      }
    } catch (error) {
      console.error('Assign role error:', error)
      toast.error('Hata', {
        description: 'Rol atama sırasında hata oluştu'
      })
    } finally {
      setSaving(null)
    }
  }

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
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
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Kullanıcılar yükleniyor...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Kullanıcı Rol Atamaları
            </CardTitle>
            <CardDescription>
              Kullanıcılara roller atayın veya mevcut rolleri değiştirin
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Kullanıcı</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-[150px]">Mevcut Rol</TableHead>
                <TableHead className="w-[200px]">Rol Değiştir</TableHead>
                <TableHead className="w-[100px]">Durum</TableHead>
                <TableHead className="w-[100px] text-center">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz hiç kullanıcı bulunmuyor'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => {
                  const isExpanded = expandedUserId === user.id
                  
                  return (
                    <React.Fragment key={user.id}>
                      <TableRow 
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={(e) => {
                          // Don't toggle if clicking on select or button
                          if ((e.target as HTMLElement).closest('button, [role="combobox"]')) {
                            return
                          }
                          setExpandedUserId(isExpanded ? null : user.id)
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={user.image_url || ''} alt={user.first_name} />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getUserInitials(user.first_name, user.last_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="font-medium truncate">
                                {user.first_name} {user.last_name}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          {user.role_name ? (
                            <Badge variant="secondary" className="font-normal">
                              {user.role_name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Yok</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={user.role_id || ''}
                            onValueChange={(roleId) => 
                              assignRoleToUser(user.id, roleId, `${user.first_name} ${user.last_name}`)
                            }
                            disabled={saving === user.id}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Rol seçin..." />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.filter(role => role.is_active).map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user)
                                setShowPermissionsModal(true)
                              }}
                              className="h-8 w-8 p-0"
                              title="Özel izinleri düzenle"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Permission Details */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <UserPermissionDetails 
                              userId={user.id}
                              roleName={user.role_name}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
          <span>
            Toplam {filteredUsers.length} kullanıcı
            {searchQuery && ` (${users.length} kullanıcı arasında)`}
          </span>
          {saving && <span className="text-primary">Kaydediliyor...</span>}
        </div>
      </CardContent>
    </Card>
    
    {/* User Permissions Modal */}
    {showPermissionsModal && selectedUser && (
      <UserPermissionsModal
        user={selectedUser}
        onClose={() => {
          setShowPermissionsModal(false)
          setSelectedUser(null)
        }}
      />
    )}
    </>
  )
}
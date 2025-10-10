'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { RefreshCw, UserCheck, Search, ChevronDown, ChevronRight, Trash } from 'lucide-react'
import { useRolesStore } from '@/stores/roles-store'
import { getUsersAction, type User } from '@/features/actions/settings/roles/role-actions'
import { getCompanyMembers, removeMember, type CompanyMember } from '@/features/actions/company-member-action'
import { toast } from 'sonner'
// UserPermissionsModal moved to Users list
import OrphanedMembersModal from '@/features/components/company/OrphanedMembersModal'
import { UserPermissionDetails } from './UserPermissionDetails'

interface UserRoleAssignmentProps {
  onUpdate: () => void
  companyId?: string | undefined
  onlyOrphaned?: boolean
}

export const UserRoleAssignment: React.FC<UserRoleAssignmentProps> = ({ onUpdate, companyId, onlyOrphaned = false }) => {
  const [users, setUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  // role assignment and permission editing moved to Users page
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const fetchRolesFromStore = useRolesStore((state) => state.fetchRoles);
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [orphanOpen, setOrphanOpen] = useState(false)

  const fetchUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      if (companyId) {
        const companyResult = await getCompanyMembers(companyId)
        if (companyResult.success && companyResult.data) {
          const mapped = companyResult.data.map((m: CompanyMember) => ({
            id: m.user?.id || m.user_id,
            member_id: m.id,
            email: m.user?.email || '',
            first_name: m.user?.full_name || '',
            last_name: '',
            role_id: m.role?.id || m.role_id,
            role_name: m.role?.name,
            is_active: m.is_active,
            image_url: m.user?.image_url || undefined,
            created_at: m.created_at || '',
            // mark orphaned members (no user record)
            is_orphaned: m.user_exists === false || m.user == null,
            // Keep original member id for delete actions
          })) as User[] & { is_orphaned?: boolean; member_id?: string }[]
          setUsers(mapped)
        } else {
          toast.error('Üyeler yüklenemedi', { description: companyResult.error })
        }
      } else {
        const result = await getUsersAction()
        if (result.status === 'success') {
          setUsers(result.users)
        } else {
          toast.error('Kullanıcılar yüklenemedi', {
            description: result.message
          })
        }
      }
    } catch (error) {
      console.error('Fetch users error:', error)
      toast.error('Hata', {
        description: 'Kullanıcılar yüklenirken bir hata oluştu'
      })
    } finally {
      setLoading(false)
    }
  }, [companyId])

  useEffect(() => {
    fetchUsers()
    fetchRolesFromStore(companyId)
  }, [fetchRolesFromStore, companyId, fetchUsers])

  

  // role assignment moved to Users page

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

  // If onlyOrphaned flag is set, filter to orphaned users only
  const displayedUsers = onlyOrphaned ? filteredUsers.filter(u => u.is_orphaned === true) : filteredUsers

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
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={fetchUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
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
                displayedUsers.map((user) => {
                  const isExpanded = expandedUserId === user.id
                  
                  return (
                    <React.Fragment key={user.id}>
                      <TableRow 
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${user.is_orphaned ? 'bg-red-50 border-l-4 border-red-200' : ''}`}
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
                        {/* Role assignment moved to Users page. Column removed here. */}
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            {user.is_orphaned && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="min-w-[68px]"
                                onClick={async () => {
                                  if (!confirm('Bu orphaned üyeyi silmek istiyor musunuz?')) return
                                  setSaving(user.id)
                                  try {
                                    const memberId = user.member_id
                                    if (memberId) {
                                      const res = await removeMember(companyId!, memberId)
                                      if (res.success) {
                                        toast.success('Orphaned üye silindi')
                                        await fetchUsers()
                                        onUpdate()
                                      } else {
                                        toast.error(res.error || 'Silme başarısız')
                                      }
                                    }
                                  } catch (error) {
                                    console.error(error)
                                    toast.error('Silme sırasında hata oluştu')
                                  } finally {
                                    setSaving(null)
                                  }
                                }}
                              ><Trash className="h-4 w-4 mr-2" />Sil</Button>
                            )}
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
    {/* Permissions editing moved to Users list */}
  <OrphanedMembersModal open={orphanOpen} onOpenChange={setOrphanOpen} companyId={companyId || ''} />
    
    </>
  )
}

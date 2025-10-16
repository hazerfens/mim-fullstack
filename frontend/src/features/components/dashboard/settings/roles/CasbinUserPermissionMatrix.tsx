"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, Plus, Edit, Trash2, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserPermissionsModal } from './UserPermissionsModal'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { getUsersPaginatedAction, getUserCustomPermissionsAction, deleteUserCustomPermissionAction, type User as UserType } from '@/features/actions/settings/roles/role-actions'
import { toast } from 'sonner'


type CasbinPermission = {
  id: string;
  user_id: string;
  resource: string;
  action: string;
  domain: string;
}

export const CasbinUserPermissionMatrix: React.FC<{ active?: boolean }> = ({ active = false }) => {
  const [users, setUsers] = useState<UserType[]>([])
  const [userPermissions, setUserPermissions] = useState<Record<string, CasbinPermission[]>>({})
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [openUserId, setOpenUserId] = useState<string>('')
  const openUserIdRef = useRef<string>(openUserId)
  useEffect(() => { openUserIdRef.current = openUserId }, [openUserId])
  const [userLoading, setUserLoading] = useState<Record<string, boolean>>({})
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [total, setTotal] = useState<number>(0)

  // External user permission modal state
  const [userModalUser, setUserModalUser] = useState<UserType | null>(null)
  const [userModalInitialPermission, setUserModalInitialPermission] = useState<any | null>(null)

  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase()
  }

  // Fetch users
  const fetchUsersPage = useCallback(async (pageNumber: number, q?: string) => {
    setLoading(true)
    try {
      const res = await getUsersPaginatedAction({ page: pageNumber, pageSize, q: q || '', excludeRole: 'user' })
      if (res.status === 'success') {
        setUsers(res.users || [])
        setTotal(res.total || 0)
        setPage(res.page || pageNumber)
        setPageSize(res.pageSize || pageSize)
        return true
      } else {
        toast.error(res.message || 'Kullanıcılar getirilirken hata oluştu')
        return false
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Kullanıcılar yüklenirken hata oluştu')
      return false
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  // Fetch user permissions
  const fetchPermissionsForUser = useCallback(async (userId: string) => {
    try {
      const res = await getUserCustomPermissionsAction(userId)
      if (res.status === 'success') {
        setUserPermissions(prev => ({ ...prev, [userId]: res.permissions || [] }))
      }
    } catch (err) {
      console.error('Error fetching user permissions:', err)
    }
  }, [])

  // Initialize data when component becomes active
  useEffect(() => {
    if (!active) return
    let cancelled = false

    ;(async () => {
      const ok = await fetchUsersPage(1, appliedQuery)
      if (!cancelled && !ok) {
        setTimeout(() => { if (!cancelled) void fetchUsersPage(1, appliedQuery) }, 350)
      }
    })()

    return () => { cancelled = true }
  }, [active, fetchUsersPage, appliedQuery])

  // Search handlers
  const handleSearchSubmit = (q?: string) => {
    const toApply = q !== undefined ? q : searchQuery
    setAppliedQuery(toApply)
    void fetchUsersPage(1, toApply)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setAppliedQuery('')
    void fetchUsersPage(1, '')
  }

  const openUserModal = (user: UserType, permission?: any) => {
    setUserModalUser(user)
    setUserModalInitialPermission(permission || null)
  }

  const handleDeletePermission = async (userId: string, permissionId: string) => {
    if (!confirm('Bu izni silmek istediğinizden emin misiniz?')) return

    try {
      const res = await deleteUserCustomPermissionAction(userId, permissionId)
      if (res.status === 'success') {
        toast.success('İzin başarıyla silindi')
        await fetchPermissionsForUser(userId)
      } else {
        toast.error(res.message || 'İzin silinirken hata oluştu')
      }
    } catch (error) {
      console.error('Permission delete error:', error)
      toast.error('İzin silinirken hata oluştu')
    }
  }

  // Accordion change handler
  const handleAccordionChange = (val?: string) => {
    const id = val ?? ''
    setOpenUserId(id)
    openUserIdRef.current = id
    if (id !== '') {
      setUserLoading(prev => ({ ...prev, [id]: true }))
      void (async () => {
        try {
          await fetchPermissionsForUser(id)
        } finally {
          setUserLoading(prev => ({ ...prev, [id]: false }))
        }
      })()
    }
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
    <div className="space-y-6">
      {/* Info Card */}
      <div className="bg-muted/30 border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm mb-1">Kullanıcı Özel İzinleri (Casbin)</h4>
            <p className="text-sm text-muted-foreground">
              Kullanıcılara rol dışında özel izinler atayabilirsiniz. Bu izinler Casbin policy&apos;leri olarak saklanır.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-2">
        <div className="w-full relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Kullanıcı, email veya rol ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchSubmit() } }}
            className="pl-9 w-full"
          />
        </div>
        <div className="ml-0 sm:ml-auto flex w-full sm:w-auto gap-2">
          <button className="btn btn-sm btn-outline flex-1 sm:flex-none" onClick={() => handleSearchSubmit()}>Ara</button>
          <button className="btn btn-sm btn-ghost flex-1 sm:flex-none" onClick={handleClearSearch}>Temizle</button>
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="w-full">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz hiç kullanıcı bulunmuyor'}
              </div>
            ) : (
              <Accordion type="single" collapsible className="w-full" value={openUserId} onValueChange={handleAccordionChange}>
                {filteredUsers.map((user) => (
                  <AccordionItem key={user.id} value={user.id}>
                    <AccordionTrigger className="cursor-pointer hover:no-underline">
                      <div className="px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.image_url ?? undefined} alt={user.first_name} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                              {getUserInitials(user.first_name, user.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <div className="font-medium">{user.first_name} {user.last_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-3 sm:mt-0">
                          {user.role_name && (
                            <Badge variant="secondary">{user.role_name}</Badge>
                          )}
                          <div className="w-full justify-end text-sm text-muted-foreground">
                            {userPermissions[user.id]?.length || 0} özel izin
                          </div>
                          {userLoading[user.id] && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-4 border-t">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                          <h4 className="font-medium">Özel İzinler</h4>
                          <div className="ml-0 sm:ml-auto">
                            <Button
                              size="sm"
                              onClick={() => openUserModal(user)}
                              className="w-full sm:w-auto"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Yeni İzin
                            </Button>
                          </div>
                        </div>

                        {userPermissions[user.id]?.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            Bu kullanıcıya henüz özel izin atanmamış
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {userPermissions[user.id]?.map((permission) => (
                              <div key={permission.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg">
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {permission.resource}:{permission.action}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Domain: {permission.domain || '*'}
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3 sm:mt-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openUserModal(user, permission)}
                                    className="w-full sm:w-auto"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeletePermission(user.id, permission.id)}
                                    className="w-full sm:w-auto"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </div>
      </div>

      {userModalUser && (
        <UserPermissionsModal
          user={userModalUser}
          initialPermission={userModalInitialPermission}
          onClose={async () => {
            try { await fetchPermissionsForUser(userModalUser.id) } catch {}
            setUserModalUser(null)
            setUserModalInitialPermission(null)
          }}
        />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { if (page > 1) void fetchUsersPage(page - 1, appliedQuery) }}
            disabled={page <= 1}
          >Önceki</button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { const maxPage = Math.max(1, Math.ceil(total / pageSize)); if (page < maxPage) void fetchUsersPage(page + 1, appliedQuery) }}
            disabled={page >= Math.max(1, Math.ceil(total / pageSize))}
          >Sonraki</button>
          <div className="text-xs text-muted-foreground ml-3">
            Sayfa {page} — Gösterilen {(page - 1) * pageSize + 1} - {Math.min(total, page * pageSize)} / {total}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Sayfa boyutu</label>
          <select
            value={pageSize}
            onChange={(e) => { const ps = Number(e.target.value); setPageSize(ps); void fetchUsersPage(1, appliedQuery) }}
            className="text-sm border rounded px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  )
}
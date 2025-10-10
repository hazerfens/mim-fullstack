'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { getUsersPaginatedAction, updateUserAction, deleteUserAction, assignRoleToUserAction, assignRoleToCompanyMemberAction, type User } from '@/features/actions/settings/roles/role-actions'
import { useRoles, useRolesStore } from '@/stores/roles-store'
import { UserPermissionsModal } from '@/features/components/dashboard/settings/roles/UserPermissionsModal'
import { Settings } from 'lucide-react'
import { toast } from 'sonner'
import { Edit, Trash, Search, RefreshCw } from 'lucide-react'

interface UsersTableProps {
  initialPage?: number
  initialPageSize?: number
  companyId?: string
}

export const UsersTable: React.FC<UsersTableProps> = ({ initialPage = 1, initialPageSize = 20, companyId }) => {
  const [page, setPage] = useState(initialPage)
  const [pageSize] = useState(initialPageSize)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null)
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null)
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null)

  const roles = useRoles()
  const fetchRoles = useRolesStore((s) => s.fetchRoles)

  const fetchPage = React.useCallback(async () => {
    setLoading(true)
    try {
      const result = await getUsersPaginatedAction({ page, pageSize, q })
      if (result.status === 'success') {
        setUsers(result.users)
        setTotal(result.total ?? 0)
      } else {
        toast.error('Kullanıcılar yüklenemedi', { description: result.message })
      }
    } catch (err) {
      console.error('Fetch users page error', err)
      toast.error('Kullanıcılar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q])

  useEffect(() => {
    fetchPage()
    // ensure roles are available for assignment dropdown
    fetchRoles(companyId)
    // Subscribe to server-sent events for real-time updates
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/events/users')
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (!data || !data.type) return
          // Update local state instead of reloading the page
          if (data.type === 'user.created' && data.user) {
            setUsers(prev => {
              // append if not already in current page
              if (prev.find(u => u.id === data.user.id)) return prev
              return [data.user, ...prev].slice(0, pageSize)
            })
            setTotal(prev => prev + 1)
          } else if (data.type === 'user.updated' && data.user) {
            setUsers(prev => prev.map(u => u.id === data.user.id ? data.user : u))
          } else if (data.type === 'user.deleted' && data.userId) {
            setUsers(prev => prev.filter(u => u.id !== data.userId))
            setTotal(prev => Math.max(0, prev - 1))
          }
        } catch {
          // ignore malformed events
        }
      }
    } catch {
      // ignore - SSE may not be available in dev
    }
    return () => { if (es) es.close() }
  }, [fetchPage, fetchRoles, companyId])

  const handleSave = async (user: User) => {
    setSaving(true)
    try {
      const res = await updateUserAction(user.id, { first_name: user.first_name, last_name: user.last_name, is_active: user.is_active })
      if (res.status === 'success') {
        toast.success('Kullanıcı güncellendi')
        await fetchPage()
        setEditingUser(null)
      } else {
        toast.error('Güncelleme başarısız', { description: res.message })
      }
    } catch (e) {
      console.error(e)
      toast.error('Güncelleme sırasında hata')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istiyor musunuz?')) return
    setSaving(true)
    try {
      const res = await deleteUserAction(userId)
      if (res.status === 'success') {
        toast.success('Kullanıcı silindi')
        // refresh current page
        await fetchPage()
      } else {
        toast.error('Silme başarısız', { description: res.message })
      }
    } catch (e) {
      console.error(e)
      toast.error('Silme hatası')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Kullanıcı, email veya rol ara..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Button size="sm" variant="outline" onClick={() => { setPage(1); fetchPage() }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">Toplam {total} kullanıcı</div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Kullanıcı</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[150px]">Mevcut Rol</TableHead>
              <TableHead className="w-[100px]">Durum</TableHead>
              <TableHead className="w-[120px]">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{loading ? 'Yükleniyor...' : (q ? 'Arama sonucu bulunamadı' : 'Henüz hiç kullanıcı bulunmuyor')}</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                  <TableRow key={user.id} className={`${user.is_active ? '' : 'opacity-60 bg-muted/5'}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.image_url || ''} alt={user.first_name || user.email} />
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {(user.first_name?.charAt(0) || user.email?.charAt(0) || '').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{user.first_name} {user.last_name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={user.role_id || ''}
                      onValueChange={async (roleId) => {
                        setRoleSavingId(user.id)
                        const prevUsers = users
                        setUsers(users.map(u => u.id === user.id ? { ...u, role_id: roleId, role_name: roles.find(r => r.id === roleId)?.name || '' } : u))
                        try {
                          // If this table is used in a company context and the row has member_id, use company assignment
                          const memberId = (user as unknown as { member_id?: string }).member_id
                          let res
                          if (companyId && memberId) {
                            res = await assignRoleToCompanyMemberAction(companyId, memberId, roleId)
                          } else {
                            res = await assignRoleToUserAction(user.id, roleId)
                          }
                          if (res.status !== 'success') {
                            toast.error('Rol atanamadı', { description: res.message })
                            setUsers(prevUsers)
                          } else {
                            toast.success('Rol başarıyla atandı')
                          }
                        } catch (err) {
                          console.error('Assign role error', err)
                          toast.error('Rol atama sırasında hata oluştu')
                          setUsers(prevUsers)
                        } finally {
                          setRoleSavingId(null)
                        }
                      }}
                      disabled={roleSavingId === user.id}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={user.role_name || 'Rol seçin...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter(r => r.is_active).map((role) => (
                          <SelectItem key={role.id ?? role.name} value={role.id ?? role.name}>{role.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={!!user.is_active}
                      onCheckedChange={async (val: boolean) => {
                        // toggle active state for this user
                        setTogglingUserId(user.id)
                        // optimistic update
                        const previous = users
                        setUsers(users.map(u => u.id === user.id ? { ...u, is_active: val } : u))
                        try {
                          const res = await updateUserAction(user.id, { is_active: val })
                          if (res.status !== 'success') {
                            toast.error('Durum güncellenemedi', { description: res.message })
                            setUsers(previous)
                          } else {
                            toast.success(val ? 'Kullanıcı aktifleştirildi' : 'Kullanıcı pasifleştirildi')
                          }
                        } catch (err) {
                          console.error('Toggle active error', err)
                          toast.error('Durum güncellemesi sırasında hata oluştu')
                          setUsers(previous)
                        } finally {
                          setTogglingUserId(null)
                        }
                      }}
                      disabled={togglingUserId === user.id}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingUser(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPermissionsUser(user)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)} disabled={saving}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div>
          <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Önceki</Button>
          <span className="mx-3">{page} / {totalPages}</span>
          <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Sonraki</Button>
        </div>
      </div>

  {/* Edit modal - simple inline editing */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-[600px] bg-white rounded shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Kullanıcıyı Düzenle</h3>
            <div className="grid grid-cols-2 gap-4">
              <input className="border p-2" value={editingUser.first_name || ''} onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })} />
              <input className="border p-2" value={editingUser.last_name || ''} onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <div className="flex items-center gap-2">
                <Switch checked={!!editingUser.is_active} onCheckedChange={(v) => setEditingUser({ ...editingUser, is_active: v })} />
                <span>Aktif</span>
              </div>
            </div>
            <div className="flex items-end justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditingUser(null)}>Kapat</Button>
              <Button onClick={() => handleSave(editingUser)} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions modal */}
      {permissionsUser && (
        <UserPermissionsModal user={permissionsUser} onClose={() => { setPermissionsUser(null); fetchPage() }} />
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Shield, Plus, Trash2, Clock, Calendar, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getUserCustomPermissionsAction,
  createUserCustomPermissionAction,
  deleteUserCustomPermissionAction,
  type UserPermission,
  type TimeRestriction,
} from '@/features/actions/settings/roles/user-permission-actions'
import type { User } from '@/features/actions/settings/roles/role-actions'

interface UserPermissionsModalProps {
  user: User
  onClose: () => void
}

const resources = [
  { value: 'users', label: 'Kullanıcılar' },
  { value: 'roles', label: 'Roller' },
  { value: 'settings', label: 'Ayarlar' },
  { value: 'reports', label: 'Raporlar' },
]

const actions = [
  { value: 'create', label: 'Oluştur (C)', short: 'C' },
  { value: 'read', label: 'Oku (R)', short: 'R' },
  { value: 'update', label: 'Güncelle (U)', short: 'U' },
  { value: 'delete', label: 'Sil (D)', short: 'D' },
]

const weekDays = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
  { value: 6, label: 'Cumartesi' },
  { value: 7, label: 'Pazar' },
]

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({ user, onClose }) => {
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

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
  })

  useEffect(() => {
    fetchPermissions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id])

  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const result = await getUserCustomPermissionsAction(user.id)
      if (result.status === 'success') {
        setPermissions(result.permissions || [])
      } else {
        toast.error('İzinler yüklenemedi', {
          description: result.message,
        })
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      toast.error('İzinler yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const handleAddPermission = async () => {
    if (!newPermission.resource || !newPermission.action) {
      toast.error('Kaynak ve işlem seçimi zorunludur')
      return
    }

    setSaving(true)
    try {
      const data = {
        resource: newPermission.resource,
        action: newPermission.action,
        is_allowed: newPermission.is_allowed,
        priority: newPermission.priority,
        time_restriction: newPermission.useTimeRestriction ? newPermission.timeRestriction : null,
      }

      const result = await createUserCustomPermissionAction(user.id, data)
      if (result.status === 'success') {
        toast.success('✅ İzin başarıyla eklendi')
        fetchPermissions()
        setShowAddForm(false)
        resetNewPermission()
      } else {
        toast.error('❌ İzin eklenemedi', {
          description: result.message,
        })
      }
    } catch (error) {
      console.error('Error adding permission:', error)
      toast.error('İzin eklenirken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePermission = async (permissionId: string) => {
    if (!confirm('Bu izni silmek istediğinizden emin misiniz?')) return

    setSaving(true)
    try {
      const result = await deleteUserCustomPermissionAction(user.id, permissionId)
      if (result.status === 'success') {
        toast.success('✅ İzin başarıyla silindi')
        fetchPermissions()
      } else {
        toast.error('❌ İzin silinemedi', {
          description: result.message,
        })
      }
    } catch (error) {
      console.error('Error deleting permission:', error)
      toast.error('İzin silinirken hata oluştu')
    } finally {
      setSaving(false)
    }
  }

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
    })
  }

  const toggleWeekDay = (day: number) => {
    setNewPermission((prev) => {
      const days = prev.timeRestriction.allowed_days || []
      const newDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
      return {
        ...prev,
        timeRestriction: {
          ...prev.timeRestriction,
          allowed_days: newDays,
        },
      }
    })
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Özel İzinler - {user.first_name} {user.last_name}
          </DialogTitle>
          <DialogDescription>
            Bu kullanıcıya özel zaman bazlı izinler tanımlayın. Özel izinler rol izinlerini geçersiz kılar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 py-4">
            {/* Current Permissions List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : permissions.length === 0 && !showAddForm ? (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">Henüz özel izin tanımlanmamış</p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  İlk İzni Ekle
                </Button>
              </div>
            ) : (
              <>
                {permissions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Mevcut Özel İzinler</h3>
                      <Badge variant="secondary">{permissions.length} izin</Badge>
                    </div>

                    {permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="font-mono">
                                {permission.resource}.{permission.action}
                              </Badge>
                              <Badge variant={permission.is_allowed ? 'default' : 'destructive'}>
                                {permission.is_allowed ? 'İzinli' : 'Yasaklı'}
                              </Badge>
                              <Badge variant="secondary">Priority: {permission.priority}</Badge>
                            </div>

                            {/* Time Restriction Info */}
                            {permission.time_restriction && (
                              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                {permission.time_restriction.start_time && permission.time_restriction.end_time && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      {permission.time_restriction.start_time} - {permission.time_restriction.end_time}
                                    </span>
                                  </div>
                                )}
                                {permission.time_restriction.allowed_days &&
                                  permission.time_restriction.allowed_days.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>
                                        {permission.time_restriction.allowed_days
                                          .map((day) => weekDays.find((d) => d.value === day)?.label.substring(0, 3))
                                          .join(', ')}
                                      </span>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePermission(permission.id)}
                            disabled={saving}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Add New Permission Form */}
                {!showAddForm ? (
                  <Button onClick={() => setShowAddForm(true)} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni İzin Ekle
                  </Button>
                ) : (
                  <div className="border-2 border-primary/20 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Yeni İzin Ekle</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddForm(false)
                          resetNewPermission()
                        }}
                      >
                        İptal
                      </Button>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Kaynak *</Label>
                        <Select value={newPermission.resource} onValueChange={(value) => setNewPermission({ ...newPermission, resource: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Kaynak seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {resources.map((resource) => (
                              <SelectItem key={resource.value} value={resource.value}>
                                {resource.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>İşlem *</Label>
                        <Select value={newPermission.action} onValueChange={(value) => setNewPermission({ ...newPermission, action: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="İşlem seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {actions.map((action) => (
                              <SelectItem key={action.value} value={action.value}>
                                {action.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>İzin Durumu</Label>
                        <p className="text-xs text-muted-foreground">İzin verilsin mi, yoksa yasaklansın mı?</p>
                      </div>
                      <Switch
                        checked={newPermission.is_allowed}
                        onCheckedChange={(checked) => setNewPermission({ ...newPermission, is_allowed: checked })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Öncelik</Label>
                      <Input
                        type="number"
                        value={newPermission.priority}
                        onChange={(e) => setNewPermission({ ...newPermission, priority: parseInt(e.target.value) || 0 })}
                        placeholder="10"
                        min={0}
                        max={100}
                      />
                      <p className="text-xs text-muted-foreground">
                        Yüksek öncelik rol izinlerini geçersiz kılar (0-100)
                      </p>
                    </div>

                    <Separator />

                    {/* Time Restriction */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Zaman Kısıtlaması
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Belirli günler ve saatlerde geçerli olsun
                          </p>
                        </div>
                        <Switch
                          checked={newPermission.useTimeRestriction}
                          onCheckedChange={(checked) =>
                            setNewPermission({ ...newPermission, useTimeRestriction: checked })
                          }
                        />
                      </div>

                      {newPermission.useTimeRestriction && (
                        <div className="space-y-4 pl-4 border-l-2 border-primary/20">
                          {/* Time Range */}
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Başlangıç Saati</Label>
                              <Input
                                type="time"
                                value={newPermission.timeRestriction.start_time}
                                onChange={(e) =>
                                  setNewPermission({
                                    ...newPermission,
                                    timeRestriction: {
                                      ...newPermission.timeRestriction,
                                      start_time: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Bitiş Saati</Label>
                              <Input
                                type="time"
                                value={newPermission.timeRestriction.end_time}
                                onChange={(e) =>
                                  setNewPermission({
                                    ...newPermission,
                                    timeRestriction: {
                                      ...newPermission.timeRestriction,
                                      end_time: e.target.value,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>

                          {/* Days of Week */}
                          <div className="space-y-2">
                            <Label>İzin Verilen Günler</Label>
                            <div className="flex flex-wrap gap-2">
                              {weekDays.map((day) => (
                                <Button
                                  key={day.value}
                                  type="button"
                                  variant={
                                    newPermission.timeRestriction.allowed_days?.includes(day.value)
                                      ? 'default'
                                      : 'outline'
                                  }
                                  size="sm"
                                  onClick={() => toggleWeekDay(day.value)}
                                  className="min-w-[80px]"
                                >
                                  {day.label.substring(0, 3)}
                                </Button>
                              ))}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Boş bırakırsanız tüm günlerde geçerli olur
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button onClick={handleAddPermission} disabled={saving} className="w-full">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      İzni Kaydet
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

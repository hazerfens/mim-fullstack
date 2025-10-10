"use client"

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getPermissionCatalogAction, createPermissionAction, updatePermissionAction, deletePermissionAction } from '@/features/actions/settings/roles/role-actions'
import { PermissionCatalogEntry } from '@/lib/permissions'
import { toast } from 'sonner'
import { Edit, Trash, Plus } from 'lucide-react'

export const PermissionCatalogEditor: React.FC = () => {
  const [catalog, setCatalog] = useState<PermissionCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<PermissionCatalogEntry | null>(null)
  const [editingOriginalName, setEditingOriginalName] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      // Request all permissions so admins can reactivate inactive ones
      const res = await getPermissionCatalogAction({ all: true })
      if (res.status === 'success') setCatalog(res.permissions || [])
      else toast.error('Permission catalog yüklenemedi')
    } catch (e) {
      console.error(e)
      toast.error('Permission catalog yüklenemedi')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const openCreate = () => { setEditing({ name: '', display_name: '', description: '', is_active: true }); setEditingOriginalName(null); setShowDialog(true) }
  const openEdit = (p: PermissionCatalogEntry) => { setEditing(p); setEditingOriginalName(p.name); setShowDialog(true) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    try {
      if (!editing.name) { toast.error('İsim zorunlu'); return }
      // If editing an existing entry, use the original name for the update so
      // renames are not performed (we keep name immutable to avoid collisions).
      if (editingOriginalName) {
        const res = await updatePermissionAction(editingOriginalName, { display_name: editing.display_name, description: editing.description, is_active: editing.is_active })
        if (res.status === 'success') { toast.success('İzin güncellendi'); setShowDialog(false); await load() }
        else toast.error('Güncelleme başarısız')
      } else {
        // Creating new permission - ensure no duplicate name exists
        if (catalog.find(c => c.name === editing.name)) { toast.error('Aynı isimde bir izin zaten mevcut'); return }
        const res = await createPermissionAction({ name: editing.name, display_name: editing.display_name || null, description: editing.description || null, is_active: editing.is_active })
        if (res.status === 'success') { toast.success('İzin oluşturuldu'); setShowDialog(false); await load() }
        else toast.error('Oluşturma başarısız')
      }
    } catch (err) {
      console.error(err)
      toast.error('İşlem başarısız')
    }
  }

  const handleDelete = async (name: string) => {
    if (!confirm('Bu izni silmek istiyor musunuz?')) return
    try {
      const res = await deletePermissionAction(name)
      if (res.status === 'success') { toast.success('İzin silindi'); await load() }
      else toast.error('Silme başarısız')
    } catch (err) {
      console.error(err); toast.error('Silme başarısız')
    }
  }

  const handleToggleActive = async (name: string, val: boolean) => {
    try {
      const res = await updatePermissionAction(name, { is_active: val })
      if (res.status === 'success') {
        setCatalog(prev => prev.map(p => p.name === name ? ({ ...p, is_active: val }) : p))
        toast.success(val ? 'İzin aktifleştirildi' : 'İzin pasifleştirildi')
      } else {
        toast.error('Durum değiştirilemedi', { description: res.message })
      }
    } catch (err) {
      console.error(err)
      toast.error('Durum değiştirilemedi')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>İzin Kataloğu</CardTitle>
            <div className="text-sm text-muted-foreground">Sistem genelinde kullanılacak izin adlarını yönetin</div>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4"/>Yeni İzin</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <div>Yükleniyor...</div> : (
          <div className="space-y-2">
            {catalog.length === 0 ? (
              <div className="text-muted-foreground">Henüz izin tanımlanmamış</div>
            ) : (
              <div className="grid gap-2">
                {catalog.map((p) => (
                  <div key={p.name} className="flex items-center justify-between border rounded p-2">
                    <div>
                      <div className="font-medium">{p.display_name || p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">{p.is_active ? 'Aktif' : 'Pasif'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={!!p.is_active} onCheckedChange={(v) => handleToggleActive(p.name, v)} />
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}><Edit className="h-4 w-4"/></Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(p.name)}><Trash className="h-4 w-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing && catalog.find(c => c.name === editing.name) ? 'İzni Düzenle' : 'Yeni İzin Oluştur'}</DialogTitle>
            <DialogDescription>Permission name, display name ve açıklama girin</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-2">
              <div className="space-y-1">
                    <Label>İsim (benzersiz)</Label>
                    <Input value={editing?.name || ''} onChange={(e) => setEditing(prev => prev ? ({ ...prev, name: e.target.value }) : prev)} required disabled={!!editingOriginalName} />
              </div>
              <div className="space-y-1">
                <Label>Görünür İsim</Label>
                    <Input value={editing?.display_name || ''} onChange={(e) => setEditing(prev => prev ? ({ ...prev, display_name: e.target.value }) : prev)} />
              </div>
              <div className="space-y-1">
                <Label>Açıklama</Label>
                <Input value={editing?.description || ''} onChange={(e) => setEditing(prev => prev ? ({ ...prev, description: e.target.value }) : prev)} />
              </div>
              <div className="space-y-1">
                <Label>Durum</Label>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground">{editing?.is_active ? 'Aktif' : 'Pasif'}</div>
                  <Switch checked={!!editing?.is_active} onCheckedChange={(v) => setEditing(prev => prev ? ({ ...prev, is_active: v }) : prev)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>İptal</Button>
              <Button type="submit">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

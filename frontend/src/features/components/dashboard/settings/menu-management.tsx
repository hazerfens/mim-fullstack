'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Plus, Edit, Trash2, Eye, EyeOff, AlertTriangle, Database, Menu as MenuIcon } from 'lucide-react'
import { toast } from 'sonner'
import { createMenu, createMenuTables, deleteMenu, updateMenu, getMenus, createSubMenu, updateSubMenu, deleteSubMenu, createMenuCategory } from '@/features/actions/dashboard/settings/menu-actions'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import type { Menu, MenuCategory, SubMenu } from '@/types/menu'

const MenuManagement = () => {
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null)
  const [createSubMenuDialogOpen, setCreateSubMenuDialogOpen] = useState(false)
  const [editingSubMenu, setEditingSubMenu] = useState<SubMenu | null>(null)
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState<string>('')
  const [categoryName, setCategoryName] = useState('')
  const [categorySlug, setCategorySlug] = useState('')
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null)
  const [deleteSubMenuId, setDeleteSubMenuId] = useState<string | null>(null)
  const [createTablesConfirmOpen, setCreateTablesConfirmOpen] = useState(false)

  // Load menu categories
  const loadMenuCategories = async () => {
    try {
      const data = await getMenus()
      setMenuCategories(data)
    } catch (error) {
      console.error('Menü kategorileri yüklenirken hata:', error)
      toast.error('Menü kategorileri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMenuCategories()
  }, [])

  // Handle create category
  const handleCreateCategory = async (formData: FormData) => {
    try {
      await createMenuCategory(formData)
      setSelectedMenuCategoryId('')
      setCategoryName('')
      setCategorySlug('')
      loadMenuCategories()
      toast.success('Kategori başarıyla eklendi')
    } catch (error) {
      console.error('Kategori eklenirken hata:', error)
      toast.error('Kategori eklenirken hata oluştu')
    }
  }

  // Handle create menu
  const handleCreateMenu = async (formData: FormData) => {
    try {
      await createMenu(formData)
      setCreateDialogOpen(false)
      loadMenuCategories()
      toast.success('Menü başarıyla oluşturuldu')
    } catch (error) {
      console.error('Menü oluşturulurken hata:', error)
      toast.error('Menü oluşturulurken hata oluştu')
    }
  }

  // Handle update menu
  const handleUpdateMenu = async (formData: FormData) => {
    if (!editingMenu) return

    try {
      await updateMenu(editingMenu.id, formData)
      setEditingMenu(null)
      loadMenuCategories()
    } catch (error) {
      console.error('Menü güncellenirken hata:', error)
      toast.error('Menü güncellenirken hata oluştu')
    }
  }

  // Handle delete menu
  const handleDeleteMenu = async (menuId: string) => {
    setDeleteMenuId(menuId)
  }

  // Confirm delete menu
  const confirmDeleteMenu = async () => {
    if (!deleteMenuId) return

    try {
      await deleteMenu(deleteMenuId)
      loadMenuCategories()
      setDeleteMenuId(null)
    } catch (error) {
      console.error('Menü silinirken hata:', error)
      toast.error('Menü silinirken hata oluştu')
    }
  }

  // Handle create menu tables
  const handleCreateMenuTables = async () => {
    setCreateTablesConfirmOpen(true)
  }

  // Confirm create menu tables
  const confirmCreateMenuTables = async () => {
    try {
      await createMenuTables()
      toast.success('Menu tabloları başarıyla oluşturuldu')
      loadMenuCategories()
      setCreateTablesConfirmOpen(false)
    } catch (error) {
      console.error('Menu tables creation error:', error)
      toast.error('Menu tabloları oluşturulurken hata oluştu')
    }
  }

  // Handle create sub-menu
  const handleCreateSubMenu = async (formData: FormData) => {
    try {
      await createSubMenu(formData)
      setCreateSubMenuDialogOpen(false)
      loadMenuCategories()
    } catch (error) {
      console.error('Alt menü oluşturulurken hata:', error)
      toast.error('Alt menü oluşturulurken hata oluştu')
    }
  }

  // Handle update sub-menu
  const handleUpdateSubMenu = async (formData: FormData) => {
    if (!editingSubMenu) return

    try {
      await updateSubMenu(editingSubMenu.id, formData)
      setEditingSubMenu(null)
      loadMenuCategories()
    } catch (error) {
      console.error('Alt menü güncellenirken hata:', error)
      toast.error('Alt menü güncellenirken hata oluştu')
    }
  }

  // Handle delete submenu
  const handleDeleteSubMenu = async (subMenuId: string) => {
    setDeleteSubMenuId(subMenuId)
  }

  // Confirm delete submenu
  const confirmDeleteSubMenu = async () => {
    if (!deleteSubMenuId) return

    try {
      await deleteSubMenu(deleteSubMenuId)
      loadMenuCategories()
      setDeleteSubMenuId(null)
    } catch (error) {
      console.error('Alt menü silinirken hata:', error)
      toast.error('Alt menü silinirken hata oluştu')
    }
  }

  // Slugify helper
  function slugify(str: string) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Update slug automatically when category name changes
  useEffect(() => {
    if (categoryName) {
      setCategorySlug(`/${slugify(categoryName)}`)
    } else {
      setCategorySlug('')
    }
  }, [categoryName])

  if (loading) {
    return <div>Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Menüler</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateMenuTables}>
            Tablo Oluştur
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                Kategori Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MenuIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Yeni Kategori Ekle</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Menüye bağlı yeni bir kategori oluşturun.
                  </DialogDescription>
                </div>
              </div>
              <form action={handleCreateCategory} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="menu_category_id" className="text-sm font-medium">Bağlı Kategori</Label>
                  <Select value={selectedMenuCategoryId} onValueChange={setSelectedMenuCategoryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="menu_category_id" value={selectedMenuCategoryId} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Kategori Adı</Label>
                    <Input
                      id="name"
                      name="name"
                      value={categoryName}
                      onChange={e => setCategoryName(e.target.value)}
                      placeholder="Örn: Ana Sayfa"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-sm font-medium">Slug</Label>
                    <Input
                      id="slug"
                      name="slug"
                      value={categorySlug}
                      readOnly
                      className="w-full bg-muted"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Açıklama</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Kategori açıklaması..."
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image_url" className="text-sm font-medium">Resim URL</Label>
                  <Input
                    id="image_url"
                    name="image_url"
                    placeholder="https://..."
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="order" className="text-sm font-medium">Sıra</Label>
                    <Input
                      id="order"
                      name="order"
                      type="number"
                      defaultValue="0"
                      min="0"
                      className="w-full"
                    />
                  </div>
                  <div className="flex items-center justify-center space-x-2 pt-8">
                    <Switch id="is_active" name="is_active" defaultChecked />
                    <Label htmlFor="is_active" className="text-sm font-medium">Aktif</Label>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline">İptal</Button>
                    </DialogTrigger>
                  </Dialog>
                  <Button type="submit" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Ekle
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Menü Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MenuIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Yeni Menü Oluştur</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Kategoriye bağlı yeni bir menü oluşturmak için bilgileri doldurun.
                  </DialogDescription>
                </div>
              </div>
              <form action={handleCreateMenu} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="menu_category_id" className="text-sm font-medium">Kategori</Label>
                  <Select value={selectedMenuCategoryId} onValueChange={setSelectedMenuCategoryId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {menuCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="menu_category_id" value={selectedMenuCategoryId} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">Başlık</Label>
                    <Input
                      id="title"
                      name="title"
                      placeholder="Menü başlığı"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug" className="text-sm font-medium">Slug</Label>
                    <Input
                      id="slug"
                      name="slug"
                      placeholder="/menu-slug"
                      required
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Açıklama</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Menü açıklaması..."
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url" className="text-sm font-medium">URL (Opsiyonel)</Label>
                  <Input
                    id="url"
                    name="url"
                    placeholder="/sayfa-url (alt menü olmadan doğrudan link için)"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alt menü olmadan doğrudan link için URL girin.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch id="is_active" name="is_active" defaultChecked />
                    <Label htmlFor="is_active" className="text-sm font-medium">Aktif</Label>
                  </div>
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      İptal
                    </Button>
                    <Button type="submit" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Oluştur
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={createSubMenuDialogOpen} onOpenChange={setCreateSubMenuDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                SubMenu Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MenuIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold">Yeni Alt Menü Oluştur</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Mevcut bir menüye bağlı alt menü oluşturmak için bilgileri doldurun.
                  </DialogDescription>
                </div>
              </div>
              <form action={handleCreateSubMenu} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="sub_menu_id" className="text-sm font-medium">Üst Menü</Label>
                  <Select name="menu_id" required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Menü seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {menuCategories.flatMap(category =>
                        category.menus?.map(menu => (
                          <SelectItem key={menu.id} value={menu.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{menu.title}</span>
                              <span className="text-xs text-muted-foreground">{category.name}</span>
                            </div>
                          </SelectItem>
                        )) || []
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sub_menu_name" className="text-sm font-medium">Ad</Label>
                    <Input
                      id="sub_menu_name"
                      name="name"
                      placeholder="Alt menü adı"
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub_menu_slug" className="text-sm font-medium">Slug</Label>
                    <Input
                      id="sub_menu_slug"
                      name="slug"
                      placeholder="/alt-menu-slug"
                      required
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sub_menu_description" className="text-sm font-medium">Açıklama</Label>
                  <Textarea
                    id="sub_menu_description"
                    name="description"
                    placeholder="Alt menü açıklaması..."
                    className="min-h-[80px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sub_menu_image_url" className="text-sm font-medium">Resim URL</Label>
                    <Input
                      id="sub_menu_image_url"
                      name="image_url"
                      placeholder="https://..."
                      className="w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sub_menu_order" className="text-sm font-medium">Sıra</Label>
                    <Input
                      id="sub_menu_order"
                      name="order"
                      type="number"
                      defaultValue="0"
                      min="0"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2">
                    <Switch id="sub_menu_is_active" name="is_active" defaultChecked />
                    <Label htmlFor="sub_menu_is_active" className="text-sm font-medium">Aktif</Label>
                  </div>
                  <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => setCreateSubMenuDialogOpen(false)}>
                      İptal
                    </Button>
                    <Button type="submit" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Oluştur
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Menu Categories List */}
      <div className="grid gap-4">
        {menuCategories.map((category) => (
          <Card key={category.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {category.name}
                    {category.is_active ? (
                      <Badge variant="default">
                        <Eye className="w-3 h-3 mr-1" />
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Pasif
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Menus in this category */}
                {category.menus && category.menus.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Menüler ({category.menus.length})</h4>
                    <div className="space-y-3">
                      {category.menus.map((menu) => (
                        <div key={menu.id} className="p-4 border rounded-lg bg-muted/30">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h5 className="font-medium">{menu.title}</h5>
                              <p className="text-sm text-muted-foreground">{menu.description}</p>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline">Alt Menüler: {menu.sub_menus?.length || 0}</Badge>
                                <Badge variant="outline">Öne Çıkan: {menu.featured_items?.length || 0}</Badge>
                              </div>
                            </div>
                            <div className="flex gap-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-1">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                    <div className="flex items-center space-x-3 mb-4">
                                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                        <Edit className="h-5 w-5 text-primary" />
                                      </div>
                                      <div>
                                        <DialogTitle className="text-lg font-semibold">Menü Düzenle</DialogTitle>
                                        <DialogDescription className="text-sm text-muted-foreground">
                                          Menü bilgilerini güncelleyin.
                                        </DialogDescription>
                                      </div>
                                    </div>
                                    <form action={handleUpdateMenu} className="space-y-6">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="edit_title" className="text-sm font-medium">Başlık</Label>
                                          <Input
                                            id="edit_title"
                                            name="title"
                                            defaultValue={editingMenu?.title}
                                            placeholder="Menü başlığı"
                                            required
                                            className="w-full"
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="edit_slug" className="text-sm font-medium">Slug</Label>
                                          <Input
                                            id="edit_slug"
                                            name="slug"
                                            defaultValue={editingMenu?.slug}
                                            placeholder="/menu-slug"
                                            required
                                            className="w-full"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="edit_description" className="text-sm font-medium">Açıklama</Label>
                                        <Textarea
                                          id="edit_description"
                                          name="description"
                                          defaultValue={editingMenu?.description}
                                          placeholder="Menü açıklaması..."
                                          className="min-h-[80px] resize-none"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label htmlFor="edit_url" className="text-sm font-medium">URL (Opsiyonel)</Label>
                                        <Input
                                          id="edit_url"
                                          name="url"
                                          defaultValue={editingMenu?.url}
                                          placeholder="/sayfa-url (alt menü olmadan doğrudan link için)"
                                          className="w-full"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                          Alt menü olmadan doğrudan link için URL girin.
                                        </p>
                                      </div>

                                      <div className="flex items-center justify-between pt-4 border-t">
                                        <div className="flex items-center space-x-2">
                                          <Switch
                                            id="edit_is_active"
                                            name="is_active"
                                            defaultChecked={editingMenu?.is_active}
                                          />
                                          <Label htmlFor="edit_is_active" className="text-sm font-medium">Aktif</Label>
                                        </div>
                                        <div className="flex space-x-3">
                                          <Button type="button" variant="outline" onClick={() => setEditingMenu(null)}>
                                            İptal
                                          </Button>
                                          <Button type="submit" className="gap-2">
                                            <Edit className="w-4 h-4" />
                                            Güncelle
                                          </Button>
                                        </div>
                                      </div>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteMenu(menu.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Sub-Menus */}
                          {menu.sub_menus && menu.sub_menus.length > 0 && (
                            <div className="mt-3">
                              <h6 className="text-sm font-medium mb-2">Alt Menüler</h6>
                              <div className="space-y-2">
                                {menu.sub_menus.map((subMenu) => (
                                  <div key={subMenu.id} className="p-2 border rounded bg-background">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h6 className="text-sm font-medium">{subMenu.name}</h6>
                                        <p className="text-xs text-muted-foreground">{subMenu.description}</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={() => setEditingSubMenu(subMenu)} className="gap-1">
                                              <Edit className="w-3 h-3" />
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                            <div className="flex items-center space-x-3 mb-4">
                                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                                <Edit className="h-5 w-5 text-primary" />
                                              </div>
                                              <div>
                                                <DialogTitle className="text-lg font-semibold">Alt Menü Düzenle</DialogTitle>
                                                <DialogDescription className="text-sm text-muted-foreground">
                                                  Alt menü bilgilerini güncelleyin.
                                                </DialogDescription>
                                              </div>
                                            </div>
                                            <form action={handleUpdateSubMenu} className="space-y-6">
                                              <div className="space-y-2">
                                                <Label htmlFor="edit_submenu_menu_id" className="text-sm font-medium">Üst Menü</Label>
                                                <Select
                                                  name="menu_id"
                                                  defaultValue={editingSubMenu?.menu_id}
                                                  required
                                                >
                                                  <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Menü seçin..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {menuCategories.flatMap(cat =>
                                                      cat.menus?.map(m => (
                                                        <SelectItem key={m.id} value={m.id}>
                                                          <div className="flex flex-col">
                                                            <span className="font-medium">{m.title}</span>
                                                            <span className="text-xs text-muted-foreground">{cat.name}</span>
                                                          </div>
                                                        </SelectItem>
                                                      )) || []
                                                    )}
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label htmlFor="edit_submenu_name" className="text-sm font-medium">Ad</Label>
                                                  <Input
                                                    id="edit_submenu_name"
                                                    name="name"
                                                    defaultValue={editingSubMenu?.name}
                                                    placeholder="Alt menü adı"
                                                    required
                                                    className="w-full"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label htmlFor="edit_submenu_slug" className="text-sm font-medium">Slug</Label>
                                                  <Input
                                                    id="edit_submenu_slug"
                                                    name="slug"
                                                    defaultValue={editingSubMenu?.slug}
                                                    placeholder="/alt-menu-slug"
                                                    required
                                                    className="w-full"
                                                  />
                                                </div>
                                              </div>

                                              <div className="space-y-2">
                                                <Label htmlFor="edit_submenu_description" className="text-sm font-medium">Açıklama</Label>
                                                <Textarea
                                                  id="edit_submenu_description"
                                                  name="description"
                                                  defaultValue={editingSubMenu?.description}
                                                  placeholder="Alt menü açıklaması..."
                                                  className="min-h-[80px] resize-none"
                                                />
                                              </div>

                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label htmlFor="edit_submenu_image_url" className="text-sm font-medium">Resim URL</Label>
                                                  <Input
                                                    id="edit_submenu_image_url"
                                                    name="image_url"
                                                    defaultValue={editingSubMenu?.image_url}
                                                    placeholder="https://..."
                                                    className="w-full"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label htmlFor="edit_submenu_order" className="text-sm font-medium">Sıra</Label>
                                                  <Input
                                                    id="edit_submenu_order"
                                                    name="order"
                                                    type="number"
                                                    defaultValue={editingSubMenu?.order}
                                                    min="0"
                                                    className="w-full"
                                                  />
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between pt-4 border-t">
                                                <div className="flex items-center space-x-2">
                                                  <Switch
                                                    id="edit_submenu_is_active"
                                                    name="is_active"
                                                    defaultChecked={editingSubMenu?.is_active}
                                                  />
                                                  <Label htmlFor="edit_submenu_is_active" className="text-sm font-medium">Aktif</Label>
                                                </div>
                                                <div className="flex space-x-3">
                                                  <Button type="button" variant="outline" onClick={() => setEditingSubMenu(null)}>
                                                    İptal
                                                  </Button>
                                                  <Button type="submit" className="gap-2">
                                                    <Edit className="w-4 h-4" />
                                                    Güncelle
                                                  </Button>
                                                </div>
                                              </div>
                                            </form>
                                          </DialogContent>
                                        </Dialog>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteSubMenu(subMenu.id)}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Featured Items */}
                          {menu.featured_items && menu.featured_items.length > 0 && (
                            <div className="mt-3">
                              <h6 className="text-sm font-medium mb-2">Öne Çıkan Ürünler</h6>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {menu.featured_items.slice(0, 4).map((item) => (
                                  <div key={item.id} className="p-2 border rounded text-xs">
                                    {item.name}
                                  </div>
                                ))}
                                {menu.featured_items.length > 4 && (
                                  <div className="p-2 border rounded text-xs text-muted-foreground">
                                    +{menu.featured_items.length - 4} daha fazla
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!category.menus || category.menus.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Bu kategoride henüz menü oluşturulmamış
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {menuCategories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Henüz hiç kategori oluşturulmamış
        </div>
      )}

      {/* Delete Menu Confirmation Dialog */}
      <AlertDialog open={!!deleteMenuId} onOpenChange={() => setDeleteMenuId(null)}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-lg font-semibold">Menü Silme Onayı</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  Bu işlem geri alınamaz. Menüye bağlı tüm alt menüler ve öne çıkan ürünler de kalıcı olarak silinecektir.
                </AlertDialogDescription>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <AlertDialogCancel className="px-4 py-2">İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteMenu}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete SubMenu Confirmation Dialog */}
      <AlertDialog open={!!deleteSubMenuId} onOpenChange={() => setDeleteSubMenuId(null)}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-lg font-semibold">Alt Menü Silme Onayı</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  Bu alt menüyü silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <AlertDialogCancel className="px-4 py-2">İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteSubMenu}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Tables Confirmation Dialog */}
      <AlertDialog open={createTablesConfirmOpen} onOpenChange={setCreateTablesConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <AlertDialogTitle className="text-lg font-semibold">Tablo Oluşturma Onayı</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  Bu işlem veritabanında yeni tablolar oluşturacaktır. Mevcut verileriniz etkilenmeyecektir.
                </AlertDialogDescription>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <AlertDialogCancel className="px-4 py-2">İptal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCreateMenuTables}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2"
              >
                <Database className="w-4 h-4 mr-2" />
                Oluştur
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default MenuManagement
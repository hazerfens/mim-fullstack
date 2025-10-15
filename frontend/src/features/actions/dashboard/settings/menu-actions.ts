'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

// Helper function to get auth headers
async function getAuthHeaders() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value
  
  if (!token) {
    throw new Error('No access token found')
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

// Create menu
export async function createMenu(formData: FormData) {
  try {
    const menu_category_id = formData.get('menu_category_id') as string
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const is_active = formData.get('is_active') === 'on'

    if (!menu_category_id || menu_category_id.trim() === '') {
      throw new Error('Kategori seçimi zorunludur')
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/menus`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        menu_category_id,
        title,
        description,
        slug,
        url,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Menü oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Menu creation error:', error)
    throw new Error('Menü oluşturulurken bir hata oluştu')
  }
}

// Update menu
export async function updateMenu(menuId: string, formData: FormData) {
  try {
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/menus/${menuId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        title,
        description,
        slug,
        url,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Menü güncellenemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Menu update error:', error)
    throw new Error('Menü güncellenirken bir hata oluştu')
  }
}

// Delete menu
export async function deleteMenu(menuId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/menus/${menuId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Menü silinemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Menu deletion error:', error)
    throw new Error('Menü silinirken bir hata oluştu')
  }
}

// Create menu category
export async function createMenuCategory(formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/menu-categories`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Kategori oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Category creation error:', error)
    throw new Error('Kategori oluşturulurken bir hata oluştu')
  }
}

// Update menu category
export async function updateMenuCategory(categoryId: string, formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Kategori güncellenemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Category update error:', error)
    throw new Error('Kategori güncellenirken bir hata oluştu')
  }
}

// Delete menu category
export async function deleteMenuCategory(categoryId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-categories/${categoryId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Kategori silinemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Category deletion error:', error)
    throw new Error('Kategori silinirken bir hata oluştu')
  }
}

// Create menu item
export async function createMenuItem(formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        url,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Ürün oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Item creation error:', error)
    throw new Error('Ürün oluşturulurken bir hata oluştu')
  }
}

// Update menu item
export async function updateMenuItem(itemId: string, formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        url,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Ürün güncellenemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Item update error:', error)
    throw new Error('Ürün güncellenirken bir hata oluştu')
  }
}

// Delete menu item
export async function deleteMenuItem(itemId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-items/${itemId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Ürün silinemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Item deletion error:', error)
    throw new Error('Ürün silinirken bir hata oluştu')
  }
}

// Create featured item
export async function createMenuFeaturedItem(formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const price = parseFloat(formData.get('price') as string) || 0
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-featured-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        url,
        price,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Öne çıkan ürün oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Featured item creation error:', error)
    throw new Error('Öne çıkan ürün oluşturulurken bir hata oluştu')
  }
}

// Update featured item
export async function updateMenuFeaturedItem(itemId: string, formData: FormData) {
  try {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const url = formData.get('url') as string
    const price = parseFloat(formData.get('price') as string) || 0
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-featured-items/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        image_url,
        slug,
        url,
        price,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Öne çıkan ürün güncellenemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Featured item update error:', error)
    throw new Error('Öne çıkan ürün güncellenirken bir hata oluştu')
  }
}

// Delete featured item
export async function deleteMenuFeaturedItem(itemId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/system/menu-featured-items/${itemId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error('Öne çıkan ürün silinemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Featured item deletion error:', error)
    throw new Error('Öne çıkan ürün silinirken bir hata oluştu')
  }
}

// Create menu tables (migration)
export async function createMenuTables() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/create-menu-tables`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Menu tabloları oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('Menu tables creation error:', error)
    throw new Error('Menu tabloları oluşturulurken bir hata oluştu')
  }
}

// Get menus
export async function getMenus() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/system/menu-categories`, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error('Menü kategorileri yüklenemedi')
    }

    return await response.json()
  } catch (error) {
    console.error('Menu fetch error:', error)
    throw new Error('Menü kategorileri yüklenirken bir hata oluştu')
  }
}

// Create sub-menu
export async function createSubMenu(formData: FormData) {
  try {
    const menu_id = formData.get('menu_id') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/sub-menus`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        menu_id,
        name,
        description,
        image_url,
        slug,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Alt menü oluşturulamadı')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('SubMenu creation error:', error)
    throw new Error('Alt menü oluşturulurken bir hata oluştu')
  }
}

// Update sub-menu
export async function updateSubMenu(subMenuId: string, formData: FormData) {
  try {
    const menu_id = formData.get('menu_id') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const image_url = formData.get('image_url') as string
    const slug = formData.get('slug') as string
    const order = parseInt(formData.get('order') as string) || 0
    const is_active = formData.get('is_active') === 'on'

    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/sub-menus/${subMenuId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        menu_id,
        name,
        description,
        image_url,
        slug,
        order,
        is_active,
      }),
    })

    if (!response.ok) {
      throw new Error('Alt menü güncellenemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('SubMenu update error:', error)
    throw new Error('Alt menü güncellenirken bir hata oluştu')
  }
}

// Delete sub-menu
export async function deleteSubMenu(subMenuId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/admin/system/sub-menus/${subMenuId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error('Alt menü silinemedi')
    }

    revalidatePath('/dashboard/settings/menus')
    return { success: true }
  } catch (error) {
    console.error('SubMenu deletion error:', error)
    throw new Error('Alt menü silinirken bir hata oluştu')
  }
}
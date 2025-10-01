'use server';

import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1';

// Yardımcı fonksiyon: Authorization header'ı almak için
async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    throw new Error('No access token found');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

// Permission türleri
export interface PermissionDetail {
  create?: boolean;
  read?: boolean;
  update?: boolean;
  delete?: boolean;
}

export interface Permissions {
  users?: PermissionDetail;
  companies?: PermissionDetail;
  roles?: PermissionDetail;
  branches?: PermissionDetail;
  departments?: PermissionDetail;
  reports?: PermissionDetail;
  settings?: PermissionDetail;
}

// Rol türleri
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  is_active: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_id?: string;
  role_name?: string;
  is_active: boolean;
  image_url?: string;
  created_at: string;
}

export interface CreateRoleData {
  name: string;
  description: string;
  permissions?: Permissions;
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissions?: Permissions;
  is_active?: boolean;
}

// Tüm rolleri getir
export async function getRolesAction() {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Roller getirilirken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      roles: data.roles || []
    };
  } catch (error) {
    console.error('getRolesAction error:', error);
    return {
      status: 'error',
      message: 'Roller getirilirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Tek rolü getir
export async function getRoleAction(roleId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles/${roleId}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol getirilirken hata oluştu',
        statusCode: res.status
      };
    }

    const role = await res.json();
    return {
      status: 'success',
      role
    };
  } catch (error) {
    console.error('getRoleAction error:', error);
    return {
      status: 'error',
      message: 'Rol getirilirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Rol oluştur
export async function createRoleAction(roleData: CreateRoleData) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify(roleData),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol oluşturulurken hata oluştu',
        statusCode: res.status
      };
    }

    const role = await res.json();
    return {
      status: 'success',
      role,
      message: 'Rol başarıyla oluşturuldu'
    };
  } catch (error) {
    console.error('createRoleAction error:', error);
    return {
      status: 'error',
      message: 'Rol oluşturulurken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Rol güncelle
export async function updateRoleAction(roleId: string, roleData: UpdateRoleData) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles/${roleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(roleData),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol güncellenirken hata oluştu',
        statusCode: res.status
      };
    }

    const role = await res.json();
    return {
      status: 'success',
      role,
      message: 'Rol başarıyla güncellendi'
    };
  } catch (error) {
    console.error('updateRoleAction error:', error);
    return {
      status: 'error',
      message: 'Rol güncellenirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Rol sil
export async function deleteRoleAction(roleId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles/${roleId}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol silinirken hata oluştu',
        statusCode: res.status
      };
    }

    return {
      status: 'success',
      message: 'Rol başarıyla silindi'
    };
  } catch (error) {
    console.error('deleteRoleAction error:', error);
    return {
      status: 'error',
      message: 'Rol silinirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Kullanıcıya rol ata
export async function assignRoleToUserAction(userId: string, roleId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles/${userId}/assign-role`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ role_id: roleId }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol atanırken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      user: data.user,
      role: data.role,
      message: 'Rol başarıyla atandı'
    };
  } catch (error) {
    console.error('assignRoleToUserAction error:', error);
    return {
      status: 'error',
      message: 'Rol atanırken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Kullanıcıdan rol kaldır
export async function removeRoleFromUserAction(userId: string, roleId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/roles/assign/${userId}/${roleId}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol kaldırılırken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      user: data.user,
      message: 'Rol başarıyla kaldırıldı'
    };
  } catch (error) {
    console.error('removeRoleFromUserAction error:', error);
    return {
      status: 'error',
      message: 'Rol kaldırılırken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Tüm kullanıcıları getir
export async function getUsersAction() {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/users`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Kullanıcılar getirilirken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      users: data.users || []
    };
  } catch (error) {
    console.error('getUsersAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcılar getirilirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Kullanıcı permission'larını getir (role'dan hesaplanan)
export async function getUserPermissionsAction(userId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/users/${userId}/permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Kullanıcı izinleri getirilirken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      permissions: data.permissions || {}
    };
  } catch (error) {
    console.error('getUserPermissionsAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcı izinleri getirilirken bir hata oluştu',
      statusCode: 500
    };
  }
}
"use server";

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

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

import type { Permissions, PermissionCatalogEntry } from '@/lib/permissions';
import { permissionsFromNames } from '@/lib/permissions';
import { broadcastUserEvent, broadcastRoleEvent, broadcastPermissionEvent } from '@/lib/server-sse';

// Rol türleri
export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  is_active: boolean;
  created_at: string;
  company_id?: string | null;
  created_by_id?: string | null;
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
  // optional fields used when mapping company members into the user list
  is_orphaned?: boolean;
  member_id?: string;
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
export async function getRolesAction(companyId?: string) {
  try {
    const headers = await getAuthHeaders();
  const url = companyId ? `${API_URL}/roles?company_id=${companyId}` : `${API_URL}/roles/system`;

    const res = await fetch(url, {
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
export async function createRoleAction(roleData: CreateRoleData, companyId?: string) {
  try {
    const headers = await getAuthHeaders();

    let res;
    if (companyId) {
      res = await fetch(`${API_URL}/company/${companyId}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(roleData),
        cache: 'no-store',
      });
    } else {
      res = await fetch(`${API_URL}/roles`, {
        method: 'POST',
        headers,
        body: JSON.stringify(roleData),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol oluşturulurken hata oluştu',
        statusCode: res.status
      };
    }

    const role = await res.json();
    // Revalidate only the specific pages affected by role creation so we avoid
    // triggering broad page-level reloads that cause many ancillary requests
    try {
      // Roles settings page always needs refresh
      revalidatePath('/dashboard/company/settings/roles');
      // If this is a company-scoped role, refresh the company settings page
      if (companyId) revalidatePath('/dashboard/company/settings');
    } catch {
      // ignore
    }
    try { broadcastRoleEvent({ type: 'role.created', role: role.role || role }) } catch {}
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
export async function updateRoleAction(roleId: string, roleData: UpdateRoleData, companyId?: string) {
  try {
    const headers = await getAuthHeaders();

    let res;
    if (companyId) {
      res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(roleData),
        cache: 'no-store',
      });
    } else {
      res = await fetch(`${API_URL}/roles/${roleId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(roleData),
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol güncellenirken hata oluştu',
        statusCode: res.status
      };
    }

    const role = await res.json();
    try {
      revalidatePath('/dashboard/company/settings/roles');
      if (companyId) revalidatePath('/dashboard/company/settings');
    } catch {}
    try { broadcastRoleEvent({ type: 'role.updated', role: role.role || role }) } catch {}
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
export async function deleteRoleAction(roleId: string, companyId?: string) {
  try {
    const headers = await getAuthHeaders();

    let res;
    if (companyId) {
      res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}`, {
        method: 'DELETE',
        headers,
        cache: 'no-store',
      });
    } else {
      res = await fetch(`${API_URL}/roles/${roleId}`, {
        method: 'DELETE',
        headers,
        cache: 'no-store',
      });
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol silinirken hata oluştu',
        statusCode: res.status
      };
    }

    try {
      revalidatePath('/dashboard/company/settings/roles');
      if (companyId) revalidatePath('/dashboard/company/settings');
    } catch {}
    try { broadcastRoleEvent({ type: 'role.deleted', roleId: roleId }) } catch {}
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

    const res = await fetch(`${API_URL}/roles/assign`, {
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
    try {
      // Assignment changes only affect member lists
      revalidatePath('/dashboard/company/members');
    } catch {}
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
    try {
      revalidatePath('/dashboard/company/members');
    } catch {}
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

// Assign role to a company member (owner/admin action)
export async function assignRoleToCompanyMemberAction(companyId: string, memberId: string, roleId: string) {
  try {
    const headers = await getAuthHeaders();

    const res = await fetch(`${API_URL}/company/${companyId}/members/${memberId}/role`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ role_id: roleId }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Rol atanırken hata oluştu',
        statusCode: res.status,
      };
    }

    try {
      revalidatePath('/');
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/company/members');
    } catch {}
    return {
      status: 'success',
      message: 'Rol başarıyla atandı',
    };
  } catch (error) {
    console.error('assignRoleToCompanyMemberAction error:', error);
    return {
      status: 'error',
      message: 'Rol atanırken bir hata oluştu',
      statusCode: 500,
    };
  }
}

// Get permission catalog (admin)
export async function getPermissionCatalogAction(opts?: { all?: boolean }) {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams()
    if (opts?.all) params.set('all', '1')
    const res = await fetch(`${API_URL}/permissions${params.toString() ? `?${params.toString()}` : ''}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Permission catalog yüklenemedi', statusCode: res.status };
    }
    const data = await res.json();
    return { status: 'success', permissions: data.permissions as PermissionCatalogEntry[] || [] };
  } catch (error) {
    console.error('getPermissionCatalogAction error:', error);
    return { status: 'error', message: 'Permission catalog yüklenirken hata oluştu', statusCode: 500 };
  }
}

// NOTE: permission helper functions live in shared lib '@/lib/permissions'

// Update role by providing flat permission names (converts to nested Permissions and calls updateRoleAction)
export async function updateRoleWithPermissionNames(roleId: string, names: string[], companyId?: string) {
  const perms = permissionsFromNames(names);
  return await updateRoleAction(roleId, { permissions: perms }, companyId);
}

// Paginated users listing server action
export async function getUsersPaginatedAction(opts?: { page?: number; pageSize?: number; q?: string; excludeRole?: string }) {
  try {
    const headers = await getAuthHeaders();
    const page = opts?.page || 1;
    const pageSize = opts?.pageSize || 20;
    const q = opts?.q || '';
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (q) params.set('q', q);
    if (opts?.excludeRole) params.set('exclude_role', opts.excludeRole);

    const res = await fetch(`${API_URL}/users?${params.toString()}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Kullanıcılar getirilirken hata oluştu', statusCode: res.status };
    }

    const data = await res.json();
    // Expect backend to return { users: [], total: number, page, page_size }
    return { status: 'success', users: data.users || [], total: data.total || 0, page: data.page || page, pageSize: data.page_size || pageSize };
  } catch (error) {
    console.error('getUsersPaginatedAction error:', error);
    return { status: 'error', message: 'Kullanıcılar getirilirken bir hata oluştu', statusCode: 500 };
  }
}

// Update user server action
export async function updateUserAction(userId: string, payload: Partial<User>) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: err.error || 'Kullanıcı güncellenirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/users'); } catch {}
    // broadcast change for real-time UI
    try { broadcastUserEvent({ type: 'user.updated', user: data.user || data }); } catch {}
    return { status: 'success', user: data.user || data, message: 'Kullanıcı başarıyla güncellendi' };
  } catch (error) {
    console.error('updateUserAction error:', error);
    return { status: 'error', message: 'Kullanıcı güncellenirken hata oluştu', statusCode: 500 };
  }
}

// Delete user server action
export async function deleteUserAction(userId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: err.error || 'Kullanıcı silinirken hata oluştu', statusCode: res.status };
    }
    try { revalidatePath('/dashboard/company/settings/users'); } catch {}
    try { broadcastUserEvent({ type: 'user.deleted', userId }); } catch {}
    return { status: 'success', message: 'Kullanıcı başarıyla silindi' };
  } catch (error) {
    console.error('deleteUserAction error:', error);
    return { status: 'error', message: 'Kullanıcı silinirken hata oluştu', statusCode: 500 };
  }
}

// Create a new permission catalog entry (admin)
export async function createPermissionAction(payload: { name: string; display_name?: string | null; description?: string | null; is_active?: boolean }) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: err.error || 'Permission oluşturulurken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
  try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
  try { broadcastPermissionEvent({ type: 'permission.created', permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('createPermissionAction error:', error);
    return { status: 'error', message: 'Permission oluşturulurken hata oluştu', statusCode: 500 };
  }
}

// Update permission metadata (admin)
export async function updatePermissionAction(name: string, patch: Record<string, unknown>) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/permissions/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patch),
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: err.error || 'Permission güncellenirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
  try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
  try { broadcastPermissionEvent({ type: 'permission.updated', permission: data.permission || data }) } catch {}
  return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('updatePermissionAction error:', error);
    return { status: 'error', message: 'Permission güncellenirken hata oluştu', statusCode: 500 };
  }
}

// Delete permission (admin)
export async function deletePermissionAction(name: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/permissions/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: err.error || 'Permission silinirken hata oluştu', statusCode: res.status };
    }
  try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
  try { broadcastPermissionEvent({ type: 'permission.deleted', name }) } catch {}
  return { status: 'success' };
  } catch (error) {
    console.error('deletePermissionAction error:', error);
    return { status: 'error', message: 'Permission silinirken hata oluştu', statusCode: 500 };
  }
}

// Check allowed actions for a list of permission names for a specific user.
export async function getAllowedActionsForUserForPermissionNames(userId: string, names: string[], companyId?: string) {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (companyId) params.set('company_id', companyId);
    // Use aggregated POST endpoint to reduce round-trips
    const body = JSON.stringify({ user_id: userId, names, company_id: companyId })
    const res = await fetch(`${API_URL}/permissions/aggregate/check`, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      return { status: 'error', message: error.error || 'Failed to check permissions', statusCode: res.status }
    }
    const data = await res.json()
    return { status: 'success', allowed: data.allowed || {} }
  } catch (err) {
    console.error('getAllowedActionsForUserForPermissionNames error:', err)
    return { status: 'error', message: 'Failed to check permissions', statusCode: 500 }
  }
}

// ===== CASBIN-BASED USER PERMISSION MANAGEMENT =====

// Get user custom permissions (Casbin-based)
export async function getUserCustomPermissionsAction(userId: string) {
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
        message: error.error || 'Kullanıcı özel izinleri getirilirken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    return {
      status: 'success',
      permissions: data.permissions || []
    };
  } catch (error) {
    console.error('getUserCustomPermissionsAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcı özel izinleri getirilirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// RolePermission type returned by role permission endpoints
export interface RolePermission {
  id: string;
  role_id: string;
  resource: string;
  action: string;
  effect?: string;
  domain?: string;
  is_active?: boolean;
  conditions?: any;
  created_at?: string;
  updated_at?: string;
}

// Company-scoped: Get persisted role_permissions for a company role
export async function getCompanyRolePermissionsAction(companyId: string, roleId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}/permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permissions yüklenemedi', statusCode: res.status };
    }
    const data = await res.json();
    return { status: 'success', permissions: data.permissions as RolePermission[] || [] };
  } catch (error) {
    console.error('getCompanyRolePermissionsAction error:', error);
    return { status: 'error', message: 'Role permissions yüklenirken hata oluştu', statusCode: 500 };
  }
}

// Company-scoped: Toggle/update a persisted RolePermission by ID
export async function updateCompanyRolePermissionAction(companyId: string, roleId: string, permissionId: string, isActive: boolean) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_active: isActive }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission değiştirilirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.toggled', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('updateCompanyRolePermissionAction error:', error);
    return { status: 'error', message: 'Role permission değiştirilirken hata oluştu', statusCode: 500 };
  }
}

// System/global: Get persisted role_permissions for a global role
export async function getRolePermissionsAction(roleId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/roles/${roleId}/permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permissions yüklenemedi', statusCode: res.status };
    }
    const data = await res.json();
    return { status: 'success', permissions: data.permissions as RolePermission[] || [] };
  } catch (error) {
    console.error('getRolePermissionsAction error:', error);
    return { status: 'error', message: 'Role permissions yüklenirken hata oluştu', statusCode: 500 };
  }
}

// System/global: Toggle/update a persisted RolePermission for a global role (admin only)
export async function updateRolePermissionAction(roleId: string, permissionId: string, isActive: boolean) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_active: isActive }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission değiştirilirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.toggled', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('updateRolePermissionAction error:', error);
    return { status: 'error', message: 'Role permission değiştirilirken hata oluştu', statusCode: 500 };
  }
}

// Create user custom permission (Casbin-based)
export async function createUserCustomPermissionAction(userId: string, permissionData: { resource: string; action: string; domain?: string }) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/users/${userId}/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(permissionData),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Kullanıcı özel izni oluşturulurken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    try {
      revalidatePath('/dashboard/company/settings/roles');
      revalidatePath('/dashboard/company/settings/users');
    } catch {}
    try { broadcastUserEvent({ type: 'user.custom_permission.created', userId, permission: data }) } catch {}
    return {
      status: 'success',
      permission: data,
      message: 'Kullanıcı özel izni başarıyla oluşturuldu'
    };
  } catch (error) {
    console.error('createUserCustomPermissionAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcı özel izni oluşturulurken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Update user custom permission (Casbin-based)
export async function updateUserCustomPermissionAction(userId: string, permissionId: string, permissionData: { resource?: string; action?: string; domain?: string }) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/users/${userId}/permissions/${permissionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(permissionData),
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Kullanıcı özel izni güncellenirken hata oluştu',
        statusCode: res.status
      };
    }

    const data = await res.json();
    try {
      revalidatePath('/dashboard/company/settings/roles');
      revalidatePath('/dashboard/company/settings/users');
    } catch {}
    try { broadcastUserEvent({ type: 'user.custom_permission.updated', userId, permission: data }) } catch {}
    return {
      status: 'success',
      permission: data,
      message: 'Kullanıcı özel izni başarıyla güncellendi'
    };
  } catch (error) {
    console.error('updateUserCustomPermissionAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcı özel izni güncellenirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Delete user custom permission (Casbin-based)
export async function deleteUserCustomPermissionAction(userId: string, permissionId: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/users/${userId}/permissions/${permissionId}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error',
        message: error.error || 'Kullanıcı özel izni silinirken hata oluştu',
        statusCode: res.status
      };
    }

    try {
      revalidatePath('/dashboard/company/settings/roles');
      revalidatePath('/dashboard/company/settings/users');
    } catch {}
    try { broadcastUserEvent({ type: 'user.custom_permission.deleted', userId, permissionId }) } catch {}
    return {
      status: 'success',
      message: 'Kullanıcı özel izni başarıyla silindi'
    };
  } catch (error) {
    console.error('deleteUserCustomPermissionAction error:', error);
    return {
      status: 'error',
      message: 'Kullanıcı özel izni silinirken bir hata oluştu',
      statusCode: 500
    };
  }
}

// Create a persisted RolePermission for a company-scoped role
export async function createCompanyRolePermissionAction(companyId: string, roleId: string, payload: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission oluşturulamadı', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.created', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('createCompanyRolePermissionAction error:', error);
    return { status: 'error', message: 'Role permission oluşturulurken hata oluştu', statusCode: 500 };
  }
}

// Create a persisted RolePermission for a system/global role
export async function createRolePermissionAction(roleId: string, payload: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/roles/${roleId}/permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission oluşturulamadı', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.created', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('createRolePermissionAction error:', error);
    return { status: 'error', message: 'Role permission oluşturulurken hata oluştu', statusCode: 500 };
  }
}

// Row-level PUT: update a persisted role_permission row (company-scoped)
export async function updateCompanyRolePermissionByIdAction(companyId: string, roleId: string, permissionId: string, payload: Record<string, any>) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/company/${companyId}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission değiştirilirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.updated', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('updateCompanyRolePermissionByIdAction error:', error);
    return { status: 'error', message: 'Role permission güncellenirken hata oluştu', statusCode: 500 };
  }
}

// Row-level PUT: update a persisted role_permission row (system/global)
export async function updateRolePermissionByIdAction(roleId: string, permissionId: string, payload: Record<string, any>) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/roles/${roleId}/permissions/${permissionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error', message: error.error || 'Role permission değiştirilirken hata oluştu', statusCode: res.status };
    }
    const data = await res.json();
    try { revalidatePath('/dashboard/company/settings/roles'); } catch {}
    try { broadcastRoleEvent({ type: 'role.permission.updated', roleId, permission: data.permission || data }) } catch {}
    return { status: 'success', permission: data.permission || data };
  } catch (error) {
    console.error('updateRolePermissionByIdAction error:', error);
    return { status: 'error', message: 'Role permission güncellenirken hata oluştu', statusCode: 500 };
  }
}
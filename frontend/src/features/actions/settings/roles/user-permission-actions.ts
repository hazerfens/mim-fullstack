'use server'

import { cookies } from 'next/headers'

const API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:3333/api/v1'

async function getAuthHeaders() {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token')?.value

  if (!token) {
    throw new Error('No access token found')
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

export interface TimeRestriction {
  allowed_days?: number[] // [1,2,3,4,5] = Monday-Friday
  start_time?: string // "08:00"
  end_time?: string // "18:00"
  start_date?: string // ISO date
  end_date?: string // ISO date
}

export interface UserPermission {
  id: string
  user_id: string
  resource: string // users, roles, settings, reports
  action: string // create, read, update, delete
  is_allowed: boolean
  time_restriction?: TimeRestriction | null
  priority: number
  created_at: string
  updated_at: string
}

export interface CreateUserPermissionData {
  resource: string
  action: string
  is_allowed: boolean
  time_restriction?: TimeRestriction | null
  priority?: number
}

export interface UpdateUserPermissionData {
  resource?: string
  action?: string
  is_allowed?: boolean
  time_restriction?: TimeRestriction | null
  priority?: number
}

// Get user custom permissions
export async function getUserCustomPermissionsAction(userId: string) {
  try {
    const headers = await getAuthHeaders()

    const res = await fetch(`${API_URL}/users/${userId}/custom-permissions`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      return {
        status: 'error',
        message: error.error || 'Failed to fetch permissions',
        statusCode: res.status,
      }
    }

    const data = await res.json()
    return {
      status: 'success',
      permissions: data.permissions || [],
    }
  } catch (error) {
    console.error('getUserCustomPermissionsAction error:', error)
    return {
      status: 'error',
      message: 'Failed to fetch permissions',
      statusCode: 500,
    }
  }
}

// Create user custom permission
export async function createUserCustomPermissionAction(userId: string, data: CreateUserPermissionData) {
  try {
    const headers = await getAuthHeaders()

    const res = await fetch(`${API_URL}/users/${userId}/custom-permissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      return {
        status: 'error',
        message: error.error || 'Failed to create permission',
        statusCode: res.status,
      }
    }

    const permission = await res.json()
    return {
      status: 'success',
      permission,
    }
  } catch (error) {
    console.error('createUserCustomPermissionAction error:', error)
    return {
      status: 'error',
      message: 'Failed to create permission',
      statusCode: 500,
    }
  }
}

// Update user custom permission
export async function updateUserCustomPermissionAction(
  userId: string,
  permissionId: string,
  data: UpdateUserPermissionData
) {
  try {
    const headers = await getAuthHeaders()

    const res = await fetch(`${API_URL}/users/${userId}/custom-permissions/${permissionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      return {
        status: 'error',
        message: error.error || 'Failed to update permission',
        statusCode: res.status,
      }
    }

    const permission = await res.json()
    return {
      status: 'success',
      permission,
    }
  } catch (error) {
    console.error('updateUserCustomPermissionAction error:', error)
    return {
      status: 'error',
      message: 'Failed to update permission',
      statusCode: 500,
    }
  }
}

// Delete user custom permission
export async function deleteUserCustomPermissionAction(userId: string, permissionId: string) {
  try {
    const headers = await getAuthHeaders()

    const res = await fetch(`${API_URL}/users/${userId}/custom-permissions/${permissionId}`, {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }))
      return {
        status: 'error',
        message: error.error || 'Failed to delete permission',
        statusCode: res.status,
      }
    }

    return {
      status: 'success',
      message: 'Permission deleted successfully',
    }
  } catch (error) {
    console.error('deleteUserCustomPermissionAction error:', error)
    return {
      status: 'error',
      message: 'Failed to delete permission',
      statusCode: 500,
    }
  }
}

 'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const BACKEND_API_URL =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  'http://localhost:3333/api/v1';

const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');
const backendApiUrl = trimTrailingSlash(BACKEND_API_URL);

// Helper to get access token
async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value ?? null;
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export interface CreateCompanyData {
  unvani?: string;
  adi?: string;
  name?: string;
  slug?: string;
  logo?: string | null;
  logo2?: string | null;
  email?: string | null;
  vd?: string | null;
  vn?: string | null;
  mersis?: string | null;
  oda?: string | null;
  odano?: string | null;
  phone?: string | null;
  phone2?: string | null;
  fax?: string | null;
  cellphone?: string | null;
  url?: string | null;
  address?: Record<string, string> | null;
  coordinates?: { lat: number; lng: number } | null;
  workinghours?: Record<string, unknown> | null;
}

// Minimal Company type used by frontend
export interface Company {
  id: string;
  name?: string | null;
  adi?: string | null;
  unvani?: string | null;
  slug?: string | null;
  is_active?: boolean;
  email?: string | null;
  phone?: string | null;
  cellphone?: string | null;
  url?: string | null;
  vd?: string | null;
  vn?: string | null;
  mersis?: string | null;
  oda?: string | null;
  odano?: string | null;
  logo?: string | null;
  address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
  } | null;
  coordinates?: {
    lat?: number | null;
    lng?: number | null;
  } | null;
  [key: string]: unknown;
}

/**
 * Create a new company (Server Action)
 */
export async function createCompanyAction(data: CreateCompanyData) {
  const token = await getAccessToken();
  
  if (!token) {
    return {
      status: 'error' as const,
      message: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.',
      statusCode: 401,
    };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error' as const,
        message: errorData.error || 'Şirket oluşturulamadı',
        statusCode: response.status,
      };
    }

    const company = await response.json();
    return {
      status: 'success' as const,
      message: 'Şirket başarıyla oluşturuldu',
      data: company,
    };
  } catch (error) {
    console.error('Create company error:', error);
    return {
      status: 'error' as const,
      message: error instanceof Error ? error.message : 'Bir hata oluştu',
      statusCode: 500,
    };
  }
}

/**
 * Get user's companies (Server Action)
 */
export async function getUserCompaniesAction() {
  const token = await getAccessToken();
  
  if (!token) {
    return {
      status: 'error' as const,
      message: 'Oturum bulunamadı',
      statusCode: 401,
    };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company`, {
      method: 'GET',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        status: 'error' as const,
        message: 'Şirketler yüklenemedi',
        statusCode: response.status,
      };
    }

    const companies = await response.json();
    return {
      status: 'success' as const,
      data: companies,
    };
  } catch (error) {
    console.error('Get companies error:', error);
    return {
      status: 'error' as const,
      message: 'Bir hata oluştu',
      statusCode: 500,
    };
  }
}

/**
 * Get active company (Server Action)
 */
export async function getActiveCompanyAction() {
  const cookieStore = await cookies();
  // Prefer server-provided snapshot to avoid an extra backend request
  // during server renders (set during login/refresh flows).
  try {
    const initialActive = cookieStore.get('initialActiveCompany')?.value ?? null;
    if (initialActive) {
      try {
        const parsed = JSON.parse(initialActive);
        // Try to enrich the snapshot with whether current user is owner
        // by inspecting the initialUser cookie (if available) or by
        // querying the members endpoint below when necessary.
        let userId: string | null = null;
        try {
          const initialUserRaw = cookieStore.get('initialUser')?.value ?? null;
          if (initialUserRaw) {
            const parsedUser = JSON.parse(initialUserRaw);
            userId = parsedUser?.id ?? parsedUser?.sub ?? null;
          }
        } catch {}

        // If we have both company and user, try to fetch members to determine ownership.
        try {
          if (parsed && parsed.id && userId) {
            const token = await getAccessToken();
            if (token) {
              const membersRes = await fetch(`${backendApiUrl}/company/${parsed.id}/members`, {
                method: 'GET',
                headers: await getAuthHeaders(),
                cache: 'no-store',
              });
              if (membersRes.ok) {
                const membersBody = await membersRes.json().catch(() => ({}));
                const members = membersBody.members || [];
                const myMember = members.find((m: any) => {
                  // Compare with both user.id and user_id
                  const uId = m?.user?.id ?? m?.user_id;
                  return uId && String(uId) === String(userId);
                });
                parsed.is_owner = !!(myMember && myMember.is_owner);
              }
            }
          }
        } catch (e) {
          /* ignore member fetch errors */
        }

        return { status: 'success' as const, data: parsed };
      } catch {
        // fall through to normal fetch if parsing fails
      }
    }
  } catch {}

  const token = await getAccessToken();
  
  if (!token) {
    return {
      status: 'error' as const,
      message: 'Oturum bulunamadı',
      statusCode: 401,
    };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company/active`, {
      method: 'GET',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (response.status === 404) {
      return {
        status: 'not_found' as const,
        message: 'Aktif şirket bulunamadı',
      };
    }

    if (!response.ok) {
      return {
        status: 'error' as const,
        message: 'Aktif şirket yüklenemedi',
        statusCode: response.status,
      };
    }

    const company = await response.json();
    return {
      status: 'success' as const,
      data: company,
    };
  } catch (error) {
    console.error('Get active company error:', error);
    return {
      status: 'error' as const,
      message: 'Bir hata oluştu',
      statusCode: 500,
    };
  }
}

/**
 * Get all active companies (admin only)
 */
export async function getAllCompaniesForAdminAction() {
  const token = await getAccessToken();
  if (!token) {
    return { status: 'error' as const, message: 'Oturum bulunamadı', statusCode: 401 };
  }

  try {
    const response = await fetch(`${backendApiUrl}/admin/companies`, {
      method: 'GET',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { status: 'error' as const, message: 'Şirketler yüklenemedi', statusCode: response.status };
    }

    const companies = await response.json();
    return { status: 'success' as const, data: companies };
  } catch (error) {
    console.error('Get all companies (admin) error:', error);
    return { status: 'error' as const, message: 'Bir hata oluştu', statusCode: 500 };
  }
}

/**
 * Update an existing company (Server Action)
 */
export async function updateCompanyAction(companyId: string, data: Partial<CreateCompanyData & { adi?: string; unvani?: string }>) {
  const token = await getAccessToken();
  if (!token) {
    return { status: 'error' as const, message: 'Oturum bulunamadı', statusCode: 401 };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company/${companyId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error' as const, message: err.error || 'Şirket güncellenemedi', statusCode: response.status };
    }

    // Revalidate all affected paths to refresh cached data
    try {
      revalidatePath('/', 'layout');
      revalidatePath('/dashboard', 'layout');
      revalidatePath('/dashboard/company/settings', 'page');
    } catch (e) {
      /* ignore revalidate errors */
    }

    return { status: 'success' as const, message: 'Şirket güncellendi' };
  } catch (error) {
    console.error('Update company error:', error);
    return { status: 'error' as const, message: 'Bir hata oluştu', statusCode: 500 };
  }
}

/**
 * Delete a company (Server Action)
 */
export async function deleteCompanyAction(companyId: string) {
  const token = await getAccessToken();
  if (!token) {
    return { status: 'error' as const, message: 'Oturum bulunamadı', statusCode: 401 };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company/${companyId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { status: 'error' as const, message: err.error || 'Şirket silinemedi', statusCode: response.status };
    }

    // Revalidate server-side caches so pages show updated state
    try {
      revalidatePath('/');
      revalidatePath('/dashboard');
    } catch {
      /* ignore revalidate errors */
    }

    return { status: 'success' as const, message: 'Şirket silindi' };
  } catch (error) {
    console.error('Delete company error:', error);
    return { status: 'error' as const, message: 'Bir hata oluştu', statusCode: 500 };
  }
}

/**
 * Permanently delete a company (Server Action) - expects a FormData with companyId
 */
export async function deleteCompanyPermanentAction(formData: FormData): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    // If no session, redirect to login
    redirect('/auth/login');
  }

  const companyId = formData.get('companyId')?.toString();
  if (!companyId) {
    throw new Error('Company ID missing');
  }

  try {
    const response = await fetch(`${backendApiUrl}/company/${companyId}/permanent`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      // Throw so Next.js error overlay or error boundary can catch it
      throw new Error(err.error || 'Şirket kalıcı olarak silinemedi');
    }

    // Revalidate and redirect to homepage; client will clear store when it sees the flag
    try {
      revalidatePath('/');
      revalidatePath('/dashboard');
    } catch {
      /* ignore */
    }
    redirect('/?company_cleared=1');
  } catch (error) {
    console.error('Permanent delete company error:', error);
    throw error;
  }
}

/**
 * Toggle company active state (Server Action)
 * Expects FormData with companyId and isActive
 */
export async function toggleCompanyActiveAction(formData: FormData): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    redirect('/auth/login');
  }

  const companyId = formData.get('companyId')?.toString();
  const isActiveStr = formData.get('isActive')?.toString();
  if (!companyId || typeof isActiveStr === 'undefined' || isActiveStr === null) {
    throw new Error('Invalid form data');
  }

  const isActive = isActiveStr === 'true';

  try {
    const response = await fetch(`${backendApiUrl}/company/${companyId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ is_active: isActive }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Şirket durumu güncellenemedi');
    }

    // Refresh to reflect new state
    redirect('/dashboard/company/settings');
  } catch (error) {
    console.error('Toggle company active error:', error);
    throw error;
  }
}

/**
 * Soft delete a company (server action form)
 */
export async function deleteCompanySoftAction(formData: FormData): Promise<void> {
  const token = await getAccessToken();
  if (!token) redirect('/auth/login');

  const companyId = formData.get('companyId')?.toString();
  if (!companyId) throw new Error('Company ID missing');

  try {
    const response = await fetch(`${backendApiUrl}/company/${companyId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Şirket silinemedi');
    }

    try {
      revalidatePath('/');
      revalidatePath('/dashboard');
    } catch {
      /* ignore */
    }
    // Redirect to homepage and indicate client should clear company-store
    redirect('/?company_cleared=1');
  } catch (error) {
    console.error('Soft delete company error:', error);
    throw error;
  }
}

/**
 * Export company data to JSON (server action form)
 */
export async function exportCompanyDataAction(formData: FormData): Promise<void> {
  const companyId = formData.get('companyId')?.toString();
  if (!companyId) throw new Error('Company ID missing');

  const models = formData.getAll('models') as string[];
  const modelsParam = models && models.length > 0 ? `&models=${encodeURIComponent(models.join(','))}` : '';
  // Redirect to API route that will perform the export with server-side auth and stream the JSON
  redirect(`/api/company/settings/export?companyId=${encodeURIComponent(companyId)}${modelsParam}`);
}

/**
 * Switch active company (Server Action)
 */
export async function switchCompanyAction(companyId: string) {
  const token = await getAccessToken();
  
  if (!token) {
    return {
      status: 'error' as const,
      message: 'Oturum bulunamadı',
      statusCode: 401,
    };
  }

  try {
    const response = await fetch(`${backendApiUrl}/company/switch`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ company_id: companyId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        status: 'error' as const,
        message: errorData.error || 'Şirket değiştirilemedi',
        statusCode: response.status,
      };
    }

    return {
      status: 'success' as const,
      message: 'Şirket başarıyla değiştirildi',
    };
  } catch (error) {
    console.error('Switch company error:', error);
    return {
      status: 'error' as const,
      message: 'Bir hata oluştu',
      statusCode: 500,
    };
  }
}

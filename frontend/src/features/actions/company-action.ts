'use server';

import { cookies } from 'next/headers';

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
  title?: string;
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
  coordinates?: { lat: string; lng: string } | null;
  workinghours?: Record<string, unknown> | null;
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

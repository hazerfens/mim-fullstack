'use server';

import { cookies } from 'next/headers';
import { ResetPasswordValues } from '../validators/login-schema';
import { User } from '@/types/user/user';

const BACKEND_ORIGIN =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3333';

const BACKEND_API_BASE =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  `${BACKEND_ORIGIN}/api/v1`;


const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const backendAuthUrl = `${trimTrailingSlash(BACKEND_ORIGIN)}/auth`;
const backendApiAuthUrl = `${trimTrailingSlash(BACKEND_API_BASE)}/auth`;

// Token helper functions (Server Actions)
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get('refresh_token')?.value ?? null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Login aksiyonu
export async function loginAction(formData: FormData) {
  const credentials = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  try {
    const res = await fetch(`${backendAuthUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { status: 'error', message: 'Giriş başarısız oldu.', statusCode: res.status };
    }

    const data = await res.json();
    const { access_token } = data;

    // Çerezler route.ts'de ayarlanacak
    // Kullanıcı bilgisi access_token'dan decode edilip dönülüyor
    let user = null;
    try {
      user = access_token ? JSON.parse(Buffer.from(access_token.split('.')[1], 'base64').toString()) : null;
    } catch {}
    return { status: 'success', user };
  } catch {
    return { status: 'error', message: 'Bir hata oluştu.', statusCode: 500 };
  }
}
// Login aksiyonu
export async function resetAction(formData: FormData) {
  const credentials = {
    email: formData.get('email') as string,
  };
  
  try {
    const res = await fetch(`${backendApiAuthUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { status: 'error', message: 'Şifre sıfırlama isteği başarısız oldu.', statusCode: res.status };
    }

    return { status: 'success', message: 'Şifre sıfırlama e-postası gönderildi.' };

  } catch {
    return { status: 'error', message: 'Bir hata oluştu.', statusCode: 500 };
  }
}

// Register aksiyonu
export async function registerAction(formData: FormData) {
  const userData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    full_name: formData.get('name') as string | undefined,
  };

  console.log(userData);
  
  try {
    const res = await fetch(`${backendAuthUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { status: 'error', message: 'Kayıt başarısız oldu.', statusCode: res.status };
    }

    return { status: 'success', message: 'Kayıt başarılı.' };

    // // Kayıt sonrası otomatik giriş
    // return await loginAction(formData);
  } catch {
    return { status: 'error', message: 'Bir hata oluştu.', statusCode: 500 };
  }
}

// Sosyal OAuth aksiyonu
export async function socialAuthAction(provider: string, callbackURL: string = '/dashboard') {
  try {
    // Doğru backend endpointi için backendAuthUrl kullanılıyor
    const url = `${backendAuthUrl}/${provider}?callbackUrl=${encodeURIComponent(callbackURL)}`;
    window.location.href = url;
    return { status: 'success' };
  } catch {
    return { status: 'error', message: 'Bir hata oluştu.', statusCode: 500 };
  }
}

// Logout aksiyonu - backend'e logout isteği gönderir ve cookie'leri siler
export async function logoutAction() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  try {
    // Backend'e logout isteği gönder
    if (refreshToken) {
      await fetch(`${backendApiAuthUrl}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      });
    }

    // Cookie'leri sil
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');

    return { status: 'success', message: 'Çıkış başarılı.' };
  } catch (error) {
    console.error('Logout error:', error);
    // Hata olsa bile cookie'leri sil
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
    return { status: 'error', message: 'Çıkış sırasında bir hata oluştu.', statusCode: 500 };
  }
}

type GetCurrentUserResult =
  | { status: 'success'; user: User }
  | { status: 'unauthenticated' | 'error'; user: null };

export async function getCurrentUserAction(): Promise<GetCurrentUserResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value ?? null;

  const fetchUser = async (): Promise<User | 'unauthorized' | null> => {
    if (!accessToken) {
      return null;
    }

    try {
      const res = await fetch(`${BACKEND_ORIGIN}/user/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      if (res.status === 401) {
        return 'unauthorized';
      }

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data as User;
    } catch (error) {
      console.error('fetchUser error:', error);
      return null;
    }
  };

  const user = await fetchUser();

  if (user && user !== 'unauthorized') {
    return { status: 'success', user };
  }

  return accessToken ? { status: 'error', user: null } : { status: 'unauthenticated', user: null };
}

export const newPassword = async (
  values: ResetPasswordValues,
  token?: string | null
) => {
  // Token must be provided by the page (from query or form)
  if (!token) {
    return { error: 'Token not provided' };
  }

  try {
    const res = await fetch(`${backendApiAuthUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: values.password }),
      cache: 'no-store',
    });

    if (!res.ok) {
      // Try to parse error message from backend
      let msg = 'Şifre sıfırlama başarısız oldu.';
      try {
        const errBody = await res.json();
        if (errBody && errBody.error) msg = errBody.error;
      } catch {}
      return { error: msg, statusCode: res.status };
    }

    return { success: 'Şifreniz başarıyla güncellendi' };
  } catch (e) {
    return { error: 'Bir hata oluştu', details: String(e) };
  }
};
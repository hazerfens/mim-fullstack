'use server';

import { cookies } from 'next/headers';
import { ResetPasswordValues } from '../validators/login-schema';
import { User } from '@/types/user/user';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api/v1';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3333';

// Login aksiyonu
export async function loginAction(formData: FormData) {
  const credentials = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { status: 'error', message: 'Giriş başarısız oldu.', statusCode: res.status };
    }

    const data = await res.json();
    const { access_token, refresh_token } = data;

    // Çerezleri kaydet
    const cookieStore = await cookies();
    if (access_token) {
      cookieStore.set('access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60, // 60 dakika (JWT_EXPIRES_IN)
      });
    }
    if (refresh_token) {
      cookieStore.set('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 gün (JWT_REFRESH_EXPIRES_IN)
      });
    }

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
    const res = await fetch(`${API_URL}/auth/reset-password`, {
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
    const res = await fetch(`${API_URL}/auth/register`, {
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
    // Doğru backend endpointi için API_URL kullanılıyor
    const url = `${API_URL}/auth/${provider}?callbackUrl=${encodeURIComponent(callbackURL)}`;
    window.location.href = url;
    return { status: 'success' };
  } catch {
    return { status: 'error', message: 'Bir hata oluştu.', statusCode: 500 };
  }
}

// Logout aksiyonu
export async function logoutAction() {
  try {
    const cookieStore = await cookies();
    cookieStore.set('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return { status: 'success', message: 'Çıkış başarılı.' };
  } catch {
    return { status: 'error', message: 'Çıkış başarısız.', statusCode: 500 };
  }
}

type GetCurrentUserResult =
  | { status: 'success'; user: User }
  | { status: 'unauthenticated' | 'error'; user: null };

export async function getCurrentUserAction(): Promise<GetCurrentUserResult> {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get('access_token')?.value ?? null;
  let refreshToken = cookieStore.get('refresh_token')?.value ?? null;

  const setAccessToken = (token: string) => {
    cookieStore.set('access_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60,
    });
    accessToken = token;
  };

  const setRefreshToken = (token: string) => {
    cookieStore.set('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    refreshToken = token;
  };

  const clearTokens = () => {
    cookieStore.set('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    cookieStore.set('refresh_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    accessToken = null;
    refreshToken = null;
  };

  const refreshTokens = async (): Promise<boolean> => {
    if (!refreshToken) {
      return false;
    }

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: 'no-store',
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const data = await res.json();

      if (data.access_token) {
        setAccessToken(data.access_token);
      }

      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }

      return true;
    } catch (error) {
      console.error('refreshTokens error:', error);
      clearTokens();
      return false;
    }
  };

  const fetchUser = async (): Promise<User | 'unauthorized' | null> => {
    if (!accessToken) {
      return null;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/user/me`, {
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

  if (!accessToken && refreshToken) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      return { status: 'unauthenticated', user: null };
    }
  }

  let user = await fetchUser();

  if (user === 'unauthorized') {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      return { status: 'unauthenticated', user: null };
    }
    user = await fetchUser();
  }

  if (user && user !== 'unauthorized') {
    return { status: 'success', user };
  }

  return accessToken || refreshToken
    ? { status: 'error', user: null }
    : { status: 'unauthenticated', user: null };
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
    const res = await fetch(`${API_URL}/auth/reset-password`, {
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
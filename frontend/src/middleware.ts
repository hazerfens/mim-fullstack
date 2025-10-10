import { NextRequest, NextResponse } from 'next/server'

// Simple JWT decode (no verification, just parsing)
function decodeJWT(token: string): { role?: string; user_id?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl


  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  console.log('After skip, processing:', pathname)

  // For auth routes, check if user has any tokens (prevent access to login/register if authenticated)
  const isAuth = pathname === '/auth/login' || pathname === '/auth/register'
  if (isAuth) {
    const accessToken = request.cookies.get('access_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value

    console.log(`Auth route check: ${pathname}, accessToken: ${!!accessToken}, refreshToken: ${!!refreshToken}`)

    if (accessToken || refreshToken) {
      // User has tokens, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    // No tokens, allow access to auth page
    return NextResponse.next()
  }

  // Check if route is public (excluding auth routes, which are handled above)
  const publicRoutes = ['/auth/reset-password', '/auth/forgot-password', '/verify-email', '/health']
  const publicPatterns = [/^\/api\/auth\/.*/]
  const isPublic = publicRoutes.includes(pathname) || publicPatterns.some(pattern => pattern.test(pathname))
  if (isPublic) {
    return NextResponse.next()
  }

  // For protected routes, check authentication
  const protectedRoutes = ['/dashboard', '/settings', '/profile']
  const protectedPatterns = [/^\/dashboard\/.*/, /^\/settings\/.*/, /^\/api\/(?!auth\/).*/]
  const isProtected = protectedRoutes.includes(pathname) || protectedPatterns.some(pattern => pattern.test(pathname))

  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value
  if (!accessToken) {
    if (refreshToken) {
      // Try to refresh token
      const refreshUrl = new URL('/api/auth/refresh', request.url)
      refreshUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(refreshUrl)
    } else {
      // No tokens, for protected routes redirect to login
      if (isProtected) {
        const loginUrl = new URL('/auth/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
      }
      // For other routes, allow without auth
    }
  }

  // For protected routes, check role-based authorization
  if (isProtected) {
    // Check if user is trying to access dashboard
    if (pathname.startsWith('/dashboard')) {
      const payload = decodeJWT(accessToken || '');
      
      // If role is "user", deny access to dashboard
      if (payload?.role === 'user') {
        const unauthorizedUrl = new URL('/unauthorized', request.url);
        return NextResponse.redirect(unauthorizedUrl);
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths
     */
    '/:path*',
  ],
}
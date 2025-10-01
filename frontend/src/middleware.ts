import { NextRequest, NextResponse } from 'next/server'

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
    // Add role checks here if necessary, but for now, just allow if authenticated
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
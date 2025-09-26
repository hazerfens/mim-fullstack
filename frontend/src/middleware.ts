import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for API routes and login
  if (pathname.startsWith('/api') || pathname === '/auth/login') {
    return NextResponse.next()
  }

  // Protected routes
  if (pathname.startsWith('/dashboard')) {
    const accessToken = request.cookies.get('access_token')?.value

    if (!accessToken) {
      // Redirect to refresh API with redirect param
      const refreshUrl = new URL('/api/auth/refresh', request.url)
      refreshUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(refreshUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
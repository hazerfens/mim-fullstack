// Middleware configuration for route protection
export const middlewareConfig = {
  // Public routes that don't require authentication
  publicRoutes: [
    '/auth/login',
    '/auth/register',
    '/auth/reset-password',
    '/auth/forgot-password',
    '/verify-email',
    '/health',
  ],

  // Public route patterns (regex patterns)
  publicPatterns: [
    /^\/auth\/.*/,
    /^\/api\/auth\/.*/,
  ],

  // Protected routes that require authentication
  protectedRoutes: [
    '/dashboard',
    '/settings',
    '/profile',
  ],

  // Protected route patterns
  protectedPatterns: [
    /^\/dashboard\/.*/,
    /^\/settings\/.*/,
    /^\/api\/(?!auth\/).*/, // All API routes except auth
  ],

  // Routes that should redirect to dashboard if user is already logged in
  authRoutes: [
    '/auth/login',
    '/auth/register',
  ],

  // Role-based route restrictions
  // Routes that require specific roles
  roleRestrictedRoutes: {
    '/dashboard': ['admin', 'super_admin'], // Only admin and super_admin can access dashboard
    '/settings': ['admin', 'super_admin'],
  '/settings/roles': ['admin', 'super_admin'], // admin and super_admin can manage roles
    '/settings/users': ['admin', 'super_admin'],
  } as Record<string, string[]>,

  // Role-restricted route patterns
  roleRestrictedPatterns: [
    {
      pattern: /^\/dashboard\/.*/,
      allowedRoles: ['admin', 'super_admin'],
    {
      pattern: /^\/settings\/roles\/.*$/,
      allowedRoles: ['admin', 'super_admin'],
    },
    {
      pattern: /^\/api\/v1\/roles\/.*$/,
      allowedRoles: ['admin', 'super_admin'],
    },
    },
    {
      pattern: /^\/api\/v1\/users\/.*/,
      allowedRoles: ['admin', 'super_admin'],
    },
  ],
};

// Helper functions
export const isPublicRoute = (pathname: string): boolean => {
  // Check exact matches
  if (middlewareConfig.publicRoutes.includes(pathname)) {
    return true;
  }

  // Check patterns
  return middlewareConfig.publicPatterns.some(pattern => pattern.test(pathname));
};

export const isProtectedRoute = (pathname: string): boolean => {
  // Check exact matches
  if (middlewareConfig.protectedRoutes.includes(pathname)) {
    return true;
  }

  // Check patterns
  return middlewareConfig.protectedPatterns.some(pattern => pattern.test(pathname));
};

export const isAuthRoute = (pathname: string): boolean => {
  return middlewareConfig.authRoutes.includes(pathname);
};

// Role-based authorization helpers
export const getRequiredRolesForRoute = (pathname: string): string[] | null => {
  // Check exact matches
  if (middlewareConfig.roleRestrictedRoutes[pathname]) {
    return middlewareConfig.roleRestrictedRoutes[pathname];
  }

  // Check patterns
  for (const restriction of middlewareConfig.roleRestrictedPatterns) {
    if (restriction.pattern.test(pathname)) {
      return restriction.allowedRoles;
    }
  }

  return null; // No role restrictions
};

export const hasRequiredRole = (userRole: string, requiredRoles: string[]): boolean => {
  return requiredRoles.includes(userRole);
};

// Decode JWT token to get user role
export const decodeUserRole = (token: string): string | null => {
  try {
    // JWT is in format: header.payload.signature
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());

    return decodedPayload.role || null;
  } catch (error) {
    console.error('Failed to decode token:', error);
    return null;
  }
};
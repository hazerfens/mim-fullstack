/**
 * Auth utility functions for client-side components
 * For server-side token access, use auth-actions.ts
 */

/**
 * Get access token from cookies (Client-side only)
 * Use this in Client Components
 * @returns Access token or null if not found
 */
export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find(c => c.trim().startsWith('access_token='))
  const token = tokenCookie ? tokenCookie.split('=')[1] : null
  
  return token
}

/**
 * Get refresh token from cookies (Client-side only)
 * @returns Refresh token or null if not found
 */
export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null
  
  const cookies = document.cookie.split(';')
  const tokenCookie = cookies.find(c => c.trim().startsWith('refresh_token='))
  const token = tokenCookie ? tokenCookie.split('=')[1] : null
  
  return token
}

/**
 * Check if user is authenticated (has valid token)
 * @returns True if authenticated, false otherwise
 */
export const isAuthenticated = (): boolean => {
  return getAccessToken() !== null
}

/**
 * Get authorization header with Bearer token (Client-side)
 * @returns Authorization header object or empty object
 */
export const getAuthHeader = (): Record<string, string> => {
  const token = getAccessToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

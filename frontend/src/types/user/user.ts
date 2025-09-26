export type User = {
  id: string;
  email: string;
  role: string;
  full_name?: string | null;
  image_url?: string | null;
  is_verified: boolean;
  firstName?: string;
  lastName?: string;
  image?: string;
  sub?: string;
  tokenType?: string;
  rememberMe?: boolean;
  jti?: string;
  iat?: number;
  exp?: number;
};
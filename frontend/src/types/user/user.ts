export type User = {
  sub: string;
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  image?: string
  tokenType: string;
  rememberMe: boolean;
  jti: string;
  iat: number;
  exp: number;
};
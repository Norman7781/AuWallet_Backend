export interface AuthUserClaims {
  sub: string;
  email?: string;
  user_role?: string;

  app_metadata?: {
    role?: string;
    roles?: string[];
    [key: string]: unknown;
  };

  [key: string]: unknown;
}

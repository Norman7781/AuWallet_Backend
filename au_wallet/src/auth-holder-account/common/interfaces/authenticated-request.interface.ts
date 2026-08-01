import type { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user.interface';

export interface AuthenticatedRequest extends Request {
  accessToken: string;
  user: AuthenticatedUser;
}

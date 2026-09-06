import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';

interface IssuerJwtPayload {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
  issuerProviderId?: unknown;
}

/**
 * Keeps issuer academic data behind the same signed issuer token used by the
 * login endpoint, without exposing the student-data controller to holders.
 */
@Injectable()
export class IssuerApiAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    const token = this.extractBearerToken(authorization);
    const secret = this.config.get<string>('JWT_SECRET');

    if (!token || !secret) {
      throw new UnauthorizedException('Invalid or missing issuer token.');
    }

    try {
      const payload = verify(token, secret) as IssuerJwtPayload;

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.role !== 'string' ||
        !Number.isInteger(payload.issuerProviderId)
      ) {
        throw new UnauthorizedException('Invalid issuer token.');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        issuerProviderId: payload.issuerProviderId,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired issuer token.');
    }
  }

  private extractBearerToken(authorization: unknown): string | null {
    if (typeof authorization !== 'string') return null;
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    const token = match?.[1]?.trim();
    return token || null;
  }
}

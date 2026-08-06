import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { AuthenticatedUserService } from '../../users/authenticated-user.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authenticatedUserService: AuthenticatedUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1]) {
      throw new UnauthorizedException({
        code: 'ACCESS_TOKEN_INVALID_OR_EXPIRED',
        message: 'The access token is missing, invalid, or expired.',
      });
    }

    const accessToken = match[1].trim();
    request.user = await this.authenticatedUserService.identify(accessToken);
    request.accessToken = accessToken;

    return true;
  }
}

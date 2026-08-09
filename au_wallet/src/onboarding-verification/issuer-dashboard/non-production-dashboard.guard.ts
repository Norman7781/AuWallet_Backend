import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment';

@Injectable()
export class NonProductionDashboardGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  canActivate(): boolean {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });

    if (nodeEnv === 'development' || nodeEnv === 'test') {
      return true;
    }

    throw new NotFoundException();
  }
}

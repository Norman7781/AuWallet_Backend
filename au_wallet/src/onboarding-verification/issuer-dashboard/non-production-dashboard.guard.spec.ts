import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../../config/environment';
import { NonProductionDashboardGuard } from './non-production-dashboard.guard';

function createGuard(nodeEnv: EnvironmentVariables['NODE_ENV']) {
  return new NonProductionDashboardGuard({
    get: jest.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService<EnvironmentVariables, true>);
}

describe('NonProductionDashboardGuard', () => {
  it.each(['development', 'test'] as const)(
    'allows temporary unauthenticated dashboard access in %s',
    (nodeEnv) => {
      expect(createGuard(nodeEnv).canActivate()).toBe(true);
    },
  );

  it('hides the temporary dashboard endpoint in production', () => {
    expect(() => createGuard('production').canActivate()).toThrow(
      NotFoundException,
    );
  });
});

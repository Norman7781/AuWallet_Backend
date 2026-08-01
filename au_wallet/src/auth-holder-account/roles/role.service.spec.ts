import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../common/enums/role.enum';
import { RoleService } from './role.service';

describe('RoleService', () => {
  const service = new RoleService();

  it('identifies an application role from app metadata', () => {
    expect(
      service.identifyRole({
        sub: 'user-id',
        app_metadata: { role: 'issuer_staff' },
      }),
    ).toEqual({
      value: UserRole.ISSUER_STAFF,
      rawValue: 'issuer_staff',
      source: 'app_metadata',
    });
  });

  it('prefers a custom application-role claim', () => {
    expect(
      service.identifyRole({
        sub: 'user-id',
        user_role: 'ADMIN',
        app_metadata: { role: 'student' },
      }),
    ).toEqual({
      value: UserRole.ADMIN,
      rawValue: 'ADMIN',
      source: 'custom_claim',
    });
  });

  it('does not authorize using user-editable metadata', () => {
    expect(() =>
      service.identifyRole({
        sub: 'user-id',
        user_metadata: { role: 'admin' },
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects an unknown role', () => {
    expect(() =>
      service.identifyRole({
        sub: 'user-id',
        app_metadata: { role: 'super_admin' },
      }),
    ).toThrow(ForbiddenException);
  });
});

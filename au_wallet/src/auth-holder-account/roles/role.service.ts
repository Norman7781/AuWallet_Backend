import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUserClaims } from '../users/auth-user-claims.interface';
import { IdentifiedRole } from './role.interface';
import { UserRole } from '../common/enums/role.enum';

const ROLE_BY_NORMALIZED_VALUE: Record<string, UserRole> = {
  ADMIN: UserRole.ADMIN,
  ISSUER_STAFF: UserRole.ISSUER_STAFF,
  STUDENT: UserRole.STUDENT,
};

@Injectable()
export class RoleService {
  identifyRole(claims: AuthUserClaims): IdentifiedRole {
    const customClaim =
      typeof claims.user_role === 'string' ? claims.user_role : undefined;
    const metadataRole =
      typeof claims.app_metadata?.role === 'string'
        ? claims.app_metadata.role
        : claims.app_metadata?.roles?.find(
            (role): role is string => typeof role === 'string',
          );
    const rawValue = customClaim ?? metadataRole;
    const source = customClaim !== undefined ? 'custom_claim' : 'app_metadata';
    const normalizedRole = rawValue?.trim().toUpperCase();
    const role = normalizedRole
      ? ROLE_BY_NORMALIZED_VALUE[normalizedRole.replace(/[-\s]/g, '_')]
      : undefined;

    if (!role) {
      throw new ForbiddenException(
        rawValue ? 'User role is not recognized' : 'User role is not assigned',
      );
    }

    return {
      value: role,
      rawValue,
      source,
    };
  }
}

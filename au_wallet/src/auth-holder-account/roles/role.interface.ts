import { UserRole } from '../common/enums/role.enum';

export type RoleSource = 'app_metadata' | 'custom_claim';

export interface IdentifiedRole {
  value: UserRole;
  rawValue?: string;
  source: RoleSource;
}

import { IsEnum } from 'class-validator';
import { UserRole } from '../../common/enums/role.enum';

export class UpdateRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

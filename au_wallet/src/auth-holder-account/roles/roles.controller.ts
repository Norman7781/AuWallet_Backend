import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleAdminService } from './role-admin.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly roleAdminService: RoleAdminService) {}

  @Patch(':authUserId')
  @Roles(UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateRole(
    @Param('authUserId', ParseUUIDPipe) authUserId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const roleAssignment = await this.roleAdminService.assignRole(
      authUserId,
      dto.role,
    );

    return {
      message:
        'Role updated. The affected user must refresh their session to receive the new role.',
      data: roleAssignment,
    };
  }
}

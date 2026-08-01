import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { UserRole } from '../common/enums/role.enum';

@Injectable()
export class RoleAdminService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async assignRole(authUserId: string, role: UserRole) {
    const supabase = this.supabaseService.client;
    const { data, error: loadError } =
      await supabase.auth.admin.getUserById(authUserId);

    if (loadError || !data.user) {
      throw new NotFoundException('Authentication user was not found');
    }

    const { data: updatedData, error: updateError } =
      await supabase.auth.admin.updateUserById(authUserId, {
        app_metadata: {
          ...data.user.app_metadata,
          role,
        },
      });

    if (updateError || !updatedData.user) {
      throw new InternalServerErrorException('Unable to assign the user role');
    }

    return {
      authUserId,
      role,
      tokenRefreshRequired: true,
    };
  }
}

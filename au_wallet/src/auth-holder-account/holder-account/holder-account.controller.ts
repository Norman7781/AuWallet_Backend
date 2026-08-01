import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { UpdateHolderAccountDto } from './dto/update-holder-account.dto';
import { HolderAccountService } from './holder-account.service';

@Controller('holder-accounts')
export class HolderAccountController {
  constructor(private readonly holderAccountService: HolderAccountService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const holder = await this.holderAccountService.findByAuthUserId(
      user.supabaseAuthId,
    );

    if (!holder) {
      throw new NotFoundException('Holder account was not found');
    }

    return { data: holder };
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateHolderAccountDto,
  ) {
    const holder = await this.holderAccountService.updateUniversityEmail(
      user.supabaseAuthId,
      dto.universityEmail ?? null,
    );

    return {
      message: 'Holder account updated',
      data: holder,
    };
  }

  @Patch(':holderAccountId/status')
  @Roles(UserRole.ISSUER_STAFF, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateStatus(
    @Param('holderAccountId', ParseIntPipe) holderAccountId: number,
    @Body() dto: UpdateAccountStatusDto,
  ) {
    const holder = await this.holderAccountService.updateStatus(
      holderAccountId,
      dto.accountStatus,
    );

    return {
      message: 'Holder account status updated',
      data: holder,
    };
  }
}

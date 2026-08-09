import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AccountStatus } from '../../auth-holder-account/common/enums/account-status.enum';
import { UserRole } from '../../auth-holder-account/common/enums/role.enum';
import { JwtAuthGuard } from '../../auth-holder-account/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth-holder-account/common/guards/roles.guard';
import { AuthenticatedUser } from '../../auth-holder-account/common/interfaces/authenticated-user.interface';
import { ROLES_KEY } from '../../auth-holder-account/common/decorators/roles.decorator';
import { CreateOnboardingRequestDto } from './dto/create-onboarding-request.dto';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

const user: AuthenticatedUser = {
  supabaseAuthId: '00000000-0000-4000-8000-000000000001',
  holderAccountId: 12,
  email: 'synthetic-holder@example.test',
  role: UserRole.STUDENT,
  accountStatus: AccountStatus.ACTIVE,
};

const dto: CreateOnboardingRequestDto = {
  admissionNo: 'DEMO-STU-0001',
  dateOfBirth: '2001-02-03',
  passportNumber: 'synthetic-passport-input',
};

function createController() {
  const submit = jest.fn();
  const getMine = jest.fn();
  const controller = new OnboardingController({
    submit,
    getMine,
  } as unknown as OnboardingService);

  return { controller, getMine, submit };
}

describe('OnboardingController', () => {
  it('is protected by Member 1 JWT and student-role guards', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OnboardingController)).toEqual([
      UserRole.STUDENT,
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, OnboardingController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });

  it('uses the authenticated holder ID instead of accepting one from the body', async () => {
    const { controller, submit } = createController();
    submit.mockResolvedValue({ data: { verificationStatus: 'under_review' } });

    await controller.submit(user, dto);

    expect(submit).toHaveBeenCalledWith(12, dto);
    expect(dto).not.toHaveProperty('holderAccountId');
  });

  it('loads status for the authenticated holder', async () => {
    const { controller, getMine } = createController();
    getMine.mockResolvedValue({ data: { verificationStatus: 'under_review' } });

    await controller.getMine(user);

    expect(getMine).toHaveBeenCalledWith(12);
  });

  it('fails closed when authentication has no holder account', () => {
    const { controller, submit } = createController();
    const missingHolder = { ...user, holderAccountId: null };

    expect(() => controller.submit(missingHolder, dto)).toThrow(
      ForbiddenException,
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('fails closed when the holder account is not active', () => {
    const { controller, getMine } = createController();
    const pendingHolder = { ...user, accountStatus: AccountStatus.PENDING };

    expect(() => controller.getMine(pendingHolder)).toThrow(ForbiddenException);
    expect(getMine).not.toHaveBeenCalled();
  });
});

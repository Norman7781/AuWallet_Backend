import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth-holder-account/common/decorators/roles.decorator';
import { UserRole } from '../../auth-holder-account/common/enums/role.enum';
import { JwtAuthGuard } from '../../auth-holder-account/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth-holder-account/common/guards/roles.guard';
import { AuthenticatedUser } from '../../auth-holder-account/common/interfaces/authenticated-user.interface';
import { ListOnboardingRequestsDto } from './dto/list-onboarding-requests.dto';
import {
  IssuerRejectionReason,
  IssuerReviewDecision,
} from './dto/review-onboarding-request.dto';
import { IssuerReviewController } from './issuer-review.controller';
import { IssuerReviewService } from './issuer-review.service';

function createController() {
  const list = jest.fn();
  const get = jest.fn();
  const decide = jest.fn();
  const controller = new IssuerReviewController({
    list,
    get,
    decide,
  } as unknown as IssuerReviewService);

  return { controller, decide, get, list };
}

const issuer: AuthenticatedUser = {
  supabaseAuthId: '00000000-0000-4000-8000-000000000002',
  holderAccountId: null,
  email: 'synthetic-issuer@example.test',
  role: UserRole.ISSUER_STAFF,
  accountStatus: null,
};

describe('IssuerReviewController', () => {
  it('allows only authenticated issuer staff and administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, IssuerReviewController)).toEqual([
      UserRole.ISSUER_STAFF,
      UserRole.ADMIN,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, IssuerReviewController),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('passes validated pagination to the review service', async () => {
    const { controller, list } = createController();
    const query = Object.assign(new ListOnboardingRequestsDto(), {
      page: 1,
      limit: 20,
    });

    await controller.list(query);

    expect(list).toHaveBeenCalledWith(query);
  });

  it('uses the authenticated issuer ID for the decision', async () => {
    const { controller, decide } = createController();
    const dto = {
      decision: IssuerReviewDecision.REJECT,
      rejectionReason:
        IssuerRejectionReason.IDENTITY_INFORMATION_COULD_NOT_BE_CONFIRMED,
    };

    await controller.decide(101, issuer, dto);

    expect(decide).toHaveBeenCalledWith(101, issuer.supabaseAuthId, dto);
    expect(dto).not.toHaveProperty('reviewedBy');
  });
});

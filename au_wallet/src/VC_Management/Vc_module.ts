import { Module } from '@nestjs/common';
import { VcService } from './Vc_Service';
import { IssuanceRepository } from './Issuance_repo';
import { DidWebController } from './DiD_controller';
import { VcIssuanceController } from './Vc_Issuance_controller';
import { ProofOfPossessionService } from './proof-of-possession_service';
import { OnboardingVerificationModule } from '../onboarding-verification/onboarding-verification.module';
import { StudentAcademicService } from './student-academic_service';

@Module({
  imports: [OnboardingVerificationModule],
  controllers: [DidWebController, VcIssuanceController],
  providers: [
    VcService,
    IssuanceRepository,
    ProofOfPossessionService,
    StudentAcademicService,
  ],
  exports: [VcService], // VP_Management / presentation module will need this later
})
export class VcModule {}

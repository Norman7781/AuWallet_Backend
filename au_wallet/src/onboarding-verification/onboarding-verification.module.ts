import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { PassportHmacService } from './security/passport-hmac.service';
import { AcademicStudentRepository } from './student-matching/academic-student.repository';
import { StudentMatchingService } from './student-matching/student-matching.service';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [
    PassportHmacService,
    AcademicStudentRepository,
    StudentMatchingService,
  ],
  exports: [PassportHmacService, StudentMatchingService],
})
export class OnboardingVerificationModule {}

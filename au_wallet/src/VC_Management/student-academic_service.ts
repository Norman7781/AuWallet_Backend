import { Injectable } from '@nestjs/common';
import { StudentAcademicRecord } from './academic-transcript_builder';
import { IssuerAcademicRepository } from '../onboarding-verification/issuer-academic/issuer-academic.repository';

@Injectable()
export class StudentAcademicService {
  constructor(
    private readonly issuerAcademicRepository: IssuerAcademicRepository,
  ) {}

  async getFullAcademicRecord(
    studentNumber: string,
  ): Promise<StudentAcademicRecord> {
    const [academicReview, academicPreview] = await Promise.all([
      this.issuerAcademicRepository.loadAcademicReview(studentNumber),
      this.issuerAcademicRepository.loadAcademicPreview(studentNumber),
    ]);

    return {
      ...academicReview,
      ...academicPreview,
      majorConcentration: academicReview.majorConcentration ?? undefined,
      graduationDate: academicReview.graduationDate ?? undefined,
    };
  }
}

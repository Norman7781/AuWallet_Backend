import { Injectable } from '@nestjs/common';
import { ListGraduatingStudentsDto } from './dto/list-graduating-students.dto';
import { ListIssuerStudentsDto } from './dto/list-issuer-students.dto';
import { IssuerAcademicRepository } from './issuer-academic.repository';

@Injectable()
export class IssuerAcademicService {
  constructor(private readonly repository: IssuerAcademicRepository) {}

  async listPrograms(facultyCode: string) {
    return {
      data: { programs: await this.repository.listPrograms(facultyCode) },
      message: 'Issuer program options loaded.',
      meta: {},
    };
  }

  async listStudents(query: ListIssuerStudentsDto) {
    const result = await this.repository.listStudents(query);

    return {
      data: { students: result.students },
      message: 'Issuer students loaded.',
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async getAcademicReview(studentNumber: string) {
    return {
      data: await this.repository.loadAcademicReview(studentNumber),
      message: 'Student academic review loaded.',
      meta: {},
    };
  }

  async getAcademicPreview(studentNumber: string) {
    return {
      data: await this.repository.loadAcademicPreview(studentNumber),
      message: 'Student academic preview loaded.',
      meta: {},
    };
  }

  async listGraduatingStudents(query: ListGraduatingStudentsDto) {
    const students = await this.repository.listGraduatingStudents(query);

    return {
      data: { students },
      message: 'Graduating students loaded.',
      meta: { total: students.length },
    };
  }

  async resolveWalletEligibility(studentNumbers: string[]) {
    return {
      data: {
        results: await this.repository.resolveWalletEligibility(studentNumbers),
      },
      message: 'Wallet eligibility resolved.',
      meta: {},
    };
  }
}

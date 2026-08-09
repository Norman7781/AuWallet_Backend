import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ListGraduatingStudentsDto } from './dto/list-graduating-students.dto';
import { ListIssuerProgramsDto } from './dto/list-issuer-programs.dto';
import { ListIssuerStudentsDto } from './dto/list-issuer-students.dto';
import { IssuerStudentNumberDto } from './dto/issuer-student-number.dto';
import { ResolveWalletEligibilityDto } from './dto/resolve-wallet-eligibility.dto';
import { IssuerAcademicService } from './issuer-academic.service';
import { NonProductionDashboardGuard } from '../issuer-dashboard/non-production-dashboard.guard';

@Controller('issuer')
@UseGuards(NonProductionDashboardGuard)
export class IssuerAcademicController {
  constructor(private readonly issuerAcademic: IssuerAcademicService) {}

  @Get('programs')
  listPrograms(@Query() query: ListIssuerProgramsDto) {
    return this.issuerAcademic.listPrograms(query.facultyCode);
  }

  @Get('students')
  listStudents(@Query() query: ListIssuerStudentsDto) {
    return this.issuerAcademic.listStudents(query);
  }

  @Get('students/:studentNumber/academic-review')
  academicReview(@Param() params: IssuerStudentNumberDto) {
    return this.issuerAcademic.getAcademicReview(params.studentNumber);
  }

  @Get('students/:studentNumber/academic-preview')
  academicPreview(@Param() params: IssuerStudentNumberDto) {
    return this.issuerAcademic.getAcademicPreview(params.studentNumber);
  }

  @Get('graduating-students')
  graduatingStudents(@Query() query: ListGraduatingStudentsDto) {
    return this.issuerAcademic.listGraduatingStudents(query);
  }

  @Post('students/wallet-eligibility:resolve')
  @HttpCode(HttpStatus.OK)
  walletEligibility(@Body() dto: ResolveWalletEligibilityDto) {
    return this.issuerAcademic.resolveWalletEligibility(dto.studentNumbers);
  }
}

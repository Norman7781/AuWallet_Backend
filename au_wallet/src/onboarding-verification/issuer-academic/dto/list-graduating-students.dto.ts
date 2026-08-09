import { IsDateString, Matches } from 'class-validator';

export class ListGraduatingStudentsDto {
  @IsDateString({ strict: true })
  graduationDate!: string;

  @Matches(/^[A-Z0-9-]{2,32}$/)
  facultyCode!: string;

  @Matches(/^[A-Z0-9-]{2,64}$/)
  programCode!: string;
}

import { Matches } from 'class-validator';

export class ListIssuerProgramsDto {
  @Matches(/^[A-Z0-9-]{2,32}$/)
  facultyCode!: string;
}

import { Matches } from 'class-validator';

export class IssuerStudentNumberDto {
  @Matches(/^[A-Za-z0-9-]{1,32}$/)
  studentNumber!: string;
}

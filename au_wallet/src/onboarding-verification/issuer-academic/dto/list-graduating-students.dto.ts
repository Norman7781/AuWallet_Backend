import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'exactlyOneGraduationPeriod', async: false })
class ExactlyOneGraduationPeriodConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, arguments_: ValidationArguments): boolean {
    const query = arguments_.object as ListGraduatingStudentsDto;
    const hasDate =
      query.graduationDate !== undefined && query.graduationDate !== null;
    const hasYear =
      query.graduationYear !== undefined && query.graduationYear !== null;

    return hasDate !== hasYear;
  }

  defaultMessage(): string {
    return 'Provide exactly one of graduationDate or graduationYear.';
  }
}

export class ListGraduatingStudentsDto {
  @IsOptional()
  @IsDateString({ strict: true })
  graduationDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2200)
  graduationYear?: number;

  @Validate(ExactlyOneGraduationPeriodConstraint)
  @Matches(/^[A-Z0-9-]{2,32}$/)
  facultyCode!: string;

  @Matches(/^[A-Z0-9-]{2,64}$/)
  programCode!: string;
}

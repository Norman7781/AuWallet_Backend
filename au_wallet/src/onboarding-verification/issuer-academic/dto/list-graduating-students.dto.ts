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

@ValidatorConstraint({ name: 'validGraduationPeriod', async: false })
class ValidGraduationPeriodConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, arguments_: ValidationArguments): boolean {
    const query = arguments_.object as ListGraduatingStudentsDto;
    const hasDate =
      query.graduationDate !== undefined && query.graduationDate !== null;
    const hasYear =
      query.graduationYear !== undefined && query.graduationYear !== null;
    const hasMonth =
      query.graduationMonth !== undefined && query.graduationMonth !== null;

    if (hasDate) return !hasYear && !hasMonth;
    if (!hasYear) return false;

    // Year-only remains a temporary compatibility path. New issuer UI sends
    // both year and month to search one academic graduation period.
    return true;
  }

  defaultMessage(): string {
    return 'Provide graduationDate, or graduationYear with an optional graduationMonth.';
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  graduationMonth?: number;

  @Validate(ValidGraduationPeriodConstraint)
  @Matches(/^[A-Z0-9-]{2,32}$/)
  facultyCode!: string;

  @Matches(/^[A-Z0-9-]{2,64}$/)
  programCode!: string;
}

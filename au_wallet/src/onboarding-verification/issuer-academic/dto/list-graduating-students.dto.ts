import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
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
  // 👉 ADD @IsOptional() HERE to stop the "is required" error!
  @IsOptional()
  @IsString()
  graduationDate?: string;

  // 👉 MAKE SURE graduationYear IS HERE so the backend accepts it!
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  graduationYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  graduationMonth?: number;

  @Validate(ValidGraduationPeriodConstraint)
  @Matches(/^[A-Z0-9-]{2,32}$/)
  facultyCode!: string;

  @Matches(/^[A-Z0-9-]{2,64}$/)
  programCode!: string;
}

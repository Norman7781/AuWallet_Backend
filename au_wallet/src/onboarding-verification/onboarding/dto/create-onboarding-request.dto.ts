import {
  IsISO8601,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateOnboardingRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  admissionNo!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  passportNumber!: string;
}

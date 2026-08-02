import { IsISO8601, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOnboardingRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  admissionNo!: string;

  @IsString()
  @IsISO8601({ strict: true })
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  passportNumber!: string;
}

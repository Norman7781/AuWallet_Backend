import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  personalEmail!: string;

  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, {
    message: 'Password must contain an uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain a lowercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain a number',
  })
  password!: string;
}

import { IsString, Matches, MinLength } from 'class-validator';

export class UpdatePasswordDto {
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

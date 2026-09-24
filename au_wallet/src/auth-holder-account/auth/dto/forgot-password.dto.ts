// import { IsEmail } from 'class-validator';

// export class ForgotPasswordDto {
//   @IsEmail()
//   email!: string;
// }

import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  redirectTo?: string;
}
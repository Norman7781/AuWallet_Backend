import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshSessionDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

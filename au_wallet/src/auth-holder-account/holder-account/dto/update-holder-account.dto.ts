import { IsEmail, IsOptional } from 'class-validator';

export class UpdateHolderAccountDto {
  @IsOptional()
  @IsEmail()
  universityEmail?: string | null;
}

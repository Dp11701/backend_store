import { IsString, MinLength } from 'class-validator';

export class GuestLoginDto {
  @IsString()
  @MinLength(8)
  deviceId!: string;
}

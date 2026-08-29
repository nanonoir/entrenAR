import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ROLE, type Role } from "../../../common/guards/roles.guard";

export class AuthCredentialsDto {
  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ format: "password", minLength: 12, writeOnly: true })
  password!: string;
}

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty({ enum: Object.values(ROLE), enumName: "Role" })
  role!: Role;

  @ApiPropertyOptional({ nullable: true })
  firstName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastName?: string | null;

  @ApiPropertyOptional({ nullable: true, pattern: "^[0-9]{6,9}$" })
  dni?: string | null;

  @ApiPropertyOptional({ nullable: true })
  gender?: string | null;

  @ApiPropertyOptional({ format: "date", nullable: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone?: string | null;
}

export class AuthSessionResponseDto {
  @ApiProperty({
    description: "Short-lived bearer credential. The response never contains a refresh token or password hash.",
    format: "jwt",
  })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class ForgotPasswordRequestDto {
  @ApiProperty({ format: "email" })
  email!: string;
}

export class ResetPasswordRequestDto {
  @ApiProperty({ description: "Opaque reset credential. It is never persisted in plaintext.", writeOnly: true })
  token!: string;

  @ApiProperty({ format: "password", minLength: 12, writeOnly: true })
  password!: string;
}

export class ChangePasswordRequestDto {
  @ApiProperty({ format: "password", writeOnly: true })
  currentPassword!: string;

  @ApiProperty({ format: "password", minLength: 12, writeOnly: true })
  newPassword!: string;
}

export class AuthSuccessResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}

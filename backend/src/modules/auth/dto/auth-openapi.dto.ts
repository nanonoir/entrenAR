import { ApiProperty } from "@nestjs/swagger";

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

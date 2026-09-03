import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { ERROR_CODE, type ErrorCode } from "./api-error.response";

export class ApiErrorResponseDto {
  @ApiProperty({ enum: Object.values(ERROR_CODE), enumName: "ApiErrorCode" })
  code!: ErrorCode;

  @ApiPropertyOptional({ description: "Optional top-level field associated with the error." })
  field?: string;

  @ApiPropertyOptional({
    description: "Field-level details included only for validation failures.",
    type: "array",
  })
  issues?: readonly unknown[];

  @ApiProperty({ description: "Safe, client-facing error message." })
  message!: string;

  @ApiProperty({ example: false })
  ok!: false;
}

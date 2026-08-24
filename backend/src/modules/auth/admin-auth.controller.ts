import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { ROLE } from "../../common/guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";

@ApiTags("Administration")
@ApiBearerAuth("access-token")
@Controller("admin")
export class AdminAuthController {
  @Get("auth-probe")
  @Roles(ROLE.ADMIN)
  @ApiOperation({ summary: "Verify ADMIN role enforcement" })
  @ApiOkResponse({ description: "Authenticated actor has the ADMIN role." })
  @ApiForbiddenResponse({ description: "FORBIDDEN", type: ApiErrorResponseDto })
  authProbe(): { ok: true } {
    return { ok: true };
  }
}

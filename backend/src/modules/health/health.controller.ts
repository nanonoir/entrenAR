import { Controller, Get, HttpStatus } from "@nestjs/common";
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { Public } from "../../common/auth/public.decorator";
import { ApiErrorResponseDto } from "../../common/errors/api-error-response.dto";
import { HealthResponseDto } from "./dto/health-response.dto";
import { HealthService, type HealthResponse } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get("live")
  @ApiOperation({ summary: "Check whether the API process is alive" })
  @ApiOkResponse({ description: "The process is accepting requests.", type: HealthResponseDto })
  live(): HealthResponse {
    return this.healthService.live();
  }

  @Public()
  @Get("ready")
  @ApiOperation({ summary: "Check whether the API and PostgreSQL are ready" })
  @ApiOkResponse({ description: "PostgreSQL connectivity was verified.", type: HealthResponseDto })
  @ApiResponse({
    description: "SERVICE_UNAVAILABLE: PostgreSQL is unavailable. No connection details are returned.",
    status: HttpStatus.SERVICE_UNAVAILABLE,
    type: ApiErrorResponseDto,
  })
  async ready(): Promise<HealthResponse> {
    return this.healthService.ready();
  }
}

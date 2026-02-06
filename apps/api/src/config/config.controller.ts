import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "./config.service";

@ApiTags("config")
@Controller("config")
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: "Get public configuration",
    description: "Returns public configuration values that can be used by the frontend",
  })
  @ApiResponse({
    status: 200,
    description: "Configuration retrieved successfully",
    schema: {
      type: "object",
      properties: {
        trialDays: {
          type: "number",
          description: "Number of trial days (0 = no trial)",
          example: 0,
        },
        signupEnabled: {
          type: "boolean",
          description: "Whether public signup is enabled (AdminJS feature flag)",
          example: false,
        },
      },
    },
  })
  async getConfig() {
    return this.configService.getPublicConfig();
  }
}

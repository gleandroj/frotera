import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";

@Injectable()
export class ConfigService {
  constructor(private nestConfigService: NestConfigService) {}

  /**
   * Get public configuration that can be exposed to frontend
   */
  getPublicConfig() {
    const trialDays = this.nestConfigService.get<number>("TRIAL_DAYS", 0);

    return {
      trialDays,
    };
  }
}

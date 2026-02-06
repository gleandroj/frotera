import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { SettingsService } from "../settings/settings.service";

@Injectable()
export class ConfigService {
  constructor(
    private nestConfigService: NestConfigService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Get public configuration that can be exposed to frontend
   */
  async getPublicConfig() {
    const trialDays = this.nestConfigService.get<number>("TRIAL_DAYS", 0);
    const signupEnabled = await this.settingsService.isSignupEnabled();

    return {
      trialDays,
      signupEnabled,
    };
  }
}

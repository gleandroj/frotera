import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Cache TTL in ms so AdminJS edits take effect without restart. */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private cache: {
    signupEnabled: boolean;
    signupCreateOrganizationEnabled: boolean;
    at: number;
  } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async getSettings() {
    const now = Date.now();
    if (this.cache && now - this.cache.at < CACHE_TTL_MS) {
      return this.cache;
    }
    const row = await this.prisma.appSettings.findFirst({
      orderBy: { createdAt: "asc" },
    });
    const signupEnabled = row?.signupEnabled ?? false;
    const signupCreateOrganizationEnabled =
      row?.signupCreateOrganizationEnabled ?? false;
    this.cache = {
      signupEnabled,
      signupCreateOrganizationEnabled,
      at: now,
    };
    return this.cache;
  }

  async isSignupEnabled(): Promise<boolean> {
    const s = await this.getSettings();
    return s.signupEnabled;
  }

  async isSignupCreateOrganizationEnabled(): Promise<boolean> {
    const s = await this.getSettings();
    return s.signupCreateOrganizationEnabled;
  }

  /** Clear in-memory cache so next read gets fresh DB values (e.g. after AdminJS edit). */
  clearCache(): void {
    this.cache = null;
  }
}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [ConfigModule, SettingsModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class AppConfigModule {}

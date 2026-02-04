import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConfigController } from "./config.controller";
import { ConfigService } from "./config.service";

@Module({
  imports: [ConfigModule],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class AppConfigModule {}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { S3Service } from "./s3.service";
import { EncryptionService } from "./encryption.service";

@Module({
  imports: [ConfigModule],
  providers: [S3Service, EncryptionService],
  exports: [S3Service, EncryptionService],
})
export class UtilsModule {}

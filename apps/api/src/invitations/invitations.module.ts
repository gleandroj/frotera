import { Module } from "@nestjs/common";
import { InvitationsController } from "./invitations.controller";
import { PublicInvitationsController } from "./public-invitations.controller";
import { InvitationsService } from "./invitations.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "@nestjs/config";
import { EmailModule } from "../email/email.module";

@Module({
  imports: [PrismaModule, AuthModule, ConfigModule, EmailModule],
  controllers: [InvitationsController, PublicInvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}

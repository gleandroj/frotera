import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ChecklistController } from "./checklist.controller";
import { PublicChecklistController } from "./public-checklist.controller";
import { ChecklistService } from "./checklist.service";

@Module({
  imports: [PrismaModule],
  controllers: [ChecklistController, PublicChecklistController],
  providers: [ChecklistService],
  exports: [ChecklistService],
})
export class ChecklistModule {}

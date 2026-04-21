import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReferencePointsController } from './reference-points.controller';
import { ReferencePointsService } from './reference-points.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReferencePointsController],
  providers: [ReferencePointsService],
  exports: [ReferencePointsService],
})
export class ReferencePointsModule {}

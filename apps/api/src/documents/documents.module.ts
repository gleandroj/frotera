import { Module, forwardRef } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UtilsModule } from '../utils/utils.module';
import { CustomersModule } from '@/customers/customers.module';
import { OrganizationsModule } from '@/organizations/organizations.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AuthModule),
    UtilsModule,
    CustomersModule,
    OrganizationsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

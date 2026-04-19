import { Global, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AppJwtModule } from './app-jwt.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { TokenService } from '../utils/tokens';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionGuard } from './guards/permission.guard';
import { EmailModule } from '../email/email.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    SettingsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AppJwtModule,
    EmailModule,
    forwardRef(() => OrganizationsModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PermissionGuard],
  exports: [AppJwtModule, AuthService, PermissionGuard],
})
export class AuthModule {}
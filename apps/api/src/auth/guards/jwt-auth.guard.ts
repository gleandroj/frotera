import { ApiCode } from "@/common/api-codes.enum";
import {
  ExecutionContext,
  Injectable,
  Logger,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";

export const REQUIRE_2FA_KEY = "require2fa";
export const Require2FA = (require: boolean = true) =>
  SetMetadata(REQUIRE_2FA_KEY, require);

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger("JwtAuthGuard");

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.log("[Auth Guard] No token found");
      throw new UnauthorizedException(ApiCode.AUTH_UNAUTHORIZED);
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get("JWT_SECRET"),
      });

      // Verify user exists in database and is email verified
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          name: true,
          phoneNumber: true,
          twoFactorEnabled: true,
          emailVerified: true,
        },
      });

      if (!user) {
        this.logger.log("[Auth Guard] User not found in database");
        throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
      }

      if (!user.emailVerified) {
        this.logger.log("[Auth Guard] Email not verified");
        throw new UnauthorizedException(ApiCode.AUTH_ACCOUNT_NOT_VERIFIED);
      }

      // Create user context
      const userContext = {
        userId: payload.userId,
        email: payload.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorVerified: payload.twoFactorVerified || false,
      };

      // Check 2FA requirement based on metadata
      const require2FA =
        Reflect.getMetadata(REQUIRE_2FA_KEY, context.getHandler()) ?? true;

      if (
        require2FA !== false &&
        userContext.twoFactorEnabled &&
        !userContext.twoFactorVerified
      ) {
        this.logger.log(
          `[Auth Guard] 2FA verification required for user ${userContext.userId}`
        );
        throw new UnauthorizedException(ApiCode.AUTH_2FA_REQUIRED);
      }

      // Attach user context to request
      request["user"] = userContext;

      this.logger.log(`[Auth Guard] User authenticated: ${user.id}`);
      return true;
    } catch (error) {
      this.logger.log(error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.log("[Auth Guard] Invalid token");
      throw new UnauthorizedException(ApiCode.AUTH_INVALID_TOKEN);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}

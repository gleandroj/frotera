import { ApiCode } from "@/common/api-codes.enum";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import * as QRCode from "qrcode";
import { EmailService } from "../email/email.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { TokenService } from "../utils/tokens";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { SignupDto } from "./dto/signup.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tokenService: TokenService,
    private emailService: EmailService,
    private organizationsService: OrganizationsService,
    private settingsService: SettingsService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password, twoFactorCode } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException(ApiCode.AUTH_INVALID_CREDENTIALS);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException(ApiCode.AUTH_INVALID_CREDENTIALS);
    }

    // Check if email is verified
    if (!user.emailVerified) {
      // Generate and send verification token (no language available from login)
      await this.sendVerificationEmail(user.email);
      throw new BadRequestException({
        message: ApiCode.AUTH_ACCOUNT_NOT_VERIFIED,
        requiresEmailVerification: true,
      });
    }

    // Handle 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        throw new BadRequestException({
          message: ApiCode.AUTH_2FA_REQUIRED,
          requires2FA: true,
        });
      }

      // Verify 2FA code
      const isValid = authenticator.verify({
        token: twoFactorCode,
        secret: user.twoFactorSecret!,
      });

      if (!isValid) {
        throw new BadRequestException(ApiCode.AUTH_INVALID_2FA_CODE);
      }
    }

    // Generate tokens
    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorVerified: !!twoFactorCode,
      emailVerified: user.emailVerified,
    });

    return {
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        language: user.language,
        twoFactorEnabled: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
        /** Needed by the app immediately after login (e.g. allow root customer creation). */
        isSuperAdmin: user.isSuperAdmin === true,
        twoFactorVerified: !!twoFactorCode,
      },
      tokens,
    };
  }

  async signup(signupDto: SignupDto) {
    const signupEnabled = await this.settingsService.isSignupEnabled();
    if (!signupEnabled) {
      throw new ForbiddenException(ApiCode.AUTH_SIGNUP_DISABLED);
    }

    const {
      email,
      password,
      name,
      phoneNumber,
      language,
      organizationName
    } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException(ApiCode.USER_ALREADY_EXISTS);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        phoneNumber: phoneNumber || null,
        language: language || "pt", // Store user's preferred language, default to Portuguese
      },
    });

    // Create organization only if feature flag allows (default: invitation-only, no org on signup)
    let organization = null;
    const createOrgEnabled = await this.settingsService.isSignupCreateOrganizationEnabled();
    if (createOrgEnabled) {
      const orgName = organizationName?.trim() || name?.trim() || email.split('@')[0];
      try {
        const orgResult = await this.organizationsService.createOrganization(
          user.id,
          { name: orgName, description: undefined },
        );
        organization = orgResult.organization;
      } catch (error) {
        console.error('Failed to create organization during signup:', error);
      }
    }

    // Generate and send verification token
    await this.sendVerificationEmail(user.email, language);

    return {
      message: ApiCode.AUTH_ACCOUNT_CREATED,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phoneNumber: user.phoneNumber,
        language: user.language,
        twoFactorEnabled: false,
        emailVerified: null,
      },
      organization: organization || undefined,
    };
  }

  /**
   * Creates a user with hashed password and marks email as verified (e.g. for admin-created users).
   * Returns the created user.
   */
  async createUserWithPassword(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<{ id: string; email: string; name: string | null }> {
    const { email, password, name } = data;

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new BadRequestException(ApiCode.USER_ALREADY_EXISTS);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        language: "pt",
        emailVerified: new Date(),
      },
      select: { id: true, email: true, name: true },
    });

    return user;
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    // Verify the email token
    const payload = this.tokenService.verifyEmailToken(token);
    if (!payload || !payload.email) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_TOKEN);
    }

    // Check if user is already verified
    const existingUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
      select: { emailVerified: true },
    });

    if (existingUser?.emailVerified) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_VERIFICATION_REQUEST);
    }

    // Update user using email from token
    const user = await this.prisma.user.update({
      where: { email: payload.email },
      data: { emailVerified: new Date() },
    });

    return {
      message: ApiCode.AUTH_EMAIL_VERIFIED,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET"),
      });

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
      }

      // Generate new tokens
      const tokens = this.generateTokens({
        userId: user.id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorVerified: user.twoFactorEnabled,
        emailVerified: user.emailVerified,
      });

      return {
        message: ApiCode.AUTH_TOKEN_REFRESHED,
        tokens,
      };
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException(ApiCode.AUTH_INVALID_REFRESH_TOKEN);
    }
  }

  async getProfile(user: any) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        language: true,
        twoFactorEnabled: true,
        emailVerified: true,
        isSuperAdmin: true,
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
    }

    return { user: dbUser };
  }

  async updateLanguage(user: any, language: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
    }

    // Update user's language preference
    const updatedUser = await this.prisma.user.update({
      where: { id: user.userId },
      data: { language },
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        language: true,
        twoFactorEnabled: true,
        emailVerified: true,
      },
    });

    return {
      message: "Language preference updated successfully",
      user: updatedUser
    };
  }

  async setupTwoFactor(user: any) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
    }

    // Generate 2FA secret
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      dbUser.email,
      this.configService.get("APP_NAME", "Neo"),
      secret
    );

    // Store secret temporarily (not enabled until verified)
    await this.prisma.user.update({
      where: { id: user.userId },
      data: { twoFactorSecret: secret },
    });

    // Generate QR code from the otpauth URL
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrCode,
      manualEntryKey: secret, // Provide the secret as manual entry key for frontend compatibility
    };
  }

  async verifyTwoFactor(user: any, token: string, enable: boolean = false) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser?.twoFactorSecret) {
      throw new BadRequestException(ApiCode.AUTH_2FA_NOT_SET_UP);
    }

    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: dbUser.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_2FA_TOKEN);
    }

    // If enabling 2FA, update user
    if (enable) {
      await this.prisma.user.update({
        where: { id: user.userId },
        data: { twoFactorEnabled: true },
      });
    }

    // Generate new tokens with 2FA verified
    const tokens = this.generateTokens({
      userId: user.userId,
      email: user.email,
      twoFactorEnabled: enable || dbUser.twoFactorEnabled,
      twoFactorVerified: true,
      emailVerified: dbUser.emailVerified,
    });

    return {
      message: enable
        ? ApiCode.AUTH_2FA_ENABLED_SUCCESSFULLY
        : ApiCode.AUTH_2FA_VERIFIED,
      tokens,
    };
  }

  async disableTwoFactor(user: any, token: string) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser?.twoFactorEnabled || !dbUser.twoFactorSecret) {
      throw new BadRequestException(ApiCode.AUTH_2FA_NOT_ENABLED);
    }

    // Verify token before disabling
    const isValid = authenticator.verify({
      token,
      secret: dbUser.twoFactorSecret,
    });

    if (!isValid) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_2FA_TOKEN);
    }

    // Disable 2FA
    await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return {
      message: ApiCode.AUTH_2FA_DISABLED_SUCCESSFULLY,
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email, language } = forgotPasswordDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // For security reasons, we always return the same response
    // regardless of whether the email exists or not
    const response = {
      message: "If an account with that email exists, we'll send you a password reset link.",
    };

    // If user doesn't exist, return success message (don't reveal)
    if (!user) {
      return response;
    }

    // Generate password reset token
    const resetToken = this.tokenService.generatePasswordResetToken({
      email: user.email,
      userId: user.id,
    });

    // Send password reset email
    const appUrl = this.configService.get<string>("FRONTEND_URL");
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name || user.email.split("@")[0],
      resetUrl,
      language: user.language || language || "pt", // Use user's preferred language, fallback to parameter or Portuguese
    });

    return response;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    // Verify the reset token
    const payload = this.tokenService.verifyPasswordResetToken(token);
    if (!payload || !payload.email || !payload.userId) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_TOKEN);
    }

    // Find user by ID from token
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_TOKEN);
    }

    // Verify email matches
    if (user.email !== payload.email) {
      throw new BadRequestException(ApiCode.AUTH_INVALID_TOKEN);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: "Password has been reset successfully. You can now login with your new password.",
    };
  }

  async logout(user: any) {
    // For JWT-based authentication, logout is primarily handled client-side
    // by removing tokens. This endpoint provides a way to notify the server
    // and allows for potential future token blacklisting if needed.
    return {
      message: "Logout successful",
    };
  }

  private generateTokens(payload: {
    userId: string;
    email: string;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
    emailVerified: Date | null;
  }) {
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: "15m",
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_REFRESH_SECRET"),
      expiresIn: "7d",
    });

    return { accessToken, refreshToken };
  }

  private async sendVerificationEmail(email: string, language?: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = this.tokenService.generateVerificationToken({
      email: user.email,
    });
    const appUrl = this.configService.get<string>("FRONTEND_URL");
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name || user.email.split("@")[0],
      verificationUrl: verifyUrl,
      language: user.language || language || "pt", // Use user's preferred language, fallback to parameter or Portuguese
    });
  }
}

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import {
  ChangePasswordDto,
  DisableTwoFactorDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignupDto,
  UpdateLanguageDto,
  VerifyEmailDto,
  VerifyTwoFactorDto,
} from "./dto";
import {
  EmailVerificationResponseDto,
  LoginResponseDto,
  ProfileResponseDto,
  SignupResponseDto,
  TokenResponseDto,
  TwoFactorSetupResponseDto,
  TwoFactorVerificationResponseDto,
} from "./dto/responses.dto";
import { JwtAuthGuard, Require2FA } from "./guards/jwt-auth.guard";

export interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    twoFactorEnabled: boolean;
    twoFactorVerified: boolean;
    emailVerified: Date | null;
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  @ApiResponse({
    status: 403,
    description: "Email not verified or 2FA required",
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("signup")
  @ApiOperation({ summary: "Register new user" })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
    type: SignupResponseDto,
  })
  @ApiResponse({ status: 400, description: "User already exists" })
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Verify user email" })
  @ApiResponse({
    status: 200,
    description: "Email verified successfully",
    type: EmailVerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Tokens refreshed successfully",
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "Returns user profile",
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req: RequestWithUser) {
    return this.authService.getProfile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Require2FA(false)
  @Patch("language")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update user language preference" })
  @ApiResponse({
    status: 200,
    description: "Language preference updated successfully",
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateLanguage(
    @Request() req: RequestWithUser,
    @Body() updateLanguageDto: UpdateLanguageDto
  ) {
    return this.authService.updateLanguage(req.user, updateLanguageDto.language);
  }

  @UseGuards(JwtAuthGuard)
  @Require2FA(false)
  @Post("2fa/setup")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Setup two-factor authentication" })
  @ApiResponse({
    status: 200,
    description: "Returns 2FA setup details",
    type: TwoFactorSetupResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async setupTwoFactor(@Request() req: RequestWithUser) {
    return this.authService.setupTwoFactor(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Require2FA(false)
  @Post("2fa/verify")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify two-factor authentication" })
  @ApiResponse({
    status: 200,
    description: "2FA verified or enabled",
    type: TwoFactorVerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid 2FA token" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async verifyTwoFactor(
    @Request() req: RequestWithUser,
    @Body() verifyTwoFactorDto: VerifyTwoFactorDto
  ) {
    return this.authService.verifyTwoFactor(
      req.user,
      verifyTwoFactorDto.token,
      verifyTwoFactorDto.enable
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post("2fa/disable")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Disable two-factor authentication" })
  @ApiResponse({ status: 200, description: "2FA disabled successfully" })
  @ApiResponse({ status: 400, description: "Invalid 2FA token" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async disableTwoFactor(
    @Request() req: RequestWithUser,
    @Body() disableTwoFactorDto: DisableTwoFactorDto
  ) {
    return this.authService.disableTwoFactor(
      req.user,
      disableTwoFactorDto.token
    );
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Request password reset" })
  @ApiResponse({
    status: 200,
    description: "Password reset email sent (if email exists)",
  })
  @ApiResponse({ status: 400, description: "Invalid email format" })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Reset password with token" })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change password (clears mustChangePassword flag)" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 401, description: "Invalid current password" })
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({
    status: 200,
    description: "Logout successful",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(@Request() req: RequestWithUser) {
    return this.authService.logout(req.user);
  }
}

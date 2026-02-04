import { ApiProperty } from "@nestjs/swagger";

export class TokenResponseDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT access token",
  })
  accessToken: string;

  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT refresh token",
  })
  refreshToken: string;
}

export class LoginResponseDto {
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "User ID",
  })
  userId: string;

  @ApiProperty({
    example: "user@example.com",
    description: "User email",
  })
  email: string;

  @ApiProperty({
    example: "en",
    description: "User's preferred language",
    nullable: true,
  })
  language: string | null;

  @ApiProperty({
    example: true,
    description: "Whether 2FA is enabled for the user",
  })
  twoFactorEnabled: boolean;

  @ApiProperty({
    example: true,
    description: "Whether 2FA has been verified in this session",
  })
  twoFactorVerified: boolean;

  @ApiProperty({
    example: "2024-03-20T12:00:00Z",
    description: "When the email was verified",
    nullable: true,
  })
  emailVerified: Date | null;

  @ApiProperty({
    type: TokenResponseDto,
    description: "Authentication tokens",
  })
  tokens: TokenResponseDto;
}

export class SignupResponseDto {
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "User ID",
  })
  userId: string;

  @ApiProperty({
    example: "user@example.com",
    description: "User email",
  })
  email: string;

  @ApiProperty({
    example: "John Doe",
    description: "User full name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    example: "+1234567890",
    description: "User phone number",
    nullable: true,
  })
  phoneNumber: string | null;

  @ApiProperty({
    example: "en",
    description: "User's preferred language",
    nullable: true,
  })
  language: string | null;

  @ApiProperty({
    example: false,
    description: "Whether 2FA is enabled",
  })
  twoFactorEnabled: boolean;

  @ApiProperty({
    example: null,
    description: "When the email was verified",
    nullable: true,
  })
  emailVerified: Date | null;
}

export class ProfileResponseDto {
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "User ID",
  })
  userId: string;

  @ApiProperty({
    example: "user@example.com",
    description: "User email",
  })
  email: string;

  @ApiProperty({
    example: "John Doe",
    description: "User full name",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    example: "+1234567890",
    description: "User phone number",
    nullable: true,
  })
  phoneNumber: string | null;

  @ApiProperty({
    example: "en",
    description: "User's preferred language",
    nullable: true,
  })
  language: string | null;

  @ApiProperty({
    example: true,
    description: "Whether 2FA is enabled",
  })
  twoFactorEnabled: boolean;

  @ApiProperty({
    example: "2024-03-20T12:00:00Z",
    description: "When the email was verified",
    nullable: true,
  })
  emailVerified: Date | null;

  @ApiProperty({
    example: "2024-03-20T12:00:00Z",
    description: "When the user was created",
  })
  createdAt: Date;

  @ApiProperty({
    example: "2024-03-20T12:00:00Z",
    description: "When the user was last updated",
  })
  updatedAt: Date;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({
    example: "JBSWY3DPEHPK3PXP",
    description: "2FA secret key",
  })
  secret: string;

  @ApiProperty({
    example: "otpauth://totp/Example:alice@google.com?secret=JBSWY3DPEHPK3PXP&issuer=Example",
    description: "OTP Auth URL for manual setup",
  })
  otpauthUrl: string;

  @ApiProperty({
    example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    description: "QR code as data URL for 2FA setup",
  })
  qrCode: string;

  @ApiProperty({
    example: "JBSWY3DPEHPK3PXP",
    description: "Manual entry key (same as secret for compatibility)",
  })
  manualEntryKey: string;
}

export class EmailVerificationResponseDto {
  @ApiProperty({
    example: true,
    description: "Whether the email was successfully verified",
  })
  verified: boolean;

  @ApiProperty({
    example: "user@example.com",
    description: "The email that was verified",
  })
  email: string;
}

export class TwoFactorVerificationResponseDto {
  @ApiProperty({
    example: true,
    description: "Whether 2FA was successfully verified",
  })
  verified: boolean;

  @ApiProperty({
    example: true,
    description: "Whether 2FA was enabled",
    required: false,
  })
  enabled?: boolean;
}

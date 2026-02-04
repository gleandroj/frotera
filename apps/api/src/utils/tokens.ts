import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateVerificationToken(payload: { email: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_VERIFICATION_SECRET') || 'verification-secret',
      expiresIn: '24h',
    });
  }

  generateAccessToken(payload: { userId: string; email: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'access-secret',
      expiresIn: '15m',
    });
  }

  generateRefreshToken(payload: { userId: string; email: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
      expiresIn: '7d',
    });
  }

  verifyEmailToken(token: string): { email: string; userId?: string } | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_VERIFICATION_SECRET') || 'verification-secret',
      }) as { email: string; userId?: string };
    } catch (error) {
      return null;
    }
  }

  generatePasswordResetToken(payload: { email: string; userId: string }): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_PASSWORD_RESET_SECRET') || 'password-reset-secret',
      expiresIn: '1h', // Password reset tokens expire in 1 hour
    });
  }

  verifyPasswordResetToken(token: string): { email: string; userId: string } | null {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_PASSWORD_RESET_SECRET') || 'password-reset-secret',
      }) as { email: string; userId: string };
    } catch (error) {
      return null;
    }
  }
}
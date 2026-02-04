import { ApiProperty } from '@nestjs/swagger';

class UserProfileDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
  })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    example: '+1234567890',
    description: 'User phone number',
    nullable: true,
  })
  phoneNumber: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether 2FA is enabled',
  })
  twoFactorEnabled: boolean;

  @ApiProperty({
    example: '2024-03-20T12:00:00Z',
    description: 'When the email was verified',
    nullable: true,
  })
  emailVerified: Date | null;
}

export class UpdateProfileResponseDto {
  @ApiProperty({
    example: 'Profile updated successfully',
    description: 'Success message',
  })
  message: string;

  @ApiProperty({
    type: UserProfileDto,
    description: 'Updated user profile',
  })
  user: UserProfileDto;
}
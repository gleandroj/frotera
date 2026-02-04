import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ApiCode } from "@/common/api-codes.enum";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { name, phoneNumber } = updateProfileDto;

    const dataToUpdate: { name?: string; phoneNumber?: string | null } = {};
    if (name !== undefined) {
      dataToUpdate.name = name;
    }
    if (phoneNumber !== undefined) {
      dataToUpdate.phoneNumber = phoneNumber === "" ? null : phoneNumber;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      throw new BadRequestException(ApiCode.VALIDATION_REQUIRED_FIELD);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        phoneNumber: true,
        twoFactorEnabled: true,
        emailVerified: true,
      },
    });

    if (!updatedUser) {
      throw new UnauthorizedException(ApiCode.USER_NOT_FOUND);
    }

    return {
      message: ApiCode.USER_PROFILE_UPDATED_SUCCESSFULLY,
      user: updatedUser,
    };
  }
}

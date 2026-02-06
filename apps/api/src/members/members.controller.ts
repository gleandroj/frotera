import { Body, Controller, Delete, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  DeleteMemberResponseDto,
  MembersListResponseDto,
  UpdateMemberDto,
  UpdateMemberResponseDto,
} from './members.dto';
import { MembersService } from './members.service';

interface RequestWithUser extends ExpressRequest {
  user: {
    userId: string;
  };
}

@ApiTags('members')
@Controller('organizations/:organizationId/members')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all members of an organization' })
  @ApiResponse({ status: 200, type: MembersListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMembers(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
  ): Promise<MembersListResponseDto> {
    return this.membersService.getMembers(req.user.userId, organizationId);
  }

  @Patch(':memberId')
  @ApiOperation({ summary: 'Update member role and customer access' })
  @ApiResponse({ status: 200, type: UpdateMemberResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMember(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateMemberDto,
  ): Promise<UpdateMemberResponseDto> {
    return this.membersService.updateMember(
      req.user.userId,
      organizationId,
      memberId,
      body,
    );
  }

  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove member from organization' })
  @ApiResponse({ status: 200, type: DeleteMemberResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async removeMember(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<DeleteMemberResponseDto> {
    return this.membersService.removeMember(req.user.userId, organizationId, memberId);
  }
}
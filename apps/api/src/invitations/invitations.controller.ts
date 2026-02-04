import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateInvitationDto,
  InvitationsListResponseDto,
  ResendInvitationDto,
} from "./invitations.dto";
import { InvitationsService } from "./invitations.service";

@ApiTags("invitations")
@Controller("organizations/:organizationId/invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create a new invitation" })
  @ApiResponse({ status: 201, description: "Invitation created successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async createInvitation(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param("organizationId") organizationId: string,
    @Body() body: CreateInvitationDto
  ) {
    return this.invitationsService.createInvitation(req.user.userId, {
      ...body,
      organizationId,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all invitations for an organization" })
  @ApiResponse({ status: 200, type: InvitationsListResponseDto })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getInvitations(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param("organizationId") organizationId: string
  ): Promise<InvitationsListResponseDto> {
    return this.invitationsService.getInvitations(
      req.user.userId,
      organizationId
    );
  }

  @Post("resend")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Resend an invitation" })
  @ApiResponse({ status: 200, description: "Invitation resent successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  async resendInvitation(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param("organizationId") organizationId: string,
    @Body() body: ResendInvitationDto
  ) {
    return this.invitationsService.resendInvitation(
      req.user.userId,
      organizationId,
      body
    );
  }

  @Delete(":invitationId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke an invitation" })
  @ApiResponse({ status: 200, description: "Invitation revoked successfully" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  async revokeInvitation(
    @Request() req: ExpressRequest & { user: { userId: string } },
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string
  ) {
    return this.invitationsService.revokeInvitation(
      req.user.userId,
      organizationId,
      invitationId
    );
  }
}

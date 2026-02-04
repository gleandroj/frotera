import {
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  AcceptInvitationDto,
  AcceptInvitationResponseDto,
  CheckInvitationDto,
  InvitationCheckResponseDto,
} from "./invitations.dto";
import { InvitationsService } from "./invitations.service";

@ApiTags("invitations")
@Controller("invitations")
export class PublicInvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post("check")
  @ApiOperation({ summary: "Check invitation status" })
  @ApiResponse({ status: 200, type: InvitationCheckResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  async checkInvitation(
    @Body() body: CheckInvitationDto
  ): Promise<InvitationCheckResponseDto> {
    return this.invitationsService.checkInvitation(body.token);
  }

  @Post("accept")
  @ApiOperation({ summary: "Accept an invitation" })
  @ApiResponse({ status: 200, type: AcceptInvitationResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  async acceptInvitation(
    @Body() body: AcceptInvitationDto
  ): Promise<AcceptInvitationResponseDto> {
    return this.invitationsService.acceptInvitation(body.token, {
      password: body.password,
      name: body.name,
    });
  }
}
import { ApiProperty } from "@nestjs/swagger";

export class DashboardStatsDto {
  @ApiProperty({ description: "Total team members in the organization" })
  teamMembers: number;

  @ApiProperty({ description: "Total pending invitations" })
  pendingInvitations: number;
}

export class DashboardResponseDto {
  @ApiProperty({ description: "Success message" })
  message: string;

  @ApiProperty({ description: "Dashboard statistics", type: () => DashboardStatsDto })
  data: DashboardStatsDto;
}

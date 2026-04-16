import { ApiProperty } from "@nestjs/swagger";

export class DashboardStatsDto {
  @ApiProperty({ description: "Total team members in the organization" })
  teamMembers: number;
}

export class DashboardResponseDto {
  @ApiProperty({ description: "Success message" })
  message: string;

  @ApiProperty({ description: "Dashboard statistics", type: () => DashboardStatsDto })
  data: DashboardStatsDto;
}

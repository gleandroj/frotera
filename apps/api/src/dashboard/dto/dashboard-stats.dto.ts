import { ApiProperty } from "@nestjs/swagger";

export class DashboardStatsDto {
  @ApiProperty({ description: "Total team members in the organization" })
  teamMembers: number;

  @ApiProperty({ description: "Active vehicles (not marked inactive)" })
  vehiclesActive: number;

  @ApiProperty({ description: "Active drivers" })
  driversActive: number;

  @ApiProperty({ description: "Tracker devices registered for the organization" })
  trackers: number;

  @ApiProperty({ description: "Customers / companies in the organization" })
  customers: number;

  @ApiProperty({
    description: "Incidents that are open or in progress",
  })
  openIncidents: number;
}

export class DashboardResponseDto {
  @ApiProperty({ description: "Success message" })
  message: string;

  @ApiProperty({ description: "Dashboard statistics", type: () => DashboardStatsDto })
  data: DashboardStatsDto;
}

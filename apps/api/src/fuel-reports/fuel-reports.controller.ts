import {
  Controller,
  Get,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { OrgScopedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { FuelReportsService } from './fuel-reports.service';
import {
  ConsumptionReportQueryDto,
  CostsReportQueryDto,
  BenchmarkReportQueryDto,
  EfficiencyReportQueryDto,
  SummaryReportQueryDto,
  VehicleConsumptionDto,
  CostsPeriodDto,
  BenchmarkSummaryDto,
  VehicleEfficiencyDto,
  PeriodSummaryDto,
} from './fuel-reports.dto';

@ApiTags('fuel-reports')
@Controller('organizations/:organizationId/fuel/reports')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard)
@ApiBearerAuth()
export class FuelReportsController {
  constructor(private readonly fuelReportsService: FuelReportsService) {}

  @Get('consumption')
  @ApiOkResponse({ type: [VehicleConsumptionDto] })
  async getConsumption(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: ConsumptionReportQueryDto,
  ): Promise<VehicleConsumptionDto[]> {
    const memberId = req.organizationMember.id;
    return this.fuelReportsService.getConsumptionReport(
      organizationId,
      memberId,
      query,
    );
  }

  @Get('costs')
  @ApiOkResponse({ type: [CostsPeriodDto] })
  async getCosts(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: CostsReportQueryDto,
  ): Promise<CostsPeriodDto[]> {
    const memberId = req.organizationMember.id;
    return this.fuelReportsService.getCostsReport(
      organizationId,
      memberId,
      query,
    );
  }

  @Get('benchmark')
  @ApiOkResponse({ type: BenchmarkSummaryDto })
  async getBenchmark(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: BenchmarkReportQueryDto,
  ): Promise<BenchmarkSummaryDto> {
    const memberId = req.organizationMember.id;
    return this.fuelReportsService.getBenchmarkReport(
      organizationId,
      memberId,
      query,
    );
  }

  @Get('efficiency')
  @ApiOkResponse({ type: [VehicleEfficiencyDto] })
  async getEfficiency(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: EfficiencyReportQueryDto,
  ): Promise<VehicleEfficiencyDto[]> {
    const memberId = req.organizationMember.id;
    return this.fuelReportsService.getEfficiencyReport(
      organizationId,
      memberId,
      query,
    );
  }

  @Get('summary')
  @ApiOkResponse({ type: PeriodSummaryDto })
  async getSummary(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: SummaryReportQueryDto,
  ): Promise<PeriodSummaryDto> {
    const memberId = req.organizationMember.id;
    return this.fuelReportsService.getSummaryReport(
      organizationId,
      memberId,
      query,
    );
  }
}

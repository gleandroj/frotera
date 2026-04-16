import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
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
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FuelReportsController {
  constructor(private readonly fuelReportsService: FuelReportsService) {}

  /**
   * GET /api/organizations/:orgId/fuel/reports/consumption
   */
  @Get('consumption')
  @ApiOkResponse({ type: [VehicleConsumptionDto] })
  async getConsumption(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: ConsumptionReportQueryDto,
  ): Promise<VehicleConsumptionDto[]> {
    const memberId = req.user.organizationMemberId;
    return this.fuelReportsService.getConsumptionReport(
      organizationId,
      memberId,
      query,
    );
  }

  /**
   * GET /api/organizations/:orgId/fuel/reports/costs
   */
  @Get('costs')
  @ApiOkResponse({ type: [CostsPeriodDto] })
  async getCosts(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: CostsReportQueryDto,
  ): Promise<CostsPeriodDto[]> {
    const memberId = req.user.organizationMemberId;
    return this.fuelReportsService.getCostsReport(
      organizationId,
      memberId,
      query,
    );
  }

  /**
   * GET /api/organizations/:orgId/fuel/reports/benchmark
   */
  @Get('benchmark')
  @ApiOkResponse({ type: BenchmarkSummaryDto })
  async getBenchmark(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: BenchmarkReportQueryDto,
  ): Promise<BenchmarkSummaryDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelReportsService.getBenchmarkReport(
      organizationId,
      memberId,
      query,
    );
  }

  /**
   * GET /api/organizations/:orgId/fuel/reports/efficiency
   */
  @Get('efficiency')
  @ApiOkResponse({ type: [VehicleEfficiencyDto] })
  async getEfficiency(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: EfficiencyReportQueryDto,
  ): Promise<VehicleEfficiencyDto[]> {
    const memberId = req.user.organizationMemberId;
    return this.fuelReportsService.getEfficiencyReport(
      organizationId,
      memberId,
      query,
    );
  }

  /**
   * GET /api/organizations/:orgId/fuel/reports/summary
   */
  @Get('summary')
  @ApiOkResponse({ type: PeriodSummaryDto })
  async getSummary(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: SummaryReportQueryDto,
  ): Promise<PeriodSummaryDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelReportsService.getSummaryReport(
      organizationId,
      memberId,
      query,
    );
  }
}

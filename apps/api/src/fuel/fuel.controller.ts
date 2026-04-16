import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { FuelService } from './fuel.service';
import {
  CreateFuelLogDto,
  UpdateFuelLogDto,
  FuelLogResponseDto,
  FuelStatsResponseDto,
  ListFuelLogsQueryDto,
  FuelStatsQueryDto,
} from './fuel.dto';

@ApiTags('fuel')
@Controller('organizations/:organizationId/fuel')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  /**
   * GET /api/organizations/:orgId/fuel/stats — MUST come before /:id
   */
  @Get('stats')
  @ApiOkResponse({ type: FuelStatsResponseDto })
  async getStats(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: FuelStatsQueryDto,
  ): Promise<FuelStatsResponseDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelService.getStats(organizationId, memberId, query);
  }

  /**
   * GET /api/organizations/:orgId/fuel
   */
  @Get()
  @ApiOkResponse({ type: [FuelLogResponseDto] })
  async list(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Query() query: ListFuelLogsQueryDto,
  ): Promise<FuelLogResponseDto[]> {
    const memberId = req.user.organizationMemberId;
    return this.fuelService.list(organizationId, memberId, query);
  }

  /**
   * POST /api/organizations/:orgId/fuel
   */
  @Post()
  @ApiCreatedResponse({ type: FuelLogResponseDto })
  async create(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Body() body: CreateFuelLogDto,
  ): Promise<FuelLogResponseDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelService.create(organizationId, memberId, body);
  }

  /**
   * GET /api/organizations/:orgId/fuel/:id
   */
  @Get(':id')
  @ApiOkResponse({ type: FuelLogResponseDto })
  async getOne(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<FuelLogResponseDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelService.getById(id, organizationId, memberId);
  }

  /**
   * PATCH /api/organizations/:orgId/fuel/:id
   */
  @Patch(':id')
  @ApiOkResponse({ type: FuelLogResponseDto })
  async update(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: UpdateFuelLogDto,
  ): Promise<FuelLogResponseDto> {
    const memberId = req.user.organizationMemberId;
    return this.fuelService.update(id, organizationId, memberId, body);
  }

  /**
   * DELETE /api/organizations/:orgId/fuel/:id
   */
  @Delete(':id')
  @HttpCode(200)
  @ApiOkResponse({ schema: { example: { message: 'Fuel log deleted successfully' } } })
  async delete(
    @Request() req: any,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const memberId = req.user.organizationMemberId;
    await this.fuelService.delete(id, organizationId, memberId);
    return { message: 'Fuel log deleted successfully' };
  }
}

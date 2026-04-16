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
   * GET /api/organizations/:orgId/fuel/market-prices — MUST come before /stats and /:id
   */
  @Get('market-prices')
  @ApiOkResponse({ schema: { example: { avgPrice: 6.69, refDate: '2026-04-16' } } })
  async getMarketPrices(
    @Param('organizationId') organizationId: string,
    @Query('state') state: string,
    @Query('fuelType') fuelType: string,
  ): Promise<{ avgPrice: number | null; refDate: string | null }> {
    return this.fuelService.getMarketPrices(state, fuelType);
  }

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
    const userId = req.user.userId;
    return this.fuelService.getStats(organizationId, userId, query);
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
    const userId = req.user.userId;
    return this.fuelService.list(organizationId, userId, query);
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
    const userId = req.user.userId;
    return this.fuelService.create(organizationId, userId, body);
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
    const userId = req.user.userId;
    return this.fuelService.getById(id, organizationId, userId);
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
    const userId = req.user.userId;
    return this.fuelService.update(id, organizationId, userId, body);
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
    const userId = req.user.userId;
    await this.fuelService.delete(id, organizationId, userId);
    return { message: 'Fuel log deleted successfully' };
  }
}

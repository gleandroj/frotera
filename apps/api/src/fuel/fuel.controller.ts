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
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import type { JwtAuthenticatedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { FuelService } from './fuel.service';
import { FuelGeoService } from './fuel-geo.service';
import { FUEL_RECEIPT_UPLOAD_MAX_BYTES } from './fuel-receipt-upload';
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
  constructor(
    private readonly fuelService: FuelService,
    private readonly fuelGeoService: FuelGeoService,
  ) {}

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
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: FuelStatsQueryDto,
  ): Promise<FuelStatsResponseDto> {
    const userId = req.user.userId;
    return this.fuelService.getStats(organizationId, userId, query);
  }

  /**
   * GET /api/organizations/:orgId/fuel/geo/states — estados (tabela `ibge_ufs`, seed IBGE)
   */
  @Get('geo/states')
  @ApiOkResponse({
    schema: {
      example: [{ sigla: 'RS', nome: 'Rio Grande do Sul' }],
    },
  })
  async listGeoStates(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
  ): Promise<Array<{ sigla: string; nome: string }>> {
    const userId = req.user.userId;
    return this.fuelGeoService.listEstados(organizationId, userId);
  }

  /**
   * GET /api/organizations/:orgId/fuel/geo/municipios?uf=RS — municípios (`ibge_municipios`, seed IBGE)
   */
  @Get('geo/municipios')
  @ApiOkResponse({
    schema: {
      example: [{ id: 4314902, nome: 'Porto Alegre' }],
    },
  })
  async listGeoMunicipios(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Query('uf') uf: string,
  ): Promise<Array<{ id: number; nome: string }>> {
    const userId = req.user.userId;
    return this.fuelGeoService.listMunicipios(organizationId, userId, uf);
  }

  /**
   * POST /api/organizations/:orgId/fuel/upload-receipt — comprovante → S3
   */
  @Post('upload-receipt')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        fileUrl: 'https://…',
        originalName: 'nota.jpg',
        mimeType: 'image/jpeg',
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: FUEL_RECEIPT_UPLOAD_MAX_BYTES } }),
  )
  async uploadReceipt(
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @UploadedFile(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: FUEL_RECEIPT_UPLOAD_MAX_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ fileUrl: string; originalName: string; mimeType: string }> {
    const userId = req.user.userId;
    return this.fuelService.uploadReceipt(
      organizationId,
      userId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  /**
   * GET /api/organizations/:orgId/fuel
   */
  @Get()
  @ApiOkResponse({ type: [FuelLogResponseDto] })
  async list(
    @Request() req: JwtAuthenticatedRequest,
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
    @Request() req: JwtAuthenticatedRequest,
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
    @Request() req: JwtAuthenticatedRequest,
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
    @Request() req: JwtAuthenticatedRequest,
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
    @Request() req: JwtAuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    const userId = req.user.userId;
    await this.fuelService.delete(id, organizationId, userId);
    return { message: 'Fuel log deleted successfully' };
  }
}

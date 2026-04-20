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
  HttpCode,
  Request,
  HttpStatus,
  ParseFilePipe,
  MaxFileSizeValidator,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { OrgScopedRequest } from '@/auth/types/authenticated-request.types';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import { Permission } from '@/auth/decorators/permission.decorator';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { RoleActionEnum, RoleModuleEnum } from '@/roles/roles.dto';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponseDto,
  DocumentsListResponseDto,
  ListDocumentsQueryDto,
  ExpiringQueryDto,
} from './documents.dto';

const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

@ApiTags('documents')
@Controller('organizations/:organizationId/documents')
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.VIEW)
  async list(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentsListResponseDto> {
    return this.documentsService.list(
      organizationId,
      query,
      req.allowedCustomerIds ?? null,
      req.allowedVehicleIds ?? null,
    );
  }

  @Get('expiring')
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.VIEW)
  async listExpiring(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: ExpiringQueryDto,
  ): Promise<DocumentsListResponseDto> {
    const days = query.days ?? 30;
    return this.documentsService.listExpiring(
      organizationId,
      days,
      req.allowedCustomerIds ?? null,
      query.customerId,
      req.allowedVehicleIds ?? null,
    );
  }

  @Post('upload')
  @HttpCode(201)
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_UPLOAD_BYTES } }),
  )
  async uploadAttachment(
    @Param('organizationId') organizationId: string,
    @UploadedFile(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_DOCUMENT_UPLOAD_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ fileUrl: string }> {
    return this.documentsService.uploadAttachment(
      organizationId,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post()
  @HttpCode(201)
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.CREATE)
  async create(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(
      organizationId,
      req.organizationMember.id,
      dto,
      req.allowedCustomerIds ?? null,
    );
  }

  @Get(':id')
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.VIEW)
  async getOne(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.getById(
      id,
      organizationId,
      req.allowedCustomerIds ?? null,
      req.allowedVehicleIds ?? null,
    );
  }

  @Patch(':id')
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.EDIT)
  async update(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.update(
      id,
      organizationId,
      dto,
      req.allowedCustomerIds ?? null,
      req.allowedVehicleIds ?? null,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @Permission(RoleModuleEnum.DOCUMENTS, RoleActionEnum.DELETE)
  async remove(
    @Request() req: OrgScopedRequest,
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documentsService.remove(
      id,
      organizationId,
      req.allowedCustomerIds ?? null,
      req.allowedVehicleIds ?? null,
    );
  }
}

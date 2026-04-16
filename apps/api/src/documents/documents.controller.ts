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
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  DocumentResponseDto,
  DocumentsListResponseDto,
  ListDocumentsQueryDto,
  ExpiringQueryDto,
} from './documents.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@ApiTags('documents')
@Controller('organizations/:organizationId/documents')
@UseGuards(JwtAuthGuard)
// TODO(RBAC): adicionar @UseGuards(PermissionGuard) e decoradores @Permission(Module.DOCUMENTS, ...)
@ApiBearerAuth()
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  // GET /api/organizations/:orgId/documents
  // Query: vehicleId?, type?, expiryBefore?
  @Get()
  async list(
    @Param('organizationId') organizationId: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentsListResponseDto> {
    return this.documentsService.list(organizationId, query);
  }

  // GET /api/organizations/:orgId/documents/expiring
  // Query: days? (default 30)
  // IMPORTANTE: esta rota deve ser declarada ANTES de /:id para evitar conflito
  @Get('expiring')
  async listExpiring(
    @Param('organizationId') organizationId: string,
    @Query() query: ExpiringQueryDto,
  ): Promise<DocumentsListResponseDto> {
    const days = query.days ?? 30;
    return this.documentsService.listExpiring(organizationId, days);
  }

  // POST /api/organizations/:orgId/documents
  @Post()
  @HttpCode(201)
  async create(
    @Request() req: RequestWithUser,
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    // TODO(RBAC): @Permission(Module.DOCUMENTS, Action.CREATE)
    // Obter OrganizationMember pelo userId + organizationId
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: req.user.userId, organizationId },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException();
    return this.documentsService.create(organizationId, member.id, dto);
  }

  // GET /api/organizations/:orgId/documents/:id
  @Get(':id')
  async getOne(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<DocumentResponseDto> {
    // TODO(RBAC): @Permission(Module.DOCUMENTS, Action.VIEW)
    return this.documentsService.getById(id, organizationId);
  }

  // PATCH /api/organizations/:orgId/documents/:id
  @Patch(':id')
  async update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponseDto> {
    // TODO(RBAC): @Permission(Module.DOCUMENTS, Action.EDIT)
    return this.documentsService.update(id, organizationId, dto);
  }

  // DELETE /api/organizations/:orgId/documents/:id
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ): Promise<void> {
    // TODO(RBAC): @Permission(Module.DOCUMENTS, Action.DELETE)
    return this.documentsService.remove(id, organizationId);
  }
}

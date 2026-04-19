import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { PermissionGuard } from "@/auth/guards/permission.guard";
import { Permission } from "@/auth/decorators/permission.decorator";
import { OrganizationMemberGuard } from "@/organizations/guards/organization-member.guard";
import { RoleActionEnum, RoleModuleEnum } from "@/roles/roles.dto";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import {
  AddAttachmentDto,
  CreateIncidentDto,
  IncidentFiltersDto,
  UpdateIncidentDto,
} from "./incidents.dto";
import { IncidentsService } from "./incidents.service";
import { INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES } from "./incidents-attachment-upload";

@ApiTags("incidents")
@Controller("organizations/:organizationId/incidents")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly service: IncidentsService) {}

  @Get("stats")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Estatísticas de ocorrências" })
  stats(
    @Request() req: OrgScopedRequest,
    @Param("organizationId") organizationId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("customerId") filterCustomerId?: string,
  ) {
    return this.service.stats(
      organizationId,
      dateFrom,
      dateTo,
      req.allowedCustomerIds ?? null,
      filterCustomerId,
    );
  }

  @Get()
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar ocorrências" })
  list(
    @Param("organizationId") organizationId: string,
    @Query() filters: IncidentFiltersDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.list(organizationId, filters, req.allowedCustomerIds ?? null);
  }

  @Post()
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.CREATE)
  @ApiOperation({ summary: "Registrar ocorrência" })
  create(
    @Request() req: OrgScopedRequest,
    @Param("organizationId") organizationId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.service.create(
      req.user.userId,
      organizationId,
      dto,
      req.allowedCustomerIds ?? null,
    );
  }

  @Get(":id")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Buscar ocorrência por ID" })
  findOne(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.findOne(organizationId, id, req.allowedCustomerIds ?? null);
  }

  @Patch(":id")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Atualizar ocorrência" })
  update(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Body() dto: UpdateIncidentDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.update(organizationId, id, dto, req.allowedCustomerIds ?? null);
  }

  @Delete(":id")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.DELETE)
  @ApiOperation({ summary: "Excluir ocorrência" })
  remove(
    @Param("organizationId") organizationId: string,
    @Param("id") id: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.remove(organizationId, id, req.allowedCustomerIds ?? null);
  }

  /** Declarar antes de POST :id/attachments (corpo JSON) para o roteador não ambiguar. */
  @Post(":id/attachments/upload")
  @HttpCode(HttpStatus.CREATED)
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.CREATE)
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiCreatedResponse({
    description: "Anexo criado após upload para armazenamento",
  })
  @ApiOperation({ summary: "Enviar ficheiro como anexo (JPEG, PNG, WebP ou PDF)" })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES },
    }),
  )
  uploadAttachment(
    @Param("organizationId") organizationId: string,
    @Param("id") incidentId: string,
    @Request() req: OrgScopedRequest,
    @UploadedFile(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.service.uploadAttachmentFile(
      organizationId,
      incidentId,
      file.buffer,
      file.originalname,
      file.mimetype,
      req.allowedCustomerIds ?? null,
    );
  }

  @Post(":id/attachments")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.CREATE)
  @ApiOperation({ summary: "Adicionar anexo à ocorrência" })
  addAttachment(
    @Param("organizationId") organizationId: string,
    @Param("id") incidentId: string,
    @Body() dto: AddAttachmentDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.addAttachment(
      organizationId,
      incidentId,
      dto,
      req.allowedCustomerIds ?? null,
    );
  }

  @Delete(":id/attachments/:attachmentId")
  @Permission(RoleModuleEnum.INCIDENTS, RoleActionEnum.DELETE)
  @ApiOperation({ summary: "Remover anexo" })
  removeAttachment(
    @Param("organizationId") organizationId: string,
    @Param("id") incidentId: string,
    @Param("attachmentId") attachmentId: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.service.removeAttachment(
      organizationId,
      incidentId,
      attachmentId,
      req.allowedCustomerIds ?? null,
    );
  }
}

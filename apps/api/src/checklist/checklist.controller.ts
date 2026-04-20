import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, MaxFileSizeValidator,
  Param, ParseFilePipe, Patch, Post, Query, Request, UploadedFile, UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { OrgScopedRequest } from "@/auth/types/authenticated-request.types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationMemberGuard } from "../organizations/guards/organization-member.guard";
import { PermissionGuard } from "../auth/guards/permission.guard";
import { Permission } from "../auth/decorators/permission.decorator";
import { RoleActionEnum, RoleModuleEnum } from "../roles/roles.dto";
import { ChecklistService, type ChecklistOrgAccess } from "./checklist.service";
import { clientIpFromRequest } from "./checklist-client-ip";
import {
  ChecklistEntryFilterDto, ChecklistSummaryQueryDto, ChecklistSummaryResponseDto,
  CreateChecklistEntryDto, CreateChecklistTemplateDto, UpdateChecklistEntryStatusDto,
  UpdateChecklistTemplateDto,
} from "./checklist.dto";

function orgAccess(req: OrgScopedRequest): ChecklistOrgAccess {
  return {
    allowedCustomerIds: req.allowedCustomerIds ?? null,
    allowedVehicleIds: req.allowedVehicleIds ?? null,
    memberId: req.organizationMember.id,
    isSuperAdmin: req.user.isSuperAdmin === true,
  };
}

@ApiTags("checklist")
@Controller("organizations/:organizationId/checklist")
@UseGuards(JwtAuthGuard, OrganizationMemberGuard, PermissionGuard)
@ApiBearerAuth()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get("templates")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar templates de checklist" })
  listTemplates(
    @Param("organizationId") organizationId: string,
    @Query("customerId") filterCustomerId: string | undefined,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.listTemplates(
      organizationId,
      orgAccess(req),
      filterCustomerId,
    );
  }

  @Post("templates")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Criar template de checklist" })
  createTemplate(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistTemplateDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.createTemplate(organizationId, body, orgAccess(req));
  }

  @Get("templates/:templateId")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Buscar template por ID" })
  getTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.getTemplate(templateId, organizationId, orgAccess(req));
  }

  @Patch("templates/:templateId")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Atualizar template" })
  updateTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Body() body: UpdateChecklistTemplateDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.updateTemplate(
      templateId,
      organizationId,
      body,
      orgAccess(req),
    );
  }

  @Delete("templates/:templateId")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.DELETE)
  @ApiOperation({ summary: "Excluir/desativar template" })
  deleteTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.deleteTemplate(templateId, organizationId, orgAccess(req));
  }

  @Post("upload")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.CREATE)
  @HttpCode(201)
  @ApiOperation({ summary: "Upload de anexo para checklist (foto, arquivo ou PNG de assinatura)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: {
        file: { type: "string", format: "binary" },
        purpose: { type: "string", enum: ["photo", "file", "signature"] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: ChecklistService.uploadMaxBytes } }),
  )
  async uploadChecklistFile(
    @Param("organizationId") organizationId: string,
    @Request() req: OrgScopedRequest,
    @Query("purpose") purpose: string,
    @UploadedFile(
      new ParseFilePipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        fileIsRequired: true,
        validators: [
          new MaxFileSizeValidator({ maxSize: ChecklistService.uploadMaxBytes }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<{ fileUrl: string; originalName: string; mimeType: string }> {
    return this.checklistService.uploadForMember(
      organizationId,
      req.user.userId,
      purpose,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  // ─── Reports ────────────────────────────────────────────────────────────────

  @Get("reports/summary")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Resumo agregado de entradas de checklist (por status e por template)" })
  @ApiOkResponse({ type: ChecklistSummaryResponseDto })
  getEntriesSummary(
    @Param("organizationId") organizationId: string,
    @Query() query: ChecklistSummaryQueryDto,
    @Request() req: OrgScopedRequest,
  ): Promise<ChecklistSummaryResponseDto> {
    return this.checklistService.getEntriesSummary(
      organizationId,
      query,
      orgAccess(req),
    );
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  @Get("entries")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Listar entradas de checklist" })
  listEntries(
    @Param("organizationId") organizationId: string,
    @Query() filters: ChecklistEntryFilterDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.listEntries(organizationId, filters, orgAccess(req));
  }

  @Post("entries")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.CREATE)
  @ApiOperation({ summary: "Criar e submeter checklist preenchido" })
  async createEntry(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistEntryDto,
    @Request() req: OrgScopedRequest,
  ) {
    const memberId = await this.checklistService.getMemberIdForUser(organizationId, req.user.userId);
    return this.checklistService.createEntry(organizationId, memberId, body, orgAccess(req), {
      clientIp: clientIpFromRequest(req),
    });
  }

  @Get("entries/:entryId")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.VIEW)
  @ApiOperation({ summary: "Buscar entrada por ID" })
  getEntry(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.getEntry(entryId, organizationId, orgAccess(req));
  }

  @Patch("entries/:entryId")
  @Permission(RoleModuleEnum.CHECKLIST, RoleActionEnum.EDIT)
  @ApiOperation({ summary: "Atualizar status da entrada" })
  updateEntryStatus(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
    @Body() body: UpdateChecklistEntryStatusDto,
    @Request() req: OrgScopedRequest,
  ) {
    return this.checklistService.updateEntryStatus(
      entryId,
      organizationId,
      body,
      orgAccess(req),
    );
  }
}

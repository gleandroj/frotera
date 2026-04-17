import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ChecklistService } from "./checklist.service";
import {
  ChecklistEntryFilterDto, CreateChecklistEntryDto,
  CreateChecklistTemplateDto, UpdateChecklistEntryStatusDto, UpdateChecklistTemplateDto,
} from "./checklist.dto";

interface RequestWithUser extends ExpressRequest {
  user: { userId: string };
}

@ApiTags("checklist")
@Controller("organizations/:organizationId/checklist")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get("templates")
  @ApiOperation({ summary: "Listar templates de checklist" })
  listTemplates(@Param("organizationId") organizationId: string) {
    return this.checklistService.listTemplates(organizationId);
  }

  @Post("templates")
  @ApiOperation({ summary: "Criar template de checklist" })
  createTemplate(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistTemplateDto,
  ) {
    return this.checklistService.createTemplate(organizationId, body);
  }

  @Get("templates/:templateId")
  @ApiOperation({ summary: "Buscar template por ID" })
  getTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
  ) {
    return this.checklistService.getTemplate(templateId, organizationId);
  }

  @Patch("templates/:templateId")
  @ApiOperation({ summary: "Atualizar template" })
  updateTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
    @Body() body: UpdateChecklistTemplateDto,
  ) {
    return this.checklistService.updateTemplate(templateId, organizationId, body);
  }

  @Delete("templates/:templateId")
  @ApiOperation({ summary: "Excluir/desativar template" })
  deleteTemplate(
    @Param("organizationId") organizationId: string,
    @Param("templateId") templateId: string,
  ) {
    return this.checklistService.deleteTemplate(templateId, organizationId);
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  @Get("entries")
  @ApiOperation({ summary: "Listar entradas de checklist" })
  listEntries(
    @Param("organizationId") organizationId: string,
    @Query() filters: ChecklistEntryFilterDto,
  ) {
    return this.checklistService.listEntries(organizationId, filters);
  }

  @Post("entries")
  @ApiOperation({ summary: "Criar e submeter checklist preenchido" })
  async createEntry(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateChecklistEntryDto,
    @Request() req: RequestWithUser,
  ) {
    const membership = await this.checklistService["prisma"].organizationMember.findFirst({
      where: { userId: req.user.userId, organizationId },
    });
    return this.checklistService.createEntry(organizationId, membership!.id, body);
  }

  @Get("entries/:entryId")
  @ApiOperation({ summary: "Buscar entrada por ID" })
  getEntry(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
  ) {
    return this.checklistService.getEntry(entryId, organizationId);
  }

  @Patch("entries/:entryId")
  @ApiOperation({ summary: "Atualizar status da entrada" })
  updateEntryStatus(
    @Param("organizationId") organizationId: string,
    @Param("entryId") entryId: string,
    @Body() body: UpdateChecklistEntryStatusDto,
  ) {
    return this.checklistService.updateEntryStatus(entryId, organizationId, body);
  }
}

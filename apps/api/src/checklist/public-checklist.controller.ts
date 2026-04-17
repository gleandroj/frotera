import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ChecklistService } from "./checklist.service";
import { CreatePublicChecklistEntryDto } from "./checklist.dto";

@ApiTags("public-checklist")
@Controller("public/checklist")
export class PublicChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get("template")
  @ApiOperation({ summary: "Buscar template público" })
  getTemplate(
    @Query("organizationId") organizationId: string,
    @Query("templateId") templateId: string,
  ) {
    return this.checklistService.getPublicTemplate(organizationId, templateId);
  }

  @Get("vehicles")
  @ApiOperation({ summary: "Listar veículos para preenchimento público" })
  listVehicles(@Query("organizationId") organizationId: string) {
    return this.checklistService.listPublicVehicles(organizationId);
  }

  @Get("drivers")
  @ApiOperation({ summary: "Listar motoristas para preenchimento público" })
  listDrivers(@Query("organizationId") organizationId: string) {
    return this.checklistService.listPublicDrivers(organizationId);
  }

  @Post("entries")
  @ApiOperation({ summary: "Criar entrada de checklist pública (sem autenticação)" })
  createEntry(@Body() body: CreatePublicChecklistEntryDto) {
    return this.checklistService.createPublicEntry(body);
  }
}

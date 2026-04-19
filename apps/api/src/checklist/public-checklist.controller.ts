import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, MaxFileSizeValidator,
  ParseFilePipe, Post, Query, Request, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request as ExpressRequest } from "express";
import { ChecklistService } from "./checklist.service";
import { CreatePublicChecklistEntryDto } from "./checklist.dto";
import { clientIpFromRequest } from "./checklist-client-ip";

@ApiTags("public-checklist")
@Controller("public/checklist")
export class PublicChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Post("upload")
  @HttpCode(201)
  @ApiOperation({ summary: "Upload público de anexo (org + template ativo)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "organizationId", "templateId"],
      properties: {
        file: { type: "string", format: "binary" },
        organizationId: { type: "string" },
        templateId: { type: "string" },
        purpose: { type: "string", enum: ["photo", "file", "signature"] },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: ChecklistService.uploadMaxBytes } }),
  )
  async uploadPublic(
    @Query("organizationId") organizationId: string,
    @Query("templateId") templateId: string,
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
    if (!organizationId?.trim() || !templateId?.trim()) {
      throw new BadRequestException("organizationId e templateId são obrigatórios.");
    }
    return this.checklistService.uploadForPublicTemplate(
      organizationId.trim(),
      templateId.trim(),
      purpose,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Get("template")
  @ApiOperation({ summary: "Buscar template público" })
  getTemplate(
    @Query("organizationId") organizationId: string,
    @Query("templateId") templateId: string,
  ) {
    return this.checklistService.getPublicTemplate(organizationId, templateId);
  }

  @Get("vehicles")
  @ApiOperation({ summary: "Listar veículos para preenchimento público (escopo do template)" })
  listVehicles(
    @Query("organizationId") organizationId: string,
    @Query("templateId") templateId: string,
  ) {
    const org = organizationId?.trim();
    const tpl = templateId?.trim();
    if (!org || !tpl) {
      throw new BadRequestException("organizationId e templateId são obrigatórios.");
    }
    return this.checklistService.listPublicVehicles(org, tpl);
  }

  @Get("drivers")
  @ApiOperation({ summary: "Listar motoristas para preenchimento público (escopo do template)" })
  listDrivers(
    @Query("organizationId") organizationId: string,
    @Query("templateId") templateId: string,
  ) {
    const org = organizationId?.trim();
    const tpl = templateId?.trim();
    if (!org || !tpl) {
      throw new BadRequestException("organizationId e templateId são obrigatórios.");
    }
    return this.checklistService.listPublicDrivers(org, tpl);
  }

  @Post("entries")
  @ApiOperation({ summary: "Criar entrada de checklist pública (sem autenticação)" })
  createEntry(
    @Body() body: CreatePublicChecklistEntryDto,
    @Request() req: ExpressRequest,
  ) {
    return this.checklistService.createPublicEntry(body, {
      clientIp: clientIpFromRequest(req),
    });
  }
}

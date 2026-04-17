import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { isBrazilUfSigla } from "@gleandroj/shared";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable()
export class FuelGeoService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOrgMember(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException("Not a member of this organization");
    }
  }

  /**
   * Estados brasileiros (dados IBGE seedados em `ibge_ufs`).
   */
  async listEstados(
    organizationId: string,
    userId: string,
  ): Promise<Array<{ sigla: string; nome: string }>> {
    await this.assertOrgMember(userId, organizationId);
    return this.prisma.ibgeUf.findMany({
      orderBy: { nome: "asc" },
      select: { sigla: true, nome: true },
    });
  }

  /**
   * Municípios por UF (dados IBGE seedados em `ibge_municipios`).
   */
  async listMunicipios(
    organizationId: string,
    userId: string,
    uf: string,
  ): Promise<Array<{ id: number; nome: string }>> {
    await this.assertOrgMember(userId, organizationId);
    const sigla = (uf ?? "").trim().toUpperCase();
    if (!isBrazilUfSigla(sigla)) {
      throw new BadRequestException("UF inválida.");
    }
    return this.prisma.ibgeMunicipio.findMany({
      where: { ufSigla: sigla },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });
  }
}

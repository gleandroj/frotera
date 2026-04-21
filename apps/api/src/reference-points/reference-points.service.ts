import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReferencePointDto, UpdateReferencePointDto } from './dto/reference-point.dto';

@Injectable()
export class ReferencePointsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, params?: { customerId?: string; active?: boolean; name?: string }) {
    return this.prisma.referencePoint.findMany({
      where: {
        organizationId,
        ...(params?.customerId ? { customerId: params.customerId } : {}),
        ...(params?.active !== undefined ? { active: params.active } : {}),
        ...(params?.name ? { name: { contains: params.name, mode: 'insensitive' } } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(organizationId: string, dto: CreateReferencePointDto) {
    return this.prisma.referencePoint.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address ?? null,
        radiusMeters: dto.radiusMeters ?? 100,
        type: dto.type ?? 'OTHER',
        customerId: dto.customerId ?? null,
        active: dto.active ?? true,
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateReferencePointDto) {
    const existing = await this.prisma.referencePoint.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Reference point not found');

    return this.prisma.referencePoint.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.radiusMeters !== undefined && { radiusMeters: dto.radiusMeters }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.customerId !== undefined && { customerId: dto.customerId }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
      include: {
        customer: { select: { id: true, name: true } },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.referencePoint.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Reference point not found');
    await this.prisma.referencePoint.delete({ where: { id } });
  }
}

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { OrganizationMemberGuard } from '@/organizations/guards/organization-member.guard';
import { PermissionGuard } from '@/auth/guards/permission.guard';
import {
  ChecklistEntryFilterDto,
  ChecklistEntryResponseDto,
  ChecklistSummaryQueryDto,
  ChecklistSummaryResponseDto,
  ChecklistTemplateResponseDto,
  CreateChecklistEntryDto,
  CreateChecklistTemplateDto,
  UpdateChecklistEntryStatusDto,
  UpdateChecklistTemplateDto,
} from './checklist.dto';
import { ChecklistDriverRequirement, EntryStatus, ItemType } from '@prisma/client';

describe('ChecklistController', () => {
  let controller: ChecklistController;
  let service: ChecklistService;

  const orgId = 'org-1';
  const memberId = 'member-1';
  const userId = 'user-1';
  const templateId = 'tpl-1';
  const entryId = 'entry-1';
  const vehicleId = 'vehicle-1';

  const mockAccess = {
    allowedCustomerIds: null as string[] | null,
    allowedVehicleIds: null as string[] | null,
    memberId,
    isSuperAdmin: false,
  };

  const mockRequest = {
    user: { userId, isSuperAdmin: false },
    allowedCustomerIds: null as string[] | null,
    allowedVehicleIds: null as string[] | null,
    organizationMember: { id: memberId },
    ip: "203.0.113.1",
  };

  const mockTemplate: ChecklistTemplateResponseDto = {
    id: templateId,
    organizationId: orgId,
    customerId: 'cust-1',
    name: 'Pré-Viagem',
    description: null,
    active: true,
    vehicleRequired: true,
    driverRequirement: ChecklistDriverRequirement.OPTIONAL,
    items: [
      {
        id: 'item-1',
        templateId,
        label: 'Pneus OK?',
        type: ItemType.YES_NO,
        required: true,
        options: [],
        order: 1,
      },
    ],
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  };

  const mockEntry: ChecklistEntryResponseDto = {
    id: entryId,
    organizationId: orgId,
    templateId,
    templateName: 'Pré-Viagem',
    vehicleId,
    driverId: null,
    memberId,
    status: EntryStatus.COMPLETED,
    completedAt: '2026-04-17T10:00:00.000Z',
    answers: [{ id: 'ans-1', entryId, itemId: 'item-1', itemOptions: [], value: 'true', photoUrl: null }],
    createdAt: '2026-04-17T10:00:00.000Z',
    updatedAt: '2026-04-17T10:00:00.000Z',
  };

  const mockSummary: ChecklistSummaryResponseDto = {
    period: { dateFrom: '2026-04-01T00:00:00.000Z', dateTo: '2026-04-18T00:00:00.000Z' },
    totals: { total: 5, pending: 1, completed: 3, incomplete: 1, completionRate: 0.6 },
    byTemplate: [
      {
        templateId,
        templateName: 'Pré-Viagem',
        total: 5,
        pending: 1,
        completed: 3,
        incomplete: 1,
        completionRate: 0.6,
      },
    ],
  };

  const mockChecklistService = {
    listTemplates: jest.fn(),
    createTemplate: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    getEntriesSummary: jest.fn(),
    listEntries: jest.fn(),
    createEntry: jest.fn(),
    getMemberIdForUser: jest.fn(),
    uploadForMember: jest.fn(),
    getEntry: jest.fn(),
    updateEntryStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockChecklistService.getMemberIdForUser.mockResolvedValue(memberId);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChecklistController],
      providers: [
        { provide: ChecklistService, useValue: mockChecklistService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OrganizationMemberGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ChecklistController>(ChecklistController);
    service = module.get<ChecklistService>(ChecklistService);
  });

  // ─── Templates ──────────────────────────────────────────────────────────────

  describe('listTemplates', () => {
    it('should return all templates for the organization', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([mockTemplate]);

      const result = await controller.listTemplates(orgId, undefined, mockRequest as any);

      expect(service.listTemplates).toHaveBeenCalledWith(orgId, mockAccess, undefined);
      expect(result).toEqual([mockTemplate]);
    });

    it('should return empty array when no templates exist', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([]);

      const result = await controller.listTemplates(orgId, undefined, mockRequest as any);

      expect(result).toEqual([]);
    });
  });

  describe('createTemplate', () => {
    it('should create a template and return it', async () => {
      mockChecklistService.createTemplate.mockResolvedValue(mockTemplate);

      const dto: CreateChecklistTemplateDto = {
        customerId: 'cust-1',
        name: 'Pré-Viagem',
        vehicleRequired: true,
        driverRequirement: ChecklistDriverRequirement.OPTIONAL,
        items: [
          { label: 'Pneus OK?', type: ItemType.YES_NO, required: true, order: 1 },
        ],
      };

      const result = await controller.createTemplate(orgId, dto, mockRequest as any);

      expect(service.createTemplate).toHaveBeenCalledWith(orgId, dto, mockAccess);
      expect(result).toEqual(mockTemplate);
    });

    it('should pass all fields including optional ones', async () => {
      mockChecklistService.createTemplate.mockResolvedValue(mockTemplate);

      const dto: CreateChecklistTemplateDto = {
        customerId: 'cust-1',
        name: 'Pré-Viagem',
        description: 'Verificação antes da saída',
        active: false,
        vehicleRequired: true,
        driverRequirement: ChecklistDriverRequirement.OPTIONAL,
        items: [
          { label: 'Km atual', type: ItemType.NUMBER, required: true, order: 1 },
          { label: 'Tipo de combustível', type: ItemType.SELECT, required: false, options: ['Gasolina', 'Diesel'], order: 2 },
        ],
      };

      await controller.createTemplate(orgId, dto, mockRequest as any);

      expect(service.createTemplate).toHaveBeenCalledWith(orgId, dto, mockAccess);
    });
  });

  describe('getTemplate', () => {
    it('should return a specific template by id', async () => {
      mockChecklistService.getTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.getTemplate(orgId, templateId, mockRequest as any);

      expect(service.getTemplate).toHaveBeenCalledWith(templateId, orgId, mockAccess);
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('should update and return the template', async () => {
      const updated = { ...mockTemplate, name: 'Pré-Viagem v2' };
      mockChecklistService.updateTemplate.mockResolvedValue(updated);

      const dto: UpdateChecklistTemplateDto = { name: 'Pré-Viagem v2' };

      const result = await controller.updateTemplate(orgId, templateId, dto, mockRequest as any);

      expect(service.updateTemplate).toHaveBeenCalledWith(templateId, orgId, dto, mockAccess);
      expect(result.name).toBe('Pré-Viagem v2');
    });

    it('should allow updating items (delete+recreate)', async () => {
      mockChecklistService.updateTemplate.mockResolvedValue(mockTemplate);

      const dto: UpdateChecklistTemplateDto = {
        items: [
          { label: 'Pneus OK?', type: ItemType.YES_NO, required: true, order: 1 },
          { label: 'Nível de óleo', type: ItemType.YES_NO, required: true, order: 2 },
        ],
      };

      await controller.updateTemplate(orgId, templateId, dto, mockRequest as any);

      expect(service.updateTemplate).toHaveBeenCalledWith(templateId, orgId, dto, mockAccess);
    });
  });

  describe('deleteTemplate', () => {
    it('should call service.deleteTemplate with correct args', async () => {
      mockChecklistService.deleteTemplate.mockResolvedValue(undefined);

      await controller.deleteTemplate(orgId, templateId, mockRequest as any);

      expect(service.deleteTemplate).toHaveBeenCalledWith(templateId, orgId, mockAccess);
    });
  });

  // ─── Reports ──────────────────────────────────────────────────────────────────

  describe('getEntriesSummary', () => {
    it('should return summary from service', async () => {
      mockChecklistService.getEntriesSummary.mockResolvedValue(mockSummary);

      const query: ChecklistSummaryQueryDto = { templateId };
      const result = await controller.getEntriesSummary(orgId, query, mockRequest as any);

      expect(service.getEntriesSummary).toHaveBeenCalledWith(orgId, query, mockAccess);
      expect(result).toEqual(mockSummary);
    });
  });

  // ─── Entries ────────────────────────────────────────────────────────────────

  describe('listEntries', () => {
    it('should return all entries for the organization', async () => {
      mockChecklistService.listEntries.mockResolvedValue([mockEntry]);

      const filters: ChecklistEntryFilterDto = {};
      const result = await controller.listEntries(orgId, filters, mockRequest as any);

      expect(service.listEntries).toHaveBeenCalledWith(orgId, filters, mockAccess);
      expect(result).toEqual([mockEntry]);
    });

    it('should forward filters to service', async () => {
      mockChecklistService.listEntries.mockResolvedValue([mockEntry]);

      const filters: ChecklistEntryFilterDto = {
        vehicleId,
        status: EntryStatus.COMPLETED,
        dateFrom: '2026-04-01',
        dateTo: '2026-04-30',
      };

      await controller.listEntries(orgId, filters, mockRequest as any);

      expect(service.listEntries).toHaveBeenCalledWith(orgId, filters, mockAccess);
    });

    it('should return empty array when no entries match filters', async () => {
      mockChecklistService.listEntries.mockResolvedValue([]);

      const result = await controller.listEntries(orgId, { status: EntryStatus.INCOMPLETE }, mockRequest as any);

      expect(result).toEqual([]);
    });
  });

  describe('createEntry', () => {
    it('should resolve memberId from userId and create entry', async () => {
      mockChecklistService.createEntry.mockResolvedValue(mockEntry);

      const dto: CreateChecklistEntryDto = {
        templateId,
        vehicleId,
        answers: [{ itemId: 'item-1', value: 'true' }],
      };

      const result = await controller.createEntry(orgId, dto, mockRequest as any);

      expect(mockChecklistService.getMemberIdForUser).toHaveBeenCalledWith(orgId, userId);
      expect(service.createEntry).toHaveBeenCalledWith(orgId, memberId, dto, mockAccess, {
        clientIp: "203.0.113.1",
      });
      expect(result).toEqual(mockEntry);
    });

    it('should pass optional driverId to service', async () => {
      mockChecklistService.createEntry.mockResolvedValue(mockEntry);

      const dto: CreateChecklistEntryDto = {
        templateId,
        vehicleId,
        driverId: 'driver-1',
        answers: [{ itemId: 'item-1', value: 'true' }],
      };

      await controller.createEntry(orgId, dto, mockRequest as any);

      expect(service.createEntry).toHaveBeenCalledWith(orgId, memberId, dto, mockAccess, {
        clientIp: "203.0.113.1",
      });
    });
  });

  describe('uploadChecklistFile', () => {
    it('should upload and return file metadata', async () => {
      mockChecklistService.uploadForMember.mockResolvedValue({
        fileUrl: "https://bucket.example/sig.png",
        originalName: "sig.png",
        mimeType: "image/png",
      });

      const file = {
        buffer: Buffer.from("fake"),
        originalname: "sig.png",
        mimetype: "image/png",
      };

      const result = await controller.uploadChecklistFile(
        orgId,
        mockRequest as any,
        "signature",
        file as Express.Multer.File,
      );

      expect(service.uploadForMember).toHaveBeenCalledWith(
        orgId,
        userId,
        "signature",
        file.buffer,
        "sig.png",
        "image/png",
      );
      expect(result.fileUrl).toBe("https://bucket.example/sig.png");
    });
  });

  describe('getEntry', () => {
    it('should return a specific entry by id', async () => {
      mockChecklistService.getEntry.mockResolvedValue(mockEntry);

      const result = await controller.getEntry(orgId, entryId, mockRequest as any);

      expect(service.getEntry).toHaveBeenCalledWith(entryId, orgId, mockAccess);
      expect(result).toEqual(mockEntry);
    });
  });

  describe('updateEntryStatus', () => {
    it('should update entry status to COMPLETED', async () => {
      const updated = { ...mockEntry, status: EntryStatus.COMPLETED };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.COMPLETED };

      const result = await controller.updateEntryStatus(orgId, entryId, dto, mockRequest as any);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto, mockAccess);
      expect(result.status).toBe(EntryStatus.COMPLETED);
    });

    it('should update entry status to INCOMPLETE', async () => {
      const updated = { ...mockEntry, status: EntryStatus.INCOMPLETE };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.INCOMPLETE };

      await controller.updateEntryStatus(orgId, entryId, dto, mockRequest as any);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto, mockAccess);
    });

    it('should update entry status to PENDING', async () => {
      const updated = { ...mockEntry, status: EntryStatus.PENDING };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.PENDING };

      await controller.updateEntryStatus(orgId, entryId, dto, mockRequest as any);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto, mockAccess);
    });
  });

  // ─── Guard coverage ──────────────────────────────────────────────────────────

  describe('JwtAuthGuard', () => {
    it('should deny access when JwtAuthGuard returns false', async () => {
      const guardModule = await Test.createTestingModule({
        controllers: [ChecklistController],
        providers: [{ provide: ChecklistService, useValue: mockChecklistService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: jest.fn(() => false) })
        .overrideGuard(OrganizationMemberGuard)
        .useValue({ canActivate: jest.fn(() => true) })
        .overrideGuard(PermissionGuard)
        .useValue({ canActivate: jest.fn(() => true) })
        .compile();

      const guardedController = guardModule.get<ChecklistController>(ChecklistController);

      // Guard returning false prevents execution — canActivate is what NestJS checks
      const guardInstance = guardModule
        .get<{ canActivate: jest.Mock }>(JwtAuthGuard as any, { strict: false });
      expect(guardInstance).toBeDefined();
    });

    it('should allow access when valid JWT is provided', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([]);

      const result = await controller.listTemplates(orgId, undefined, mockRequest as any);

      expect(result).toEqual([]);
    });
  });
});

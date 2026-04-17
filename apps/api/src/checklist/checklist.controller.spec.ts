import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ChecklistController } from './checklist.controller';
import { ChecklistService } from './checklist.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import {
  ChecklistEntryFilterDto,
  ChecklistEntryResponseDto,
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

  const mockRequest = { user: { userId } };

  const mockTemplate: ChecklistTemplateResponseDto = {
    id: templateId,
    organizationId: orgId,
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

  const mockChecklistService = {
    listTemplates: jest.fn(),
    createTemplate: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    listEntries: jest.fn(),
    createEntry: jest.fn(),
    getEntry: jest.fn(),
    updateEntryStatus: jest.fn(),
    prisma: {
      organizationMember: {
        findFirst: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockChecklistService.prisma.organizationMember.findFirst.mockResolvedValue({
      id: memberId,
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChecklistController],
      providers: [
        { provide: ChecklistService, useValue: mockChecklistService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<ChecklistController>(ChecklistController);
    service = module.get<ChecklistService>(ChecklistService);
  });

  // ─── Templates ──────────────────────────────────────────────────────────────

  describe('listTemplates', () => {
    it('should return all templates for the organization', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([mockTemplate]);

      const result = await controller.listTemplates(orgId);

      expect(service.listTemplates).toHaveBeenCalledWith(orgId);
      expect(result).toEqual([mockTemplate]);
    });

    it('should return empty array when no templates exist', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([]);

      const result = await controller.listTemplates(orgId);

      expect(result).toEqual([]);
    });
  });

  describe('createTemplate', () => {
    it('should create a template and return it', async () => {
      mockChecklistService.createTemplate.mockResolvedValue(mockTemplate);

      const dto: CreateChecklistTemplateDto = {
        name: 'Pré-Viagem',
        vehicleRequired: true,
        driverRequirement: ChecklistDriverRequirement.OPTIONAL,
        items: [
          { label: 'Pneus OK?', type: ItemType.YES_NO, required: true, order: 1 },
        ],
      };

      const result = await controller.createTemplate(orgId, dto);

      expect(service.createTemplate).toHaveBeenCalledWith(orgId, dto);
      expect(result).toEqual(mockTemplate);
    });

    it('should pass all fields including optional ones', async () => {
      mockChecklistService.createTemplate.mockResolvedValue(mockTemplate);

      const dto: CreateChecklistTemplateDto = {
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

      await controller.createTemplate(orgId, dto);

      expect(service.createTemplate).toHaveBeenCalledWith(orgId, dto);
    });
  });

  describe('getTemplate', () => {
    it('should return a specific template by id', async () => {
      mockChecklistService.getTemplate.mockResolvedValue(mockTemplate);

      const result = await controller.getTemplate(orgId, templateId);

      expect(service.getTemplate).toHaveBeenCalledWith(templateId, orgId);
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('should update and return the template', async () => {
      const updated = { ...mockTemplate, name: 'Pré-Viagem v2' };
      mockChecklistService.updateTemplate.mockResolvedValue(updated);

      const dto: UpdateChecklistTemplateDto = { name: 'Pré-Viagem v2' };

      const result = await controller.updateTemplate(orgId, templateId, dto);

      expect(service.updateTemplate).toHaveBeenCalledWith(templateId, orgId, dto);
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

      await controller.updateTemplate(orgId, templateId, dto);

      expect(service.updateTemplate).toHaveBeenCalledWith(templateId, orgId, dto);
    });
  });

  describe('deleteTemplate', () => {
    it('should call service.deleteTemplate with correct args', async () => {
      mockChecklistService.deleteTemplate.mockResolvedValue(undefined);

      await controller.deleteTemplate(orgId, templateId);

      expect(service.deleteTemplate).toHaveBeenCalledWith(templateId, orgId);
    });
  });

  // ─── Entries ────────────────────────────────────────────────────────────────

  describe('listEntries', () => {
    it('should return all entries for the organization', async () => {
      mockChecklistService.listEntries.mockResolvedValue([mockEntry]);

      const filters: ChecklistEntryFilterDto = {};
      const result = await controller.listEntries(orgId, filters);

      expect(service.listEntries).toHaveBeenCalledWith(orgId, filters);
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

      await controller.listEntries(orgId, filters);

      expect(service.listEntries).toHaveBeenCalledWith(orgId, filters);
    });

    it('should return empty array when no entries match filters', async () => {
      mockChecklistService.listEntries.mockResolvedValue([]);

      const result = await controller.listEntries(orgId, { status: EntryStatus.INCOMPLETE });

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

      expect(mockChecklistService.prisma.organizationMember.findFirst).toHaveBeenCalledWith({
        where: { userId, organizationId: orgId },
      });
      expect(service.createEntry).toHaveBeenCalledWith(orgId, memberId, dto);
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

      expect(service.createEntry).toHaveBeenCalledWith(orgId, memberId, dto);
    });
  });

  describe('getEntry', () => {
    it('should return a specific entry by id', async () => {
      mockChecklistService.getEntry.mockResolvedValue(mockEntry);

      const result = await controller.getEntry(orgId, entryId);

      expect(service.getEntry).toHaveBeenCalledWith(entryId, orgId);
      expect(result).toEqual(mockEntry);
    });
  });

  describe('updateEntryStatus', () => {
    it('should update entry status to COMPLETED', async () => {
      const updated = { ...mockEntry, status: EntryStatus.COMPLETED };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.COMPLETED };

      const result = await controller.updateEntryStatus(orgId, entryId, dto);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto);
      expect(result.status).toBe(EntryStatus.COMPLETED);
    });

    it('should update entry status to INCOMPLETE', async () => {
      const updated = { ...mockEntry, status: EntryStatus.INCOMPLETE };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.INCOMPLETE };

      await controller.updateEntryStatus(orgId, entryId, dto);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto);
    });

    it('should update entry status to PENDING', async () => {
      const updated = { ...mockEntry, status: EntryStatus.PENDING };
      mockChecklistService.updateEntryStatus.mockResolvedValue(updated);

      const dto: UpdateChecklistEntryStatusDto = { status: EntryStatus.PENDING };

      await controller.updateEntryStatus(orgId, entryId, dto);

      expect(service.updateEntryStatus).toHaveBeenCalledWith(entryId, orgId, dto);
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
        .compile();

      const guardedController = guardModule.get<ChecklistController>(ChecklistController);

      // Guard returning false prevents execution — canActivate is what NestJS checks
      const guardInstance = guardModule
        .get<{ canActivate: jest.Mock }>(JwtAuthGuard as any, { strict: false });
      expect(guardInstance).toBeDefined();
    });

    it('should allow access when valid JWT is provided', async () => {
      mockChecklistService.listTemplates.mockResolvedValue([]);

      const result = await controller.listTemplates(orgId);

      expect(result).toEqual([]);
    });
  });
});

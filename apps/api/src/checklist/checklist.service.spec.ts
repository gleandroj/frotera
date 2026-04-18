import { EntryStatus } from "@prisma/client";
import { ChecklistService } from "./checklist.service";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../utils/s3.service";

describe("ChecklistService", () => {
  let service: ChecklistService;
  let prisma: {
    checklistEntry: { groupBy: jest.Mock };
    checklistTemplate: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      checklistEntry: { groupBy: jest.fn() },
      checklistTemplate: { findMany: jest.fn() },
    };
    service = new ChecklistService(prisma as unknown as PrismaService, {} as S3Service);
  });

  describe("getEntriesSummary", () => {
    it("defaults to 30-day window when no dates provided", async () => {
      prisma.checklistEntry.groupBy
        .mockResolvedValueOnce([
          { status: EntryStatus.COMPLETED, _count: { _all: 2 } },
          { status: EntryStatus.PENDING, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { templateId: "tpl1", status: EntryStatus.COMPLETED, _count: { _all: 2 } },
          { templateId: "tpl1", status: EntryStatus.PENDING, _count: { _all: 1 } },
        ]);
      prisma.checklistTemplate.findMany.mockResolvedValue([{ id: "tpl1", name: "Pré-viagem" }]);

      const result = await service.getEntriesSummary("org1", {});

      expect(result.totals.total).toBe(3);
      expect(result.totals.completed).toBe(2);
      expect(result.totals.pending).toBe(1);
      expect(result.totals.incomplete).toBe(0);
      expect(result.totals.completionRate).toBeCloseTo(2 / 3);
      expect(result.byTemplate).toHaveLength(1);
      expect(result.byTemplate[0].templateName).toBe("Pré-viagem");
      expect(result.byTemplate[0].completionRate).toBeCloseTo(2 / 3);

      const firstGroupByCall = prisma.checklistEntry.groupBy.mock.calls[0][0];
      expect(firstGroupByCall.where.organizationId).toBe("org1");
      expect(firstGroupByCall.where.createdAt).toMatchObject({
        gte: expect.any(Date),
        lte: expect.any(Date),
      });
      const windowMs =
        firstGroupByCall.where.createdAt.lte.getTime() - firstGroupByCall.where.createdAt.gte.getTime();
      expect(windowMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
      expect(windowMs).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
    });

    it("applies templateId and vehicleId filters", async () => {
      prisma.checklistEntry.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.checklistTemplate.findMany.mockResolvedValue([]);

      await service.getEntriesSummary("org1", {
        dateFrom: "2026-01-01T00:00:00.000Z",
        dateTo: "2026-01-31T23:59:59.000Z",
        templateId: "tpl-x",
        vehicleId: "veh-y",
      });

      const where = prisma.checklistEntry.groupBy.mock.calls[0][0].where;
      expect(where).toMatchObject({
        organizationId: "org1",
        templateId: "tpl-x",
        vehicleId: "veh-y",
        createdAt: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lte: new Date("2026-01-31T23:59:59.000Z"),
        },
      });
    });

    it("returns zero completionRate when there are no entries", async () => {
      prisma.checklistEntry.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      prisma.checklistTemplate.findMany.mockResolvedValue([]);

      const result = await service.getEntriesSummary("org1", {});

      expect(result.totals.total).toBe(0);
      expect(result.totals.completionRate).toBe(0);
      expect(result.byTemplate).toEqual([]);
    });
  });
});

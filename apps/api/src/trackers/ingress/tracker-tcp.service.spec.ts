import { TrackerTcpService } from "./tracker-tcp.service";
import { tryParseGT06Packet } from "../protocols/gt06.parser";

function createService() {
  const config = {
    get: jest.fn(() => undefined),
  };
  const prisma = {
    trackerDevice: { update: jest.fn().mockResolvedValue(undefined) },
    deviceStatusLog: { create: jest.fn().mockResolvedValue(undefined) },
  };
  const trackerDevices = {
    findByImei: jest.fn().mockResolvedValue({
      id: "device-1",
      imei: "357789648756275",
      organizationId: "org-1",
      vehicle: { id: "veh-1" },
    }),
  };
  const trackerDiscovery = {
    recordUnknownLogin: jest.fn().mockResolvedValue(undefined),
  };
  const redisWriter = {
    pushPosition: jest.fn().mockResolvedValue(undefined),
    pushStatusOnly: jest.fn().mockResolvedValue(undefined),
  };
  const telemetryAlerts = {
    processPosition: jest.fn().mockResolvedValue(undefined),
    processDeviceAlarm: jest.fn().mockResolvedValue(undefined),
  };

  const service = new TrackerTcpService(
    config as never,
    prisma as never,
    trackerDevices as never,
    trackerDiscovery as never,
    redisWriter as never,
    telemetryAlerts as never,
  );

  return {
    service,
    trackerDevices,
  };
}

function makeCtx() {
  return {
    buffer: Buffer.alloc(0),
    deviceId: null,
    imei: null,
    protocol: null,
    deviceOrganizationId: null,
    deviceVehicleId: null,
    prevIgnitionOn: null,
  };
}

describe("tracker-tcp.service buffer parsing", () => {
  it("should process two valid packets in same chunk", () => {
    const { service } = createService();
    const socket = { write: jest.fn() } as any;
    const ctx = makeCtx();
    const login = Buffer.from("78780d010357789648756275001a43220d0a", "hex");
    const heartbeat = Buffer.from("78780a1306064c0002001b69b00d0a", "hex");
    ctx.buffer = Buffer.concat([login, heartbeat]);

    const handleSpy = jest
      .spyOn(service as any, "handleGT06Packet")
      .mockResolvedValue(undefined);

    (service as any).processBuffer(socket, ctx);

    expect(handleSpy).toHaveBeenCalledTimes(2);
    expect(ctx.buffer.length).toBe(0);
  });

  it("should wait for completion when packet arrives fragmented", () => {
    const { service } = createService();
    const socket = { write: jest.fn() } as any;
    const ctx = makeCtx();
    const packet = Buffer.from("78780d010357789648756275001a43220d0a", "hex");

    const handleSpy = jest
      .spyOn(service as any, "handleGT06Packet")
      .mockResolvedValue(undefined);

    ctx.buffer = packet.subarray(0, 8);
    (service as any).processBuffer(socket, ctx);
    expect(handleSpy).toHaveBeenCalledTimes(0);
    expect(ctx.buffer.length).toBe(8);

    ctx.buffer = Buffer.concat([ctx.buffer, packet.subarray(8)]);
    (service as any).processBuffer(socket, ctx);
    expect(handleSpy).toHaveBeenCalledTimes(1);
    expect(ctx.buffer.length).toBe(0);
  });

  it("should handle duplicate login from same imei without crash", async () => {
    const { service, trackerDevices } = createService();
    const socket = { write: jest.fn() } as any;
    const ctx = makeCtx();
    const parsed = tryParseGT06Packet(
      Buffer.from("78780d010357789648756275001a43220d0a", "hex"),
    );
    expect(parsed).not.toBeNull();
    if (!parsed) throw new Error("login packet parse failed");

    await (service as any).handleGT06Packet(socket, ctx, parsed);
    await (service as any).handleGT06Packet(socket, ctx, parsed);

    expect(trackerDevices.findByImei).toHaveBeenCalledTimes(2);
    expect(socket.write).toHaveBeenCalledTimes(2);
    expect(ctx.imei).toBe("357789648756275");
  });
});

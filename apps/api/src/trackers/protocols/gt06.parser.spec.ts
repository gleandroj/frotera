import {
  getImeiFromGT06Login,
  isGT06Heartbeat,
  isGT06Location,
  isGT06Login,
  parseGT06HeartbeatStatus,
  parseGT06LocationToPosition,
  tryParseGT06Packet,
} from "./gt06.parser";

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s+/g, ""), "hex");
}

function expectValidLatLng(pos: { latitude: number; longitude: number }): void {
  expect(pos.latitude).toBeGreaterThanOrEqual(-90);
  expect(pos.latitude).toBeLessThanOrEqual(90);
  expect(pos.longitude).toBeGreaterThanOrEqual(-180);
  expect(pos.longitude).toBeLessThanOrEqual(180);
}

function parsePacketOrThrow(packetHex: string) {
  const parsed = tryParseGT06Packet(hexToBuffer(packetHex));
  expect(parsed).not.toBeNull();
  if (!parsed) throw new Error("packet parse failed");
  return parsed;
}

function parsePositionOrThrow(packetHex: string) {
  const parsed = parsePacketOrThrow(packetHex);
  const position = parseGT06LocationToPosition(parsed.protocolNumber, parsed.content);
  expect(position).not.toBeNull();
  if (!position) throw new Error("position parse failed");
  return { parsed, position };
}

describe("gt06.parser protocol coverage", () => {
  it("should parse login packet (0x01)", () => {
    const pkt = parsePacketOrThrow("78780d010357789648756275001a43220d0a");
    expect(isGT06Login(pkt.protocolNumber)).toBe(true);
    expect(getImeiFromGT06Login(pkt.content)).toBe("357789648756275");
  });

  it("should parse heartbeat packet (0x13)", () => {
    const pkt = parsePacketOrThrow("78780a1306064c0002001b69b00d0a");
    expect(isGT06Heartbeat(pkt.protocolNumber)).toBe(true);
    const status = parseGT06HeartbeatStatus(pkt.content);
    expect(status).toHaveProperty("gsmSignal");
    expect(status).toHaveProperty("voltageLevel");
  });

  it("should parse location packet (0x22 NT format)", () => {
    const { parsed, position } = parsePositionOrThrow(
      "78783c220103577896487562751a04130d0d261a04130d0224c001c0b4450540109a001881090000000000000000460555284c0002018e8d020009001abae30d0a",
    );
    expect(isGT06Location(parsed.protocolNumber)).toBe(true);
    expectValidLatLng(position);
  });

  it("should return null for 0x94 packet with no valid GPS block (no crash)", () => {
    // This packet has an invalid date (day=0x57=87) — GPS block is undetectable.
    // Parser must return null gracefully, not throw or produce garbage coordinates.
    const parsed = parsePacketOrThrow(
      "79790020940a035778964875627507243202086043828955320210008604382100036a030d0a",
    );
    expect(isGT06Location(parsed.protocolNumber)).toBe(true);
    const position = parseGT06LocationToPosition(parsed.protocolNumber, parsed.content);
    expect(position).toBeNull();
  });
});

describe("gt06.parser robustness", () => {
  it("should reject invalid CRC", () => {
    const invalid = "78780d010357789648756275001a43220d0b";
    expect(tryParseGT06Packet(hexToBuffer(invalid))).toBeNull();
  });

  it("should handle location without GPS fix", () => {
    const pkt = parsePacketOrThrow(
      "78783c220103577896487562751a04130d0d261a04130d0224c001c0b4450540109a001881090000000000000000460555284c0002018e8d020009001abae30d0a",
    );
    const contentNoFix = Buffer.from(pkt.content);
    contentNoFix[6] = 0x00; // no satellites/fix hint
    contentNoFix[16] = 0x00; // course/status high byte
    contentNoFix[17] = 0x00; // course/status low byte
    const pos = parseGT06LocationToPosition(pkt.protocolNumber, contentNoFix);
    expect(pos).toBeNull();
  });
});

describe("gt06.parser location regressions", () => {
  it("parses 0x12 with year byte in binary and S/W hemisphere", () => {
    const { position } = parsePositionOrThrow(
      "78781f121a0414120c31c801c0ca9f053ff387001966000000000000000000d18efb0d0a",
    );
    expect(position.recordedAt).toBe("2026-04-14T12:12:31.000Z");
    expect(position.latitude).toBeCloseTo(-16.34, 3);
    expect(position.longitude).toBeCloseTo(-48.9318, 3);
    expect(position.heading).toBe(0x1966 & 0x03ff);
  });

  it("keeps 0x12 timestamps stable across sequential packets", () => {
    const posA = parsePositionOrThrow(
      "78781f121a0414121032c701c0bf14053ffbbc00188c000000000000000000da147e0d0a",
    ).position;
    const posB = parsePositionOrThrow(
      "78781f121a0414121132c701c0bf14053ffbbc001950000000000000000000dc63fd0d0a",
    ).position;

    expect(posA.recordedAt).toBe("2026-04-14T12:10:32.000Z");
    expect(posB.recordedAt).toBe("2026-04-14T12:11:32.000Z");
    expect(posA.latitude).toBeLessThan(0);
    expect(posA.longitude).toBeLessThan(0);
    expect(posB.latitude).toBeLessThan(0);
    expect(posB.longitude).toBeLessThan(0);
  });

  it("parses 0x1A on-demand near regular 0x12 location", () => {
    const { position } = parsePositionOrThrow(
      "78782e1a1a041412121ec801c0bf14053ffbbc005950303632393934333732323838000000000000000000000200dec3ff0d0a",
    );
    expect(position.recordedAt).toBe("2026-04-14T12:12:24.000Z");
    expect(position.latitude).toBeCloseTo(-16.3383, 3);
    expect(position.longitude).toBeCloseTo(-48.9329, 3);
  });

  it("parses 0x22 with location-source=0x02 (LBS)", () => {
    // content[0]=0x02 — same NT layout as 0x01 but location source = LBS
    const { position } = parsePositionOrThrow(
      "78783c220203577896487562751a04160414231a0416041423c901c0b6c805400f9900180009000000000000000040000027430002000000000065000604070d0a",
    );
    expect(position.recordedAt).toBe("2026-04-22T04:20:35.000Z");
    expect(position.latitude).toBeCloseTo(-16.337, 2);
    expect(position.longitude).toBeCloseTo(-48.936, 2);
  });

  it("parses 0x22 with location-source=0x03 (GPS+LBS)", () => {
    // content[0]=0x03 — same NT layout but location source = GPS+LBS
    const { position } = parsePositionOrThrow(
      "78783c220303577896487562751a04160417201a041604162dc001c0b6c805400f990018a009000000000000000046054e28490002000000000065000feb680d0a",
    );
    expect(position.recordedAt).toBe("2026-04-22T04:22:45.000Z");
    expect(position.latitude).toBeCloseTo(-16.337, 2);
    expect(position.longitude).toBeCloseTo(-48.936, 2);
  });
});

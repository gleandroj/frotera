import { parseGT06LocationToPosition, tryParseGT06Packet } from "./gt06.parser";

function parseFromPacketHex(packetHex: string) {
  const parsed = tryParseGT06Packet(Buffer.from(packetHex, "hex"));
  expect(parsed).not.toBeNull();
  if (!parsed) {
    throw new Error("packet parse failed");
  }
  const position = parseGT06LocationToPosition(
    parsed.protocolNumber,
    parsed.content,
  );
  expect(position).not.toBeNull();
  if (!position) {
    throw new Error("position parse failed");
  }
  return position;
}

describe("gt06.parser location regressions", () => {
  it("parses 0x12 with year byte in binary and S/W hemisphere", () => {
    const position = parseFromPacketHex(
      "78781f121a0414120c31c801c0ca9f053ff387001966000000000000000000d18efb0d0a",
    );
    expect(position.recordedAt).toBe("2026-04-14T12:12:31.000Z");
    expect(position.latitude).toBeCloseTo(-16.34, 3);
    expect(position.longitude).toBeCloseTo(-48.9318, 3);
    expect(position.heading).toBe(0x1966 & 0x03ff);
  });

  it("keeps 0x12 timestamps stable across sequential packets", () => {
    const packetA =
      "78781f121a0414121032c701c0bf14053ffbbc00188c000000000000000000da147e0d0a";
    const packetB =
      "78781f121a0414121132c701c0bf14053ffbbc001950000000000000000000dc63fd0d0a";
    const posA = parseFromPacketHex(packetA);
    const posB = parseFromPacketHex(packetB);

    expect(posA.recordedAt).toBe("2026-04-14T12:10:32.000Z");
    expect(posB.recordedAt).toBe("2026-04-14T12:11:32.000Z");
    expect(posA.latitude).toBeLessThan(0);
    expect(posA.longitude).toBeLessThan(0);
    expect(posB.latitude).toBeLessThan(0);
    expect(posB.longitude).toBeLessThan(0);
  });

  it("parses 0x1A on-demand near regular 0x12 location", () => {
    const position = parseFromPacketHex(
      "78782e1a1a041412121ec801c0bf14053ffbbc005950303632393934333732323838000000000000000000000200dec3ff0d0a",
    );
    expect(position.recordedAt).toBe("2026-04-14T12:12:24.000Z");
    expect(position.latitude).toBeCloseTo(-16.3383, 3);
    expect(position.longitude).toBeCloseTo(-48.9329, 3);
  });
});

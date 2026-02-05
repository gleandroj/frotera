/**
 * NT20 (x22-NT20) X3Tech binary protocol parser.
 * Stub: full binary format to be filled from Wialon/flespi or device spec.
 * Used by dispatcher after GT06 fails (auto-detect).
 */

import { NormalizedPosition } from "../dto/index";

/** Placeholder: NT20 may use different start bytes; not GT06 0x78 0x78. */
export function isNT20Packet(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return false;
}

export function tryParseNT20Packet(
  _buffer: Buffer,
): {
  protocolNumber: number;
  content: Buffer;
  serialNumber: number;
  fullLength: number;
} | null {
  return null;
}

export function getImeiFromNT20Login(_content: Buffer): string | null {
  return null;
}

export function getPositionFromNT20Location(
  _content: Buffer,
): NormalizedPosition | null {
  return null;
}

export function buildNT20LoginAck(_serialNumber: number): Buffer | null {
  return null;
}

export function buildNT20HeartbeatAck(_serialNumber: number): Buffer | null {
  return null;
}

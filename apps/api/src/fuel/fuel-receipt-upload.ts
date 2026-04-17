import { BadRequestException } from "@nestjs/common";

/** Comprovante de abastecimento: imagens ou PDF. */
export const FUEL_RECEIPT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

const FUEL_RECEIPT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function assertFuelReceiptMime(mimetype: string): void {
  const m = mimetype.toLowerCase().split(";")[0].trim();
  if (!m || !FUEL_RECEIPT_MIMES.has(m)) {
    throw new BadRequestException(
      "Para o comprovante, use JPEG, PNG, WebP ou PDF.",
    );
  }
}

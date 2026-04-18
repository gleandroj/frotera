import { BadRequestException } from "@nestjs/common";

/** Anexos de ocorrência: imagens ou PDF (mesmo perfil do comprovante de abastecimento). */
export const INCIDENT_ATTACHMENT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

const INCIDENT_ATTACHMENT_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function assertIncidentAttachmentMime(mimetype: string): void {
  const m = mimetype.toLowerCase().split(";")[0].trim();
  if (!m || !INCIDENT_ATTACHMENT_MIMES.has(m)) {
    throw new BadRequestException(
      "Para o anexo, use JPEG, PNG, WebP ou PDF.",
    );
  }
}

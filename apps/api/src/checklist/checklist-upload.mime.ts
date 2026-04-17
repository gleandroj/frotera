import { BadRequestException } from "@nestjs/common";

/** Max size for checklist attachments (photos, generic files, signature PNG). */
export const CHECKLIST_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export type ChecklistUploadPurpose = "photo" | "file" | "signature";

const PHOTO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Signature strokes exported as PNG from canvas. */
const SIGNATURE_MIMES = new Set(["image/png"]);

/**
 * Blocked MIME types for generic checklist files (executables, HTML, scripts).
 * Policy: default-allow for non-blocked types so “qualquer arquivo” is practical;
 * size limit still applies at controller level.
 */
const FILE_MIME_BLOCKLIST = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/javascript",
  "application/x-javascript",
  "text/javascript",
  "application/wasm",
  "application/x-msdownload",
  "application/x-dosexec",
  "application/x-msi",
  "application/vnd.microsoft.portable-executable",
  "application/x-executable",
  "application/x-msdos-program",
  "application/java-archive",
  "application/x-sh",
  "application/x-csh",
]);

function normalizeMime(mimetype: string): string {
  return mimetype.toLowerCase().split(";")[0].trim();
}

export function assertChecklistUploadMime(purpose: ChecklistUploadPurpose, mimetype: string): void {
  const m = normalizeMime(mimetype);
  if (!m) {
    throw new BadRequestException("Tipo de arquivo (MIME) inválido.");
  }

  if (purpose === "photo") {
    if (!PHOTO_MIMES.has(m)) {
      throw new BadRequestException(
        "Para foto, use JPEG, PNG, WebP ou GIF.",
      );
    }
    return;
  }

  if (purpose === "signature") {
    if (!SIGNATURE_MIMES.has(m)) {
      throw new BadRequestException("Assinatura manuscrita deve ser enviada como PNG.");
    }
    return;
  }

  // purpose === "file"
  if (FILE_MIME_BLOCKLIST.has(m)) {
    throw new BadRequestException("Este tipo de arquivo não é permitido no checklist.");
  }
  if (m.startsWith("application/x-ms")) {
    throw new BadRequestException("Este tipo de arquivo não é permitido no checklist.");
  }
}

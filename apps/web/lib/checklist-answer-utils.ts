export type ChecklistAttachmentAnswer = {
  photoUrl: string;
  originalName?: string;
  mimeType?: string;
};

export function stringifyChecklistAttachment(a: ChecklistAttachmentAnswer): string {
  return JSON.stringify({
    photoUrl: a.photoUrl,
    originalName: a.originalName,
    mimeType: a.mimeType,
  });
}

export function parseChecklistAttachment(
  raw: string | undefined | null,
): ChecklistAttachmentAnswer | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as ChecklistAttachmentAnswer;
    if (j && typeof j.photoUrl === "string" && j.photoUrl.length > 0) return j;
  } catch {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return { photoUrl: raw };
    }
  }
  return null;
}

export function getChecklistAttachmentPhotoUrl(
  raw: string | undefined | null,
): string | null {
  return parseChecklistAttachment(raw)?.photoUrl ?? null;
}

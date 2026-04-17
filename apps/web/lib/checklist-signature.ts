export const CHECKLIST_SIGNATURE_VERSION = 1 as const;

export type ChecklistSignatureClientMeta = {
  userAgent: string;
  language: string;
  timeZone: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
};

export type ChecklistSignaturePayload = {
  version: typeof CHECKLIST_SIGNATURE_VERSION;
  mode: "text" | "draw";
  text?: string;
  drawImageUrl?: string;
  client: ChecklistSignatureClientMeta;
  capturedAt: string;
  server?: { ip: string | null; recordedAt: string };
};

export function collectSignatureClientMeta(): ChecklistSignatureClientMeta {
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      language: "",
      timeZone: "",
      platform: "",
      screenWidth: 0,
      screenHeight: 0,
    };
  }
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    platform: navigator.platform,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
  };
}

export function parseChecklistSignaturePayload(
  raw: string | undefined | null,
): ChecklistSignaturePayload | null {
  if (!raw?.trim() || !raw.trim().startsWith("{")) return null;
  try {
    const o = JSON.parse(raw) as ChecklistSignaturePayload;
    if (o && typeof o === "object" && o.version === CHECKLIST_SIGNATURE_VERSION) {
      return o;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function stringifySignaturePayload(payload: Omit<ChecklistSignaturePayload, "server">): string {
  return JSON.stringify(payload);
}

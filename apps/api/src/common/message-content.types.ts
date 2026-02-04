import { Prisma } from "@prisma/client";

// Type definitions for message content based on message type
export type TextMessageContent = Prisma.JsonObject & {
  text: string;
};

export type DocumentMessageContent = Prisma.JsonObject & {
  text?: string;
  url: string;
};

export type AudioMessageContent = Prisma.JsonObject & {
  text?: string;
  transcription?: string;
};

export type ImageMessageContent = Prisma.JsonObject & {
  text?: string;
  url: string;
};

// Type guards for message content
export function isTextMessageContent(content: Prisma.JsonValue): content is TextMessageContent {
  return (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content) &&
    "text" in content &&
    typeof (content as Record<string, unknown>).text === "string"
  );
}

export function isDocumentMessageContent(content: Prisma.JsonValue): content is DocumentMessageContent {
  return (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content) &&
    "url" in content &&
    typeof (content as Record<string, unknown>).url === "string"
  );
}

export function isAudioMessageContent(content: Prisma.JsonValue): content is AudioMessageContent {
  return (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content)
  );
}

export function isImageMessageContent(content: Prisma.JsonValue): content is ImageMessageContent {
  return (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content) &&
    "url" in content &&
    typeof (content as Record<string, unknown>).url === "string"
  );
}

type ApiErrorBody = {
  message?: string;
  errorCode?: string;
};

/**
 * Resolves a user-facing error string from an API error (axios-style) response.
 * Prefers a non-empty `message`, then i18n under `errors.api.<errorCode>`, then `fallbackKey`.
 */
export function getApiErrorMessage(
  err: unknown,
  t: (key: string) => string,
  fallbackKey = "common.error",
): string {
  const data = (err as { response?: { data?: ApiErrorBody } })?.response?.data;
  const rawMsg = typeof data?.message === "string" ? data.message.trim() : "";
  if (rawMsg) return rawMsg;
  const code = typeof data?.errorCode === "string" ? data.errorCode.trim() : "";
  if (code) {
    const key = `errors.api.${code}`;
    const localized = t(key);
    if (localized !== key) return localized;
  }
  return t(fallbackKey);
}

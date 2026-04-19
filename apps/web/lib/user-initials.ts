/**
 * Two-letter avatar initials from display name, otherwise from the email local part.
 */
export function getUserInitials(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
    if (parts.length >= 2) {
      const first = parts[0][0];
      const last = parts[parts.length - 1][0];
      return `${first}${last}`.toUpperCase();
    }
    const word = parts[0];
    if (word.length >= 2) return word.slice(0, 2).toUpperCase();
    return word[0].toUpperCase();
  }

  if (!email?.trim()) return "?";

  const local = email.split("@")[0] ?? email;
  const segments = local.split(/[._-]+/).filter((s) => s.length > 0);
  if (segments.length >= 2) {
    return `${segments[0][0]}${segments[1][0]}`.toUpperCase();
  }

  const single = segments[0] ?? local;
  if (single.length >= 2) return single.slice(0, 2).toUpperCase();
  return single[0].toUpperCase();
}

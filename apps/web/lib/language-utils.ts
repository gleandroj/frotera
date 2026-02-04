import { cookieName } from "@/i18n/settings";

/**
 * Set language preference using the Next.js API endpoint
 */
export async function setLanguageCookie(language: string): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await fetch("/api/language", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ language }),
    });
  } catch (error) {
    console.error("Error setting language via API:", error);

    // Fallback: set cookie manually if API fails
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // 1 year

    document.cookie = `${cookieName}=${language}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`;
  }
}

/**
 * Get language preference from cookie
 */
export function getLanguageCookie(): string | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie.split(";");
  const languageCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${cookieName}=`)
  );

  if (languageCookie) {
    return languageCookie.split("=")[1].trim();
  }

  return null;
}

export function getHtmlLang(): string | null {
  if (typeof window === "undefined") return null;

  return document.documentElement.lang;
}

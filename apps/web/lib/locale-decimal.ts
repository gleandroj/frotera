/** Map short i18n codes to BCP 47 locales for Intl formatting. */
export function i18nLanguageToIntlLocale(lang: string | undefined): string {
  const base = lang?.split("-")[0]?.toLowerCase();
  switch (base) {
    case "pt":
      return "pt-BR";
    case "en":
      return "en-US";
    case "es":
      return "es-419";
    default:
      return "pt-BR";
  }
}

export function getLocaleNumberSeparators(locale: string): {
  group: string | undefined;
  decimal: string;
} {
  const parts = new Intl.NumberFormat(locale).formatToParts(1000000.99);
  return {
    group: parts.find((p) => p.type === "group")?.value,
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
  };
}

/**
 * Parse decimal text respecting locale separators and common mixed input
 * (e.g. 1.234,56 vs 1,234.56) using last-separator-wins when both appear.
 * Allows a single "wrong" separator when it clearly looks like a decimal
 * (e.g. "6.559" with pt-BR where the formal decimal is ",").
 */
export function parseLocalizedDecimalInput(raw: string, locale: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let s = "";
  for (const ch of trimmed) {
    if (/\d/.test(ch) || ch === "-" || ch === "," || ch === ".") {
      s += ch;
    }
  }
  if (!s || s === "-") return null;

  const { decimal } = getLocaleNumberSeparators(locale);
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? s.replace(/\./g, "").replace(",", ".")
      : s.replace(/,/g, "");
  } else if (lastComma !== -1 && lastDot === -1) {
    if (decimal === ",") {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d+,\d+$/.test(s)) {
      normalized = s.replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (lastDot !== -1 && lastComma === -1) {
    if (decimal === ".") {
      normalized = s.replace(/,/g, "");
    } else if (/^\d+\.\d+$/.test(s)) {
      normalized = s;
    } else {
      normalized = s.replace(/\./g, "").replace(",", ".");
    }
  } else {
    normalized = s;
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatLocaleDecimal(
  value: number,
  locale: string,
  opts?: { minFractionDigits?: number; maxFractionDigits?: number }
): string {
  const v = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    useGrouping: true,
    minimumFractionDigits: opts?.minFractionDigits ?? 0,
    maximumFractionDigits: opts?.maxFractionDigits ?? 3,
  }).format(v);
}

export function formatLocaleCurrency(
  value: number,
  locale: string,
  currency: string,
  opts?: { minFractionDigits?: number; maxFractionDigits?: number }
): string {
  const v = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: opts?.minFractionDigits ?? 2,
    maximumFractionDigits: opts?.maxFractionDigits ?? 2,
  }).format(v);
}

export function getCurrencyNarrowSymbol(locale: string, currency: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? currency;
}

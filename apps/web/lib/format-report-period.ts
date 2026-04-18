/** Parse API period keys (YYYY-MM-DD, YYYY-MM, YYYY) as local calendar dates. */

function localDateFromYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.slice(0, 10));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function localDateFromYm(ym: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const dt = new Date(y, mo, 1);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function localDateFromYear(yStr: string): Date | null {
  const m = /^(\d{4})$/.exec(yStr.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const dt = new Date(y, 0, 1);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/**
 * Human-readable label for fuel report period keys and ISO day strings.
 * Avoids raw ISO (YYYY-MM-DD) on chart axes and tooltips.
 */
export function formatReportPeriodKey(key: string, locale: string): string {
  const raw = key.trim();
  const ymdHead = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymdHead)) {
    const dt = localDateFromYmd(ymdHead);
    if (!dt) return key;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const dt = localDateFromYm(raw);
    if (!dt) return key;
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      year: "numeric",
    }).format(dt);
  }
  if (/^\d{4}$/.test(raw)) {
    const dt = localDateFromYear(raw);
    if (!dt) return key;
    return new Intl.DateTimeFormat(locale, { year: "numeric" }).format(dt);
  }
  return key;
}

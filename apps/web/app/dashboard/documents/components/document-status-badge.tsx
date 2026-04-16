'use client';

import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/lib/frontend/api-client';
import { useTranslation } from '@/lib/hooks/use-translation';

const CONFIG: Record<DocumentStatus, { className: string }> = {
  VALID: {
    className:
      'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700',
  },
  EXPIRING: {
    className:
      'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 dark:border-yellow-700',
  },
  EXPIRED: {
    className:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700',
  },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation();
  const cfg = CONFIG[status];
  const label = t(`documents.status.${status.toLowerCase()}`);

  return (
    <Badge variant="outline" className={cfg.className}>
      {label}
    </Badge>
  );
}

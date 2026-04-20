'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/useTranslation';
import { checklistAPI, type ChecklistEntry } from '@/lib/frontend/api-client';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface VehicleChecklistsTabProps {
  vehicleId: string;
  organizationId: string;
  customerId?: string | null;
}

export function VehicleChecklistsTab({ vehicleId, organizationId, customerId }: VehicleChecklistsTabProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await checklistAPI.listEntries(organizationId, {
          vehicleId,
          ...(customerId ? { customerId } : {}),
        });
        if (!cancelled) setEntries(res.data);
      } catch {
        if (!cancelled) toast.error(t('common.error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, vehicleId, customerId]);

  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' => {
    if (status === 'COMPLETED') return 'default';
    if (status === 'INCOMPLETE') return 'destructive';
    return 'secondary';
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  if (entries.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{t('vehicles.tabs.emptyChecklists')}</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('checklist.fields.template')}</TableHead>
            <TableHead>{t('checklist.fields.driver')}</TableHead>
            <TableHead>{t('checklist.fields.status')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/checklist/entries/${entry.id}`} className="hover:underline">
                  {entry.templateName ?? entry.templateId}
                </Link>
              </TableCell>
              <TableCell>{entry.driverName ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(entry.status)}>
                  {t(`checklist.status.${entry.status}`)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

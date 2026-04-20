'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { usePermissions, Module, Action } from '@/lib/hooks/use-permissions';
import { incidentsAPI, type Incident } from '@/lib/frontend/api-client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { getIncidentColumns } from '@/app/dashboard/incidents/columns';

interface VehicleIncidentsTabProps {
  vehicleId: string;
  organizationId: string;
  customerId?: string | null;
}

export function VehicleIncidentsTab({ vehicleId, organizationId, customerId }: VehicleIncidentsTabProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canDelete = can(Module.INCIDENTS, Action.DELETE);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await incidentsAPI.list(organizationId, {
          vehicleId,
          ...(customerId ? { customerId } : {}),
        });
        if (!cancelled) setIncidents(res.data.incidents);
      } catch {
        if (!cancelled) toast.error(t('common.error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, vehicleId, customerId]);

  const columns = getIncidentColumns(t, {
    onDelete: () => {},
    canDelete,
    formatCost: (v) => v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—',
    formatDate: (iso) => new Date(iso).toLocaleDateString('pt-BR'),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  if (incidents.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{t('vehicles.tabs.emptyIncidents')}</div>;
  }

  return <DataTable columns={columns} data={incidents} />;
}

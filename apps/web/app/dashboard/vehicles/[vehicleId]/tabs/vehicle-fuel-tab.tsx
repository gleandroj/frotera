'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/useTranslation';
import { usePermissions, Module, Action } from '@/lib/hooks/use-permissions';
import { fuelAPI, type FuelLog } from '@/lib/frontend/api-client';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/data-table';
import { getFuelColumns } from '@/app/dashboard/fuel/components/fuel-columns';

interface VehicleFuelTabProps {
  vehicleId: string;
  organizationId: string;
  customerId?: string | null;
}

export function VehicleFuelTab({ vehicleId, organizationId, customerId }: VehicleFuelTabProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canEdit = can(Module.FUEL, Action.EDIT);
  const canDelete = can(Module.FUEL, Action.DELETE);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await fuelAPI.list(organizationId, {
          vehicleId,
          ...(customerId ? { customerId } : {}),
        });
        if (!cancelled) setLogs(res.data);
      } catch {
        if (!cancelled) toast.error(t('common.error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, vehicleId, customerId]);

  const columns = getFuelColumns({
    onEdit: () => {},
    onDelete: () => {},
    t,
    intlLocale: 'pt-BR',
    canEdit,
    canDelete,
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  if (logs.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{t('vehicles.tabs.emptyFuel')}</div>;
  }

  return <DataTable columns={columns} data={logs} />;
}

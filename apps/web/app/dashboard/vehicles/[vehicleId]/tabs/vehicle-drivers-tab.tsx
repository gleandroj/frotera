'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/useTranslation';
import { driversAPI, type Driver } from '@/lib/frontend/api-client';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface VehicleDriversTabProps {
  vehicleId: string;
  organizationId: string;
  customerId?: string | null;
}

export function VehicleDriversTab({ vehicleId, organizationId, customerId }: VehicleDriversTabProps) {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await driversAPI.list(organizationId, {
          vehicleId,
          ...(customerId ? { customerId } : {}),
        });
        if (!cancelled) setDrivers(res.data.drivers);
      } catch {
        if (!cancelled) toast.error(t('common.error'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [organizationId, vehicleId, customerId]);

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">{t('common.loading')}</div>;

  if (drivers.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{t('vehicles.tabs.emptyDrivers')}</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('drivers.fields.cpf')}</TableHead>
            <TableHead>{t('drivers.fields.phone')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drivers.map((driver) => (
            <TableRow key={driver.id}>
              <TableCell className="font-medium">
                <Link href={`/dashboard/drivers/${driver.id}`} className="hover:underline">
                  {driver.name}
                </Link>
              </TableCell>
              <TableCell>{driver.cpf ?? '—'}</TableCell>
              <TableCell>{driver.phone ?? '—'}</TableCell>
              <TableCell>
                <Badge variant={driver.active ? 'default' : 'secondary'}>
                  {driver.active ? t('common.active') : t('common.inactive')}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

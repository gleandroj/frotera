'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/i18n/useTranslation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { VehicleDocumentsTab } from '../tabs/vehicle-documents-tab';

export default function VehicleDocumentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.vehicleId as string;
  const { currentOrganization, selectedCustomerId } = useAuth();
  const orgId = currentOrganization?.id;

  if (!orgId) return <div>{t('common.loading')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/dashboard/vehicles/${vehicleId}`)}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">{t('documents.title')}</h1>
      </div>
      <VehicleDocumentsTab
        vehicleId={vehicleId}
        organizationId={orgId}
        customerId={selectedCustomerId}
      />
    </div>
  );
}

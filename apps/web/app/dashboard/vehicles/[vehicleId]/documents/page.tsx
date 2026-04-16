'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/i18n/useTranslation';
import {
  documentsAPI,
  vehiclesAPI,
  type VehicleDocument,
  type Vehicle,
} from '@/lib/frontend/api-client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, ExternalLink, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentFormDialog } from '../../../documents/components/document-form-dialog';
import { DocumentStatusBadge } from '../../../documents/components/document-status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function VehicleDocumentsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const vehicleId = params.vehicleId as string;
  const { currentOrganization } = useAuth();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VehicleDocument | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<VehicleDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const orgId = currentOrganization?.id;

  const loadData = async () => {
    if (!orgId || !vehicleId) return;

    try {
      setIsLoading(true);
      // Load vehicle info
      const vehicleRes = await vehiclesAPI.get(orgId, vehicleId);
      setVehicle(vehicleRes.data);

      // Load documents for this vehicle
      const docsRes = await documentsAPI.list(orgId, { vehicleId });
      setDocuments(docsRes.data.documents);
    } catch (error) {
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId, vehicleId]);

  const handleDeleteClick = (doc: VehicleDocument) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!documentToDelete || !orgId) return;

    try {
      setIsDeleting(true);
      await documentsAPI.remove(orgId, documentToDelete.id);
      toast.success(t('documents.toastDeleted'));
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
      await loadData();
    } catch (error) {
      toast.error(t('documents.toastError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (doc: VehicleDocument) => {
    setSelectedDocument(doc);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedDocument(null);
  };

  const handleFormSuccess = () => {
    loadData();
    handleFormClose();
  };

  const handleViewFile = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  if (!orgId) {
    return <div>{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/dashboard/vehicles/${vehicleId}`)}
            className="h-10 w-10"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{t('documents.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {vehicle ? `${vehicle.plate || vehicle.name || 'Veículo'}` : t('common.loading')}
            </p>
          </div>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('documents.createDocument')}
        </Button>
      </div>

      {/* Documents Table */}
      {isLoading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('documents.noDocuments')}</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documents.fields.status')}</TableHead>
                <TableHead>{t('documents.fields.title')}</TableHead>
                <TableHead>{t('documents.fields.type')}</TableHead>
                <TableHead>{t('documents.fields.expiryDate')}</TableHead>
                <TableHead>{t('documents.fields.daysUntilExpiry')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <DocumentStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>{t(`documents.type.${doc.type}`)}</TableCell>
                  <TableCell>
                    {doc.expiryDate
                      ? new Date(doc.expiryDate).toLocaleDateString('pt-BR')
                      : t('documents.noExpiry')}
                  </TableCell>
                  <TableCell>
                    {doc.daysUntilExpiry !== null
                      ? `${doc.daysUntilExpiry} ${t('common.days')}`
                      : t('documents.noExpiry')}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          aria-label={t('documents.openActionsMenu')}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEditClick(doc)}>
                          {t('common.edit')}
                        </DropdownMenuItem>
                        {doc.fileUrl && (
                          <DropdownMenuItem onClick={() => handleViewFile(doc.fileUrl!)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t('documents.viewFile')}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteClick(doc)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {t('common.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form Dialog */}
      <DocumentFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        document={selectedDocument}
        organizationId={orgId}
        defaultVehicleId={vehicleId}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{t('documents.confirmDelete.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('documents.confirmDelete.description')}</AlertDialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('common.deleting') : t('common.delete')}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

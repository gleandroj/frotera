'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/hooks/use-auth';
import { useTranslation } from '@/i18n/useTranslation';
import { usePermissions, Module, Action } from '@/lib/hooks/use-permissions';
import {
  documentsAPI,
  vehiclesAPI,
  type VehicleDocument,
  type DocumentType,
  type DocumentStatus,
  type Vehicle,
} from '@/lib/frontend/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
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
import { MoreHorizontal, Plus, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentFormDialog } from './components/document-form-dialog';
import { DocumentStatusBadge } from './components/document-status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const FILTER_ALL = '__all__';

const DOCUMENT_TYPES: DocumentType[] = [
  'CRLV',
  'INSURANCE',
  'LICENSE',
  'INSPECTION',
  'OTHER',
];

const DOCUMENT_STATUSES: DocumentStatus[] = ['VALID', 'EXPIRING', 'EXPIRED'];

function documentVehicleLabel(doc: VehicleDocument, notAvailable: string): string {
  const name = doc.vehicleName?.trim();
  const plate = doc.vehiclePlate?.trim();
  if (name && plate) return `${name} · ${plate}`;
  if (name) return name;
  if (plate) return plate;
  return notAvailable;
}

function vehicleSelectLabel(v: Vehicle, notAvailable: string): string {
  const name = v.name?.trim();
  const plate = v.plate?.trim();
  if (name && plate) return `${name} · ${plate}`;
  if (name) return name;
  if (plate) return plate;
  return notAvailable;
}

/** Data local (yyyy-MM-dd) a partir do ISO do vencimento, para cruzar com os DatePickers. */
function expiryLocalYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canCreateDocument = can(Module.DOCUMENTS, Action.CREATE);
  const canEditDocument = can(Module.DOCUMENTS, Action.EDIT);
  const canDeleteDocument = can(Module.DOCUMENTS, Action.DELETE);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<VehicleDocument | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<VehicleDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterVehicleId, setFilterVehicleId] = useState<string>(FILTER_ALL);
  const [filterType, setFilterType] = useState<string>(FILTER_ALL);
  const [filterStatus, setFilterStatus] = useState<string>(FILTER_ALL);
  const [filterExpiryFrom, setFilterExpiryFrom] = useState('');
  const [filterExpiryTo, setFilterExpiryTo] = useState('');

  const orgId = currentOrganization?.id;

  const loadDocuments = useCallback(async () => {
    if (!orgId) return;

    try {
      setIsLoading(true);
      const response = await documentsAPI.list(orgId, {
        ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
      });
      setDocuments(response.data.documents);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [orgId, t, selectedCustomerId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!orgId) return;
    vehiclesAPI
      .list(orgId, selectedCustomerId ? { customerId: selectedCustomerId } : undefined)
      .then((r) => setVehicles(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVehicles([]));
  }, [orgId, selectedCustomerId]);

  const filteredDocuments = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const hasExpiryRange = Boolean(filterExpiryFrom || filterExpiryTo);

    return documents.filter((doc) => {
      if (filterVehicleId !== FILTER_ALL && doc.vehicleId !== filterVehicleId) return false;
      if (filterType !== FILTER_ALL && doc.type !== filterType) return false;
      if (filterStatus !== FILTER_ALL && doc.status !== filterStatus) return false;

      const expYmd = expiryLocalYmd(doc.expiryDate);
      if (hasExpiryRange) {
        if (!expYmd) return false;
        if (filterExpiryFrom && expYmd < filterExpiryFrom) return false;
        if (filterExpiryTo && expYmd > filterExpiryTo) return false;
      }

      if (q) {
        const typeLabel = t(`documents.type.${doc.type}`).toLowerCase();
        const hay = [
          doc.title,
          doc.vehicleName,
          doc.vehiclePlate,
          doc.customerName,
          typeLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [
    documents,
    filterSearch,
    filterVehicleId,
    filterType,
    filterStatus,
    filterExpiryFrom,
    filterExpiryTo,
    t,
  ]);

  const hasActiveFilters =
    filterSearch.trim() !== '' ||
    filterVehicleId !== FILTER_ALL ||
    filterType !== FILTER_ALL ||
    filterStatus !== FILTER_ALL ||
    filterExpiryFrom !== '' ||
    filterExpiryTo !== '';

  const clearFilters = () => {
    setFilterSearch('');
    setFilterVehicleId(FILTER_ALL);
    setFilterType(FILTER_ALL);
    setFilterStatus(FILTER_ALL);
    setFilterExpiryFrom('');
    setFilterExpiryTo('');
  };

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
      await loadDocuments();
    } catch {
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
    loadDocuments();
    handleFormClose();
  };

  const handleViewFile = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  if (!orgId) {
    return <div>{t('common.loading')}</div>;
  }

  const emptyMessage =
    documents.length === 0 ? t('documents.noDocuments') : t('documents.noResults');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('documents.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('documents.listDescription')}</p>
        </div>
        {canCreateDocument && (
          <Button onClick={() => setFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t('documents.createDocument')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-2 sm:col-span-2 xl:col-span-2">
            <Label htmlFor="documents-search">{t('documents.filters.search')}</Label>
            <Input
              id="documents-search"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder={t('documents.filters.searchPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('documents.fields.vehicle')}</Label>
            <Select value={filterVehicleId} onValueChange={setFilterVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder={t('documents.filters.allVehicles')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t('documents.filters.allVehicles')}</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {vehicleSelectLabel(v, t('common.notAvailable'))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('documents.fields.type')}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder={t('documents.filters.allTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t('documents.filters.allTypes')}</SelectItem>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {t(`documents.type.${dt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('documents.fields.status')}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('documents.filters.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>{t('documents.filters.allStatuses')}</SelectItem>
                {DOCUMENT_STATUSES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {t(`documents.status.${st.toLowerCase() as 'valid' | 'expiring' | 'expired'}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="documents-expiry-from">{t('documents.filters.expiryFrom')}</Label>
            <DatePicker
              id="documents-expiry-from"
              value={filterExpiryFrom}
              onChange={setFilterExpiryFrom}
              allowClear
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="documents-expiry-to">{t('documents.filters.expiryTo')}</Label>
            <DatePicker
              id="documents-expiry-to"
              value={filterExpiryTo}
              onChange={setFilterExpiryTo}
              allowClear
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              {t('documents.filters.clear')}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : filteredDocuments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{emptyMessage}</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('documents.fields.status')}</TableHead>
                <TableHead>{t('documents.fields.title')}</TableHead>
                <TableHead>{t('documents.fields.type')}</TableHead>
                <TableHead>{t('documents.fields.vehicle')}</TableHead>
                <TableHead>{t('documents.fields.customer')}</TableHead>
                <TableHead>{t('documents.fields.expiryDate')}</TableHead>
                <TableHead>{t('documents.fields.daysUntilExpiry')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <DocumentStatusBadge status={doc.status} />
                  </TableCell>
                  <TableCell className="font-medium">{doc.title}</TableCell>
                  <TableCell>{t(`documents.type.${doc.type}`)}</TableCell>
                  <TableCell>{documentVehicleLabel(doc, t('common.notAvailable'))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {doc.customerName?.trim() || '—'}
                  </TableCell>
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
                        {canEditDocument && (
                          <DropdownMenuItem onClick={() => handleEditClick(doc)}>
                            {t('common.edit')}
                          </DropdownMenuItem>
                        )}
                        {doc.fileUrl && (
                          <DropdownMenuItem onClick={() => handleViewFile(doc.fileUrl!)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t('documents.viewFile')}
                          </DropdownMenuItem>
                        )}
                        {canDeleteDocument && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteClick(doc)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('common.delete')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocumentFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        document={selectedDocument}
        organizationId={orgId}
        onSuccess={handleFormSuccess}
      />

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

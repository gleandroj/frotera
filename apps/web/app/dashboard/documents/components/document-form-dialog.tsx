'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '@/i18n/useTranslation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ResourceSelectCreateRow } from '@/components/resource-select-create-row';
import { DrawerStackParentDim } from '@/components/drawer-stack-parent-dim';
import { VehicleFormDialog } from '@/app/dashboard/vehicles/vehicle-form-dialog';
import { usePermissions, Module, Action } from '@/lib/hooks/use-permissions';
import { useAuth } from '@/lib/hooks/use-auth';
import {
  documentsAPI,
  vehiclesAPI,
  type VehicleDocument,
  type CreateDocumentPayload,
  type UpdateDocumentPayload,
  type Vehicle,
  type DocumentType,
} from '@/lib/frontend/api-client';

const DOCUMENT_TYPES: DocumentType[] = [
  'CRLV',
  'INSURANCE',
  'LICENSE',
  'INSPECTION',
  'OTHER',
];

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: VehicleDocument | null;
  organizationId: string;
  defaultVehicleId?: string | null;
  onSuccess: () => void;
}

const buildSchema = (t: (k: string) => string) =>
  z.object({
    vehicleId: z.string().min(1, t('documents.vehicleRequired')),
    type: z.enum(['CRLV', 'INSURANCE', 'LICENSE', 'INSPECTION', 'OTHER']),
    title: z.string().min(1, t('documents.titleRequired')),
    issueDate: z.string().default(''),
    expiryDate: z.string().default(''),
    notes: z.string().default(''),
  });

type DocumentFormValues = z.infer<ReturnType<typeof buildSchema>>;

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  organizationId,
  defaultVehicleId,
  onSuccess,
}: DocumentFormDialogProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { selectedCustomerId } = useAuth();
  const isEdit = !!document;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleComboboxOpen, setVehicleComboboxOpen] = useState(false);
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      vehicleId: document?.vehicleId ?? defaultVehicleId ?? '',
      type: (document?.type as DocumentType) ?? 'CRLV',
      title: document?.title ?? '',
      issueDate: document?.issueDate ? document.issueDate.substring(0, 10) : '',
      expiryDate: document?.expiryDate
        ? document.expiryDate.substring(0, 10)
        : '',
      notes: document?.notes ?? '',
    },
  });

  const { isSubmitting } = form.formState;
  const vehicleId = form.watch('vehicleId');
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (!open) return;
    setPendingFile(null);
    form.reset({
      vehicleId: document?.vehicleId ?? defaultVehicleId ?? '',
      type: (document?.type as DocumentType) ?? 'CRLV',
      title: document?.title ?? '',
      issueDate: document?.issueDate
        ? document.issueDate.substring(0, 10)
        : '',
      expiryDate: document?.expiryDate
        ? document.expiryDate.substring(0, 10)
        : '',
      notes: document?.notes ?? '',
    });
  }, [open, document?.id]);

  useEffect(() => {
    if (!open || !organizationId) return;
    setLoadingVehicles(true);
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles(res.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoadingVehicles(false));
  }, [open, organizationId, t]);

  const refreshVehiclesSilently = () => {
    if (!organizationId) return;
    vehiclesAPI
      .list(organizationId)
      .then((res) => setVehicles(res.data ?? []))
      .catch(() => {});
  };

  const canCreateVehicle = can(Module.VEHICLES, Action.CREATE);

  const handleSubmit = async (values: DocumentFormValues) => {
    let fileUrl: string | null = null;
    if (pendingFile) {
      try {
        const { data } = await documentsAPI.uploadAttachment(
          organizationId,
          pendingFile,
        );
        fileUrl = data.fileUrl;
      } catch {
        toast.error(t('documents.fileUploadError'));
        return;
      }
    } else if (isEdit) {
      fileUrl = document!.fileUrl ?? null;
    }

    try {
      if (isEdit) {
        await documentsAPI.update(organizationId, document!.id, {
          type: values.type,
          title: values.title,
          issueDate: values.issueDate || null,
          expiryDate: values.expiryDate || null,
          fileUrl,
          notes: values.notes || null,
        } as UpdateDocumentPayload);
        toast.success(t('documents.toastUpdated'));
      } else {
        await documentsAPI.create(organizationId, {
          vehicleId: values.vehicleId,
          type: values.type,
          title: values.title,
          issueDate: values.issueDate,
          expiryDate: values.expiryDate,
          ...(fileUrl != null ? { fileUrl } : {}),
          notes: values.notes,
        } as CreateDocumentPayload);
        toast.success(t('documents.toastCreated'));
      }
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error(t('documents.toastError'));
    }
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0 sm:max-w-[520px]">
        <SheetHeader className="border-b px-6 pb-4 pt-6">
          <SheetTitle>
            {isEdit ? t('documents.editDocument') : t('documents.createDocument')}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Veículo */}
            <FormField
              control={form.control}
              name="vehicleId"
              render={() => (
                <FormItem>
                  <FormLabel>{t('documents.fields.vehicle')} *</FormLabel>
                  <ResourceSelectCreateRow
                    showCreate={!isEdit && canCreateVehicle}
                    createLabel={t('common.createNewVehicle')}
                    onCreateClick={() => setVehicleFormOpen(true)}
                    disabled={isEdit || loadingVehicles}
                  >
                    <Popover
                      open={vehicleComboboxOpen}
                      onOpenChange={setVehicleComboboxOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={isEdit || loadingVehicles}
                            className={cn(
                              'w-full justify-between font-normal h-10',
                              !vehicleId && 'text-muted-foreground',
                            )}
                          >
                            <span className="truncate">
                              {loadingVehicles
                                ? t('common.loading')
                                : selectedVehicle
                                  ? `${selectedVehicle.plate || selectedVehicle.name || 'N/A'}`
                                  : t('documents.selectVehicle')}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <Command>
                          <CommandInput
                            placeholder={t('documents.filterVehicle')}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>{t('common.notAvailable')}</CommandEmpty>
                            <CommandGroup>
                              {vehicles.map((v) => (
                                <CommandItem
                                  key={v.id}
                                  value={v.plate || v.name || v.id}
                                  onSelect={() => {
                                    form.setValue('vehicleId', v.id, {
                                      shouldValidate: true,
                                    });
                                    setVehicleComboboxOpen(false);
                                  }}
                                >
                                  {v.plate || v.name || 'N/A'}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </ResourceSelectCreateRow>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Tipo */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('documents.fields.type')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DOCUMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`documents.type.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Título */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('documents.fields.title')} *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('documents.fields.title')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Data de Emissão */}
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('documents.fields.issueDate')}</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || undefined}
                        onChange={field.onChange}
                        placeholder={t('documents.fields.issueDate')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data de Vencimento */}
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('documents.fields.expiryDate')}</FormLabel>
                    <FormControl>
                      <DatePicker
                        value={field.value || undefined}
                        onChange={field.onChange}
                        placeholder={t('documents.fields.expiryDate')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Arquivo (upload S3 / MinIO ao salvar) */}
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium leading-none">
                  {t('documents.fields.file')}
                </p>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  {t('documents.fields.fileHint')}
                </p>
              </div>
              {isEdit && document?.fileUrl && !pendingFile && (
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-block text-sm underline-offset-4 hover:underline"
                >
                  {t('documents.viewFile')}
                </a>
              )}
              {pendingFile && (
                <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {pendingFile.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setPendingFile(null)}
                    aria-label={t('documents.fileClear')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                className="cursor-pointer text-sm file:mr-3 file:cursor-pointer"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPendingFile(f ?? null);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('documents.fields.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('documents.fields.notesPlaceholder')}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <div className="flex justify-end gap-2 border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </div>
          </form>
        </Form>
        <DrawerStackParentDim show={vehicleFormOpen} />
      </SheetContent>
    </Sheet>

    <VehicleFormDialog
      open={vehicleFormOpen}
      onOpenChange={setVehicleFormOpen}
      vehicle={null}
      organizationId={organizationId}
      defaultCustomerId={selectedCustomerId}
      hideOverlay
      onSuccess={(created) => {
        refreshVehiclesSilently();
        if (created?.id) {
          form.setValue('vehicleId', created.id, { shouldValidate: true });
        }
      }}
    />
    </>
  );
}

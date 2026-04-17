'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '@/i18n/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ResourceSelectCreateRow } from '@/components/resource-select-create-row';
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
    fileUrl: z
      .string()
      .refine(
        (val) => !val || /^https?:\/\/.+/.test(val),
        t('documents.fileUrlInvalid'),
      )
      .default(''),
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
      fileUrl: document?.fileUrl ?? '',
      notes: document?.notes ?? '',
    },
  });

  const { isSubmitting } = form.formState;
  const vehicleId = form.watch('vehicleId');
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId);

  useEffect(() => {
    if (!open) return;
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
      fileUrl: document?.fileUrl ?? '',
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
    try {
      if (isEdit) {
        await documentsAPI.update(organizationId, document!.id, {
          type: values.type,
          title: values.title,
          issueDate: values.issueDate || null,
          expiryDate: values.expiryDate || null,
          fileUrl: values.fileUrl || null,
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
          fileUrl: values.fileUrl,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('documents.editDocument') : t('documents.createDocument')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-5"
          >
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
                      <Input type="date" {...field} />
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
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* URL do Arquivo */}
            <FormField
              control={form.control}
              name="fileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('documents.fields.fileUrl')}</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder={t('documents.fields.fileUrlPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <DialogFooter>
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
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <VehicleFormDialog
      open={vehicleFormOpen}
      onOpenChange={setVehicleFormOpen}
      vehicle={null}
      organizationId={organizationId}
      defaultCustomerId={selectedCustomerId}
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

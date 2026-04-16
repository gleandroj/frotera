'use client';

import { useEffect, useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import { z } from 'zod';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import { toast } from 'sonner';
import {
  documentsAPI,
  vehiclesAPI,
  type VehicleDocument,
  type CreateDocumentPayload,
  type UpdateDocumentPayload,
  type Vehicle,
  type DocumentType,
} from '@/lib/frontend/api-client';

const DOCUMENT_TYPES: DocumentType[] = ['CRLV', 'INSURANCE', 'LICENSE', 'INSPECTION', 'OTHER'];

interface DocumentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: VehicleDocument | null;
  organizationId: string;
  defaultVehicleId?: string | null;
  onSuccess: () => void;
}

interface DocumentFormValues {
  vehicleId: string;
  type: DocumentType;
  title: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  notes: string;
}

function getInitialValues(
  document: VehicleDocument | null,
  defaultVehicleId?: string | null,
): DocumentFormValues {
  return {
    vehicleId: document?.vehicleId ?? defaultVehicleId ?? '',
    type: (document?.type as DocumentType) ?? 'CRLV',
    title: document?.title ?? '',
    issueDate: document?.issueDate ? document.issueDate.substring(0, 10) : '',
    expiryDate: document?.expiryDate ? document.expiryDate.substring(0, 10) : '',
    fileUrl: document?.fileUrl ?? '',
    notes: document?.notes ?? '',
  };
}

function buildSchema(t: (k: string) => string) {
  return z.object({
    vehicleId: z.string().min(1, t('documents.vehicleRequired')),
    type: z.enum(['CRLV', 'INSURANCE', 'LICENSE', 'INSPECTION', 'OTHER']),
    title: z.string().min(1, t('documents.titleRequired')),
    issueDate: z.string().optional(),
    expiryDate: z.string().optional(),
    fileUrl: z
      .string()
      .refine(
        (val) => !val || /^https?:\/\/.+/.test(val),
        t('documents.fileUrlInvalid'),
      )
      .optional(),
    notes: z.string().optional(),
  });
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  document,
  organizationId,
  defaultVehicleId,
  onSuccess,
}: DocumentFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!document;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehicleComboboxOpen, setVehicleComboboxOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;

    setLoadingVehicles(true);
    vehiclesAPI
      .list(organizationId)
      .then((res) => {
        setVehicles(res.data);
      })
      .catch(() => {
        toast.error(t('common.error'));
      })
      .finally(() => {
        setLoadingVehicles(false);
      });
  }, [open, organizationId, t]);

  const initialValues = getInitialValues(document, defaultVehicleId);
  const schema = buildSchema(t);

  const handleSubmit = async (values: DocumentFormValues) => {
    try {
      setIsSubmitting(true);

      const payload = isEdit
        ? ({
            type: values.type,
            title: values.title,
            issueDate: values.issueDate || null,
            expiryDate: values.expiryDate || null,
            fileUrl: values.fileUrl || null,
            notes: values.notes || null,
          } as UpdateDocumentPayload)
        : ({
            vehicleId: values.vehicleId,
            type: values.type,
            title: values.title,
            issueDate: values.issueDate,
            expiryDate: values.expiryDate,
            fileUrl: values.fileUrl,
            notes: values.notes,
          } as CreateDocumentPayload);

      if (isEdit) {
        await documentsAPI.update(organizationId, document!.id, payload as UpdateDocumentPayload);
        toast.success(t('documents.toastUpdated'));
      } else {
        await documentsAPI.create(organizationId, payload as CreateDocumentPayload);
        toast.success(t('documents.toastCreated'));
      }

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(t('documents.toastError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.id === initialValues.vehicleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('documents.editDocument') : t('documents.createDocument')}
          </DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={initialValues}
          validationSchema={toFormikValidationSchema(schema)}
          onSubmit={handleSubmit}
        >
          {({ values, setFieldValue, errors, touched }) => (
            <Form className="space-y-4">
              {/* Vehicle Combobox */}
              <div className="space-y-2">
                <Label>{t('documents.fields.vehicle')}</Label>
                <Popover open={vehicleComboboxOpen} onOpenChange={setVehicleComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vehicleComboboxOpen}
                      className="w-full justify-between"
                      disabled={isEdit || loadingVehicles}
                    >
                      {loadingVehicles
                        ? t('common.loading')
                        : selectedVehicle
                          ? `${selectedVehicle.plate || selectedVehicle.name || 'N/A'}`
                          : t('documents.selectVehicle')}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder={t('documents.filterVehicle')} />
                      <CommandEmpty>{t('common.notAvailable')}</CommandEmpty>
                      <CommandGroup>
                        <CommandList>
                          {vehicles.map((v) => (
                            <CommandItem
                              key={v.id}
                              value={v.id}
                              onSelect={() => {
                                setFieldValue('vehicleId', v.id);
                                setVehicleComboboxOpen(false);
                              }}
                            >
                              <div
                                className={cn(
                                  'mr-2 h-4 w-4 border border-primary rounded-sm',
                                  values.vehicleId === v.id &&
                                    'bg-primary text-primary-foreground',
                                )}
                              />
                              {v.plate || v.name || 'N/A'}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <ErrorMessage name="vehicleId">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* Document Type */}
              <div className="space-y-2">
                <Label>{t('documents.fields.type')}</Label>
                <Select value={values.type} onValueChange={(val) => setFieldValue('type', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`documents.type.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage name="type">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>{t('documents.fields.title')}</Label>
                <Field
                  as={Input}
                  name="title"
                  placeholder={t('documents.fields.title')}
                  disabled={isSubmitting}
                />
                <ErrorMessage name="title">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* Issue Date */}
              <div className="space-y-2">
                <Label>{t('documents.fields.issueDate')}</Label>
                <Field as={Input} type="date" name="issueDate" disabled={isSubmitting} />
                <ErrorMessage name="issueDate">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label>{t('documents.fields.expiryDate')}</Label>
                <Field as={Input} type="date" name="expiryDate" disabled={isSubmitting} />
                <ErrorMessage name="expiryDate">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* File URL */}
              <div className="space-y-2">
                <Label>{t('documents.fields.fileUrl')}</Label>
                <Field
                  as={Input}
                  type="url"
                  name="fileUrl"
                  placeholder={t('documents.fields.fileUrlPlaceholder')}
                  disabled={isSubmitting}
                />
                <ErrorMessage name="fileUrl">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t('documents.fields.notes')}</Label>
                <Field
                  as={Textarea}
                  name="notes"
                  placeholder={t('documents.fields.notesPlaceholder')}
                  disabled={isSubmitting}
                  rows={3}
                />
                <ErrorMessage name="notes">
                  {(msg) => <span className="text-sm text-red-500">{msg}</span>}
                </ErrorMessage>
              </div>

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
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

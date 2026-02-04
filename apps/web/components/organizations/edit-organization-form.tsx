"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { organizationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useTranslation } from "@/i18n/useTranslation";

interface EditOrganizationFormProps {
  organizationId: string;
  onSuccess?: (organization: any) => void;
  onCancel?: () => void;
}

type OrganizationFormValues = {
  name: string;
};

export function EditOrganizationForm({
  organizationId,
  onSuccess,
  onCancel,
}: EditOrganizationFormProps) {
  const { t } = useTranslation();
  const { refreshOrganizations } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizationData, setOrganizationData] = useState<any>(null);

  const organizationFormSchema = z.object({
    name: z
      .string()
      .min(1, {
        message: t('organizations.validation.nameRequired'),
      })
      .min(2, {
        message: t('organizations.validation.nameTooShort'),
      })
      .max(100, {
        message: t('organizations.validation.nameTooLong'),
      }),
  });

  type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
    },
  });

  // Load organization data
  useEffect(() => {
    const loadOrganizationData = async () => {
      try {
        const response = await organizationAPI.getDetails(organizationId);
        const org = response.data;
        setOrganizationData(org);

        form.reset({
          name: org.name || '',
        });
      } catch (error: any) {
        toast.error(t('organizations.failedToLoadOrganization'));
        console.error('Failed to load organization:', error);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      loadOrganizationData();
    }
  }, [organizationId, form, t]);

  const onSubmit = async (data: OrganizationFormValues) => {
    try {
      const response = await organizationAPI.update(organizationId, {
        name: data.name,
        description: undefined,
      });
      const result = response.data;

      toast.success(t('organizations.organizationUpdatedSuccessfully'));
      onSuccess?.(result.organization);

      // Refresh organizations list to show updated data
      await refreshOrganizations();
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || t('organizations.failedToUpdateOrganization');
      toast.error(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organizationData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('organizations.organizationNotFound')}
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-1" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('organizations.organizationName')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('organizations.organizationNamePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          )}
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting
              ? t('organizations.updating')
              : t('organizations.updateOrganization')
            }
          </Button>
        </div>
      </form>
    </Form>
  );
}

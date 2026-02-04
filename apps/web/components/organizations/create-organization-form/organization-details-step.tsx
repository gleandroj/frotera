"use client";

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
import { useTranslation } from "@/i18n/useTranslation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface OrganizationDetailsStepProps {
  onNext: (data: OrganizationFormData) => void;
  initialData?: Partial<OrganizationFormData>;
  isProcessing?: boolean;
}

export interface OrganizationFormData {
  name?: string;
}

export function OrganizationDetailsStep({
  onNext,
  initialData,
  isProcessing = false
}: OrganizationDetailsStepProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLoading = isSubmitting || isProcessing;

  const organizationFormSchema = z.object({
    name: z
      .string()
      .min(1, { message: t('organizations.validation.nameRequired') })
      .min(2, { message: t('organizations.validation.nameTooShort') })
      .max(100, { message: t('organizations.validation.nameTooLong') }),
  });

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: initialData?.name || '',
    },
  });

  const onSubmit = async (data: OrganizationFormData) => {
    if (!form.formState.isValid) return;

    setIsSubmitting(true);

    // Add a small delay for better UX
    setTimeout(() => {
      onNext(data);
      setIsSubmitting(false);
    }, 300);
  };

  const watchedName = form.watch('name');
  const progress = watchedName.length > 0 ? Math.min((watchedName.length / 10) * 100, 100) : 0;

  return (
    <div className="space-y-6 px-1">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base font-medium">
                  {t('organizations.createForm.organization.nameLabel')}
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder={t('organizations.createForm.organization.namePlaceholder')}
                      className="h-12 text-base pr-12 transition-all focus:ring-2 focus:ring-primary/20"
                      {...field}
                    />
                    {watchedName.length > 0 && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <div
                            className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400 transition-all duration-300"
                            style={{
                              transform: `scale(${Math.min(progress / 100, 1)})`
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            size="lg"
            className={`w-full h-12 text-base transition-all duration-300 ${isLoading
                ? 'scale-95 opacity-70'
                : 'hover:shadow-md'
              }`}
            disabled={isLoading || !form.formState.isValid}
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {t('common.loading')}
              </div>
            ) : (
              <>
                {t('organizations.createForm.organization.createButton')}
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}

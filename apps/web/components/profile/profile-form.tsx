"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/hooks/use-auth";
import { externalApi } from "@/lib/frontend/api-client";
import { toast } from "sonner";
import { useEffect } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { onRhfInvalidSubmit } from "@/lib/on-rhf-invalid-submit";

export function ProfileForm() {
  const { t } = useTranslation();
  const { user, refreshUser, isLoading: isAuthLoading } = useAuth();

  const profileFormSchema = z.object({
    name: z.string().min(1, {
      message: t('profile.nameCannotBeEmpty'),
    }),
    email: z.string().email({
      message: t('profile.invalidEmail'),
    }),
    phoneNumber: z.string().optional(),
  });

  type ProfileFormValues = z.infer<typeof profileFormSchema>;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phoneNumber: "",
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
      });
    }
  }, [user, form]);

  async function onSubmit(data: ProfileFormValues) {
    try {
      const response = await externalApi.patch("/api/users/profile", data);
      await refreshUser(); // Refresh user context
      toast.success(t('profile.profileUpdatedSuccessfully'));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error || t('profile.failedToUpdateProfile');
      toast.error(errorMessage);
      console.error("Profile update error:", error);
    }
  }

  if (isAuthLoading || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.profileInformation')}</CardTitle>
          <CardDescription>{t('profile.updatePersonalDetails')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-10 bg-muted rounded w-1/3 animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-1/3 animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-full animate-pulse"></div>
            <div className="h-10 bg-muted rounded w-1/4 animate-pulse self-start"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.profileInformation')}</CardTitle>
        <CardDescription>{t('profile.updatePersonalDetails')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit, onRhfInvalidSubmit(form, t))}
            className="space-y-8"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('common.name')} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('profile.publicDisplayName')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              disabled
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.emailLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('common.email')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.phoneNumberOptional')}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={t('common.phone')}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('profile.phoneDescription')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('profile.updating') : t('common.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

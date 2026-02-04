"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/i18n/useTranslation";
import { organizationAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { toast } from "sonner";
import { OrganizationDetailsStep, type OrganizationFormData } from "./create-organization-form/";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle } from "lucide-react";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (organization: any) => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const { t } = useTranslation();
  const { refreshAndSwitchOrganization } = useAuth();
  const [success, setSuccess] = useState(false);
  const [createdOrgName, setCreatedOrgName] = useState("");

  // Form state
  const [organizationData, setOrganizationData] = useState<OrganizationFormData>({
    name: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const handleOrganizationSubmit = async (data: OrganizationFormData) => {
    setOrganizationData(data);

    try {
      setIsProcessing(true);
      const response = await organizationAPI.create(
        data.name,
        undefined
      );
      const result = response.data;

      console.log('✅ Organization created successfully:', result.organization);
      toast.success(t('organizations.organizationCreatedSuccessfully'));

      // Refresh organizations and switch to the newly created one
      try {
        console.log('🔄 Refreshing organizations and switching to:', result.organization.id);
        await new Promise(resolve => setTimeout(resolve, 500));
        await refreshAndSwitchOrganization(result.organization.id);
        console.log('✅ Successfully switched to new organization');
      } catch (switchError: any) {
        console.error('❌ Failed to switch organizations:', switchError);
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await refreshAndSwitchOrganization(result.organization.id);
          console.log('✅ Successfully switched to new organization (retry)');
        } catch (retryError: any) {
          console.error('❌ Failed to switch organizations (retry):', retryError);
        }
      }

      setCreatedOrgName(data.name);
      setSuccess(true);
      onSuccess?.(result.organization);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || t('organizations.failedToCreateOrganization');
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after animation
    setTimeout(() => {
      setSuccess(false);
      setOrganizationData({ name: '' });
      setCreatedOrgName("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('organizations.createOrganization')}
          </DialogTitle>
          <DialogDescription>
            {success
              ? t('organizations.organizationCreatedSuccessfully')
              : t('organizations.createOrganizationDialogDescription')
            }
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900 p-3">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {t('organizations.successTitle')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('organizations.successMessage', { name: createdOrgName })}
              </p>
            </div>
            <Button onClick={handleClose} className="mt-4">
              {t('common.close')}
            </Button>
          </div>
        ) : (
          <OrganizationDetailsStep
            onNext={handleOrganizationSubmit}
            initialData={organizationData}
            isProcessing={isProcessing}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

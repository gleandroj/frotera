"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CreateOrganizationDialog, EditOrganizationForm } from "@/components/organizations";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  Building2,
  Calendar,
  Crown,
  Edit,
  Plus,
  Settings,
  Shield,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, organizations, currentOrganization, refreshAndSwitchOrganization } =
    useAuth();
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Only superadmin can see and manage organizations
  useEffect(() => {
    if (!user?.isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [user?.isSuperAdmin, router]);

  // Check if we should open edit dialog based on URL param
  useEffect(() => {
    const orgIdFromUrl = searchParams.get('edit');
    if (orgIdFromUrl && organizations.some(org => org.id === orgIdFromUrl)) {
      setEditingOrgId(orgIdFromUrl);
    }
  }, [searchParams, organizations]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "OWNER":
        return <Crown className="w-4 h-4" />;
      case "ADMIN":
        return <Shield className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "ADMIN":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";
    }
  };

  const handleRefreshAndSwitchOrganization = async (orgId: string) => {
    await refreshAndSwitchOrganization(orgId);
    router.push("/dashboard");
  };

  const handleEditSuccess = (organization: any) => {
    setEditingOrgId(null);
    // Remove edit param from URL
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('edit');
    const newUrl = newParams.toString() ? `?${newParams}` : '';
    router.replace(`/settings/organizations${newUrl}`, { scroll: false });
  };

  const canEditOrganization = (org: any) => {
    return org.role === 'OWNER' || org.role === 'ADMIN';
  };

  if (!user?.isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.organizations.title')}</h1>
          <p className="text-muted-foreground">
            {t('settings.organizations.description')}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t('settings.organizations.createOrganization')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => (
          <Card
            key={org.id}
            className={`relative transition-all hover:shadow-md overflow-hidden ${currentOrganization?.id === org.id ? "ring-2 ring-primary" : ""
              }`}
          >
            <CardHeader className="pb-3 overflow-hidden">
              <div className="flex items-start justify-between overflow-hidden">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <Avatar className="h-12 w-12 overflow-hidden">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {getInitials(org.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 flex-col overflow-hidden">
                    <CardTitle className="text-lg text-ellipsis overflow-hidden">
                      {org.name}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground">
                      {org.currency === 'BRL' ? 'R$' : '$'} {org.currency}
                    </div>
                  </div>
                </div>
                {currentOrganization?.id === org.id && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    {t('settings.organizations.current')}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {org.description && (
                <p className="text-sm text-muted-foreground">
                  {org.description}
                </p>
              )}

              <div className="flex items-center justify-between">
                <Badge variant="outline" className={getRoleColor(org.role)}>
                  <span className="flex items-center gap-1">
                    {getRoleIcon(org.role)}
                    <span>{org.role}</span>
                  </span>
                </Badge>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  {new Date(org.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2">
                {currentOrganization?.id !== org.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefreshAndSwitchOrganization(org.id)}
                    className="flex-1"
                  >
                    {t('settings.organizations.switchTo')}
                  </Button>
                )}
                {canEditOrganization(org) && (
                  <Dialog
                    open={editingOrgId === org.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setEditingOrgId(org.id);
                      } else {
                        handleEditSuccess(null);
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{t('organizations.updateOrganization')}</DialogTitle>
                        <DialogDescription>
                          {t('organizations.editOrganizationDialogDescription')}
                        </DialogDescription>
                      </DialogHeader>
                      <EditOrganizationForm
                        organizationId={org.id}
                        onSuccess={handleEditSuccess}
                        onCancel={() => setEditingOrgId(null)}
                      />
                    </DialogContent>
                  </Dialog>
                )}

              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {organizations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {t('settings.organizations.noOrganizationsFound')}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {t('settings.organizations.noOrganizationsDescription')}
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('settings.organizations.createFirstOrganization')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
        }}
      />
    </div>
  );
}

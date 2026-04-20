"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTranslation } from "@/i18n/useTranslation";
import { onRhfInvalidSubmit } from "@/lib/on-rhf-invalid-submit";
import {
  organizationAPI,
  customersAPI,
  vehiclesAPI,
  driversAPI,
  type Customer,
} from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { rolesAPI, type Role } from "@/lib/api/roles";
import {
  summarizeRoleScope,
} from "./role-display";
import { RoleHelpPanel } from "./role-help-panel";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/hooks/use-mobile";
import { PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    isSuperAdmin?: boolean;
    isSystemUser?: boolean;
  };
  role: {
    id: string;
    name: string;
    color?: string | null;
    permissions: Array<{
      id: string;
      module: string;
      actions: string[];
      scope: string;
    }>;
  };
  joinedAt: string;
  customerRestricted?: boolean;
  customers?: { id: string; name: string }[];
  vehicles?: { id: string; name: string; plate: string }[];
  drivers?: { id: string; name: string }[];
}

function getDescendantIds(
  customerId: string,
  customers: { id: string; parentId?: string | null }[],
): string[] {
  const byParent = new Map<string | null, { id: string }[]>();
  for (const c of customers) {
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push({ id: c.id });
  }
  const result: string[] = [];
  const stack = [customerId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const ch of byParent.get(id) ?? []) {
      result.push(ch.id);
      stack.push(ch.id);
    }
  }
  return result;
}

interface MemberEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
  onSuccess: () => void;
}

export function MemberEditSheet({
  open,
  onOpenChange,
  memberId,
  onSuccess,
}: MemberEditSheetProps) {
  const { t } = useTranslation();
  const { currentOrganization, user, selectedCustomerId } = useAuth();
  const { can } = usePermissions();

  const [member, setMember] = useState<TeamMember | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMember, setLoadingMember] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<{ id: string; name: string; plate: string }[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<{ id: string; name: string }[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [driverSearch, setDriverSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const isMobile = useIsMobile();
  const showRoleSidePanel = expanded && !isMobile;

  const schema = z
    .object({
      roleId: z.string().min(1, t("team.createUserDialog.validation.roleRequired")),
      fullAccess: z.boolean().default(false),
      customerIds: z.array(z.string()).default([]),
      name: z.string().default(""),
      email: z.string().default(""),
      newPassword: z.string().default(""),
      confirmPassword: z.string().default(""),
      isSuperAdmin: z.boolean().default(false),
      isSystemUser: z.boolean().default(false),
    })
    .refine(
      (data) => !data.newPassword || data.newPassword === data.confirmPassword,
      { message: "As senhas não coincidem", path: ["confirmPassword"] },
    );

  type EditMemberFormValues = z.infer<typeof schema>;

  const form = useForm<EditMemberFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roleId: "",
      fullAccess: false,
      customerIds: [],
      name: "",
      email: "",
      newPassword: "",
      confirmPassword: "",
      isSuperAdmin: false,
      isSystemUser: false,
    },
  });

  const { isSubmitting } = form.formState;
  const fullAccess = form.watch("fullAccess");
  const customerIds = form.watch("customerIds");
  const newPassword = form.watch("newPassword");

  const loadMembersAndMember = useCallback(() => {
    if (!currentOrganization?.id || !memberId) return;
    setLoadingMember(true);
    organizationAPI
      .getMembers(currentOrganization.id)
      .then((res) => {
        const list = res.data?.memberships ?? [];
        setMembers(Array.isArray(list) ? list : []);
        const found = list.find((m: TeamMember) => m.id === memberId) ?? null;
        setMember(found);
        if (found) {
          form.reset({
            roleId: found.role.id,
            fullAccess: false,
            customerIds: found.customers?.map((c) => c.id) ?? [],
            name: found.user.name ?? "",
            email: found.user.email,
            newPassword: "",
            confirmPassword: "",
            isSuperAdmin: found.user.isSuperAdmin === true,
            isSystemUser: found.user.isSystemUser === true,
          });
          setSelectedVehicleIds(found.vehicles?.map((v) => v.id) ?? []);
          setSelectedDriverIds(found.drivers?.map((d) => d.id) ?? []);
        }
      })
      .catch(() => {
        setMembers([]);
        setMember(null);
      })
      .finally(() => setLoadingMember(false));
  }, [currentOrganization?.id, memberId, form.reset]);

  const loadCustomers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoadingCustomers(true);
    customersAPI
      .list(
        currentOrganization.id,
        {
          ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}),
          activeOnly: true,
        },
      )
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [currentOrganization?.id, selectedCustomerId]);

  useEffect(() => {
    if (open && memberId) {
      loadMembersAndMember();
    }
  }, [open, memberId, loadMembersAndMember]);

  useEffect(() => {
    if (open) loadCustomers();
  }, [open, loadCustomers]);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    vehiclesAPI.list(currentOrganization.id)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.vehicles ?? [];
        setAvailableVehicles(list.map((v: any) => ({ id: v.id, name: v.name ?? '', plate: v.plate ?? '' })));
      })
      .catch(() => setAvailableVehicles([]));
    driversAPI.list(currentOrganization.id)
      .then((res) => setAvailableDrivers(res.data?.drivers ?? []))
      .catch(() => setAvailableDrivers([]));
  }, [open, currentOrganization?.id]);

  useEffect(() => {
    if (!open) return;
    if (!currentOrganization?.id) return;
    rolesAPI
      .getRoles(currentOrganization.id)
      .then((res) => setRoles(res.data?.roles ?? []))
      .catch(() => setRoles([]));
  }, [open, currentOrganization?.id]);

  useEffect(() => {
    if (open) setExpanded(true);
  }, [open]);

  useEffect(() => {
    if (!member || !members.length) return;
    const currentUserMembership = members.find((m) => m.user.id === user?.id);
    const currentUserRestricted = currentUserMembership?.customerRestricted === true;
    form.setValue(
      "fullAccess",
      currentUserRestricted ? false : !member.customerRestricted,
    );
  }, [member, members, user?.id]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const currentUserMembership = members.find((m) => m.user.id === user?.id);
  const currentUserRestricted = currentUserMembership?.customerRestricted === true;
  const isEditingSelf = member?.user.id === user?.id;
  const canEditOwnAccess = can(Module.USERS, Action.EDIT);
  const disableRoleAndAccess = isEditingSelf && !canEditOwnAccess;
  const selectedRole = roles.find((r) => r.id === form.watch("roleId"));
  const scopeSummary = summarizeRoleScope(t, selectedRole);
  const hasAssignedScope = scopeSummary.hasAssignedScope;
  const filteredVehicles = availableVehicles.filter(
    (vehicle) =>
      !vehicleSearch.trim() ||
      vehicle.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      vehicle.plate.toLowerCase().includes(vehicleSearch.toLowerCase()),
  );
  const filteredDrivers = availableDrivers.filter(
    (driver) =>
      !driverSearch.trim() || driver.name.toLowerCase().includes(driverSearch.toLowerCase()),
  );

  const handleSubmit = async (values: EditMemberFormValues) => {
    if (!currentOrganization || !member) return;
    try {
      await organizationAPI.updateMember(currentOrganization.id, member.id, {
        roleId: values.roleId,
        customerRestricted: !values.fullAccess,
        customerIds: values.fullAccess ? undefined : values.customerIds,
        name: values.name || undefined,
        email: values.email !== member.user.email ? values.email : undefined,
        newPassword: values.newPassword || undefined,
        isSuperAdmin: user?.isSuperAdmin ? values.isSuperAdmin : undefined,
        isSystemUser: user?.isSuperAdmin ? values.isSystemUser : undefined,
      });
      await Promise.all([
        organizationAPI.setMemberVehicles(currentOrganization.id, member.id, selectedVehicleIds),
        organizationAPI.setMemberDrivers(currentOrganization.id, member.id, selectedDriverIds),
      ]);
      toast.success(t("team.toastMessages.memberUpdated"), {
        description: t("team.toastMessages.memberUpdatedDescription"),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errorCode?: string; message?: string } }; message?: string };
      const errorCode = e.response?.data?.errorCode;
      switch (errorCode) {
        case "USER_ALREADY_EXISTS":
          toast.error("Email já está em uso");
          break;
        case "MEMBER_CANNOT_GRANT_FULL_ACCESS":
          toast.error(t("team.errorMessages.cannotGrantFullAccess"), {
            description: t("team.errorMessages.cannotGrantFullAccessDescription"),
          });
          break;
        case "MEMBER_CANNOT_CHANGE_OWN_ROLE":
          toast.error(t("team.errorMessages.cannotChangeOwnRole"), {
            description: t("team.errorMessages.cannotChangeOwnRoleDescription"),
          });
          break;
        case "MEMBER_CANNOT_EDIT_OWN_ACCESS":
          toast.error(t("team.errorMessages.cannotEditOwnAccess"), {
            description: t("team.errorMessages.cannotEditOwnAccessDescription"),
          });
          break;
        default:
          toast.error(t("team.toastMessages.error"), {
            description:
              e.response?.data?.message ||
              e.message ||
              t("team.errorMessages.failedToUpdateMember"),
          });
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "overflow-y-auto transition-[max-width] duration-300",
          showRoleSidePanel ? "sm:max-w-5xl" : "sm:max-w-2xl",
        )}
      >
        <SheetHeader>
          <SheetTitle>{t("team.editDialog.title")}</SheetTitle>
          <SheetDescription>
            {member
              ? t("team.editDialog.description", {
                  name: member.user.name || member.user.email,
                })
              : t("common.loading")}
          </SheetDescription>
        </SheetHeader>

        {!isMobile && (
          <button
            type="button"
            className="absolute right-12 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? t("team.roleContext.collapsePanel") : t("team.roleContext.expandPanel")}
          >
            {expanded
              ? <PanelRightClose className="h-4 w-4" />
              : <PanelRightOpen className="h-4 w-4" />}
          </button>
        )}

        {loadingMember ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : !member ? (
          <div className="py-8">
            <p className="text-muted-foreground">{t("team.memberNotFound")}</p>
          </div>
        ) : (
          <div className={cn("mt-6", showRoleSidePanel && "grid grid-cols-[1fr_300px] gap-6 items-start")}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit, onRhfInvalidSubmit(form, t))}
              className="space-y-6"
              autoComplete="off"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informações do Usuário</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input type="text" autoComplete="off" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="off" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl>
                          <Input type="password" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {newPassword.length > 0 && (
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  {disableRoleAndAccess && (
                    <p className="text-xs text-muted-foreground">
                      {t("team.editDialog.editingSelfHint")}
                    </p>
                  )}

                  <FormField
                    control={form.control}
                    name="roleId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("team.createUserDialog.roleLabel")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={disableRoleAndAccess}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {user?.isSuperAdmin === true && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Flags administrativas</CardTitle>
                        <CardDescription>
                          `isSuperAdmin` concede permissao global; `isSystemUser` marca conta tecnica/interna.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <FormField
                          control={form.control}
                          name="isSuperAdmin"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(v) => field.onChange(v === true)}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                Is Super Admin
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="isSystemUser"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={(v) => field.onChange(v === true)}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                Is System User
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  )}

                  {!currentUserRestricted && !disableRoleAndAccess && (
                    <FormField
                      control={form.control}
                      name="fullAccess"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(v) => {
                                field.onChange(v === true);
                                if (v === true) form.setValue("customerIds", []);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="font-normal cursor-pointer">
                            {t("team.createUserDialog.fullAccess")}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  )}

                  {(currentUserRestricted || disableRoleAndAccess || !fullAccess) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {t("team.createUserDialog.customerAccess")}
                        </CardTitle>
                        <CardDescription>
                          {t("team.createUserDialog.customerAccessHint")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={t("team.createUserDialog.customerSearchPlaceholder")}
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const idsToAdd = filteredCustomers.flatMap((c) =>
                                c.parentId != null && customerIds.includes(c.parentId)
                                  ? []
                                  : [c.id, ...getDescendantIds(c.id, customers)],
                              );
                              form.setValue("customerIds", [
                                ...new Set([...customerIds, ...idsToAdd]),
                              ]);
                            }}
                          >
                            {t("team.createUserDialog.selectAllCustomers")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const idsToRemove = new Set(
                                filteredCustomers.flatMap((c) => [
                                  c.id,
                                  ...getDescendantIds(c.id, customers),
                                ]),
                              );
                              form.setValue(
                                "customerIds",
                                customerIds.filter((id) => !idsToRemove.has(id)),
                              );
                            }}
                          >
                            {t("team.createUserDialog.deselectAllCustomers")}
                          </Button>
                        </div>
                        <div
                          className={`max-h-64 overflow-y-auto rounded-md border p-3 space-y-1 ${
                            disableRoleAndAccess ? "pointer-events-none opacity-60" : ""
                          }`}
                        >
                          {loadingCustomers ? (
                            <p className="text-sm text-muted-foreground">
                              {t("common.loading")}
                            </p>
                          ) : filteredCustomers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {customerSearch.trim()
                                ? t("common.noResults")
                                : t("customers.noCustomers")}
                            </p>
                          ) : (
                            filteredCustomers.map((c) => {
                              const parentSelected =
                                c.parentId != null && customerIds.includes(c.parentId);
                              return (
                                <div
                                  key={c.id}
                                  className="flex items-center space-x-2 py-1.5"
                                  style={{ paddingLeft: (c.depth ?? 0) * 16 }}
                                >
                                  <Checkbox
                                    id={`edit-customer-${c.id}`}
                                    checked={customerIds.includes(c.id)}
                                    disabled={disableRoleAndAccess || parentSelected}
                                    onCheckedChange={(v) => {
                                      if (disableRoleAndAccess || parentSelected) return;
                                      const idsToAdd =
                                        v === true
                                          ? [c.id, ...getDescendantIds(c.id, customers)]
                                          : [];
                                      const idsToRemove =
                                        v === false
                                          ? [c.id, ...getDescendantIds(c.id, customers)]
                                          : [];
                                      form.setValue(
                                        "customerIds",
                                        v === true
                                          ? [...new Set([...customerIds, ...idsToAdd])]
                                          : customerIds.filter(
                                              (id) => !idsToRemove.includes(id),
                                            ),
                                      );
                                    }}
                                  />
                                  <label
                                    htmlFor={`edit-customer-${c.id}`}
                                    className={`font-normal text-sm flex-1 ${
                                      disableRoleAndAccess || parentSelected
                                        ? "cursor-not-allowed opacity-70"
                                        : "cursor-pointer"
                                    }`}
                                  >
                                    {c.name}
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasAssignedScope && !disableRoleAndAccess && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t("team.editDialog.assignedVehicles")}</CardTitle>
                        <CardDescription>{t("team.editDialog.assignedVehiclesHint")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={t("team.editDialog.vehicleSearchPlaceholder")}
                            value={vehicleSearch}
                            onChange={(e) => setVehicleSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => setSelectedVehicleIds([...new Set([...selectedVehicleIds, ...availableVehicles.filter(v => v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())).map(v => v.id)])])}>
                            {t("team.editDialog.selectAllVehicles")}
                          </Button>
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => { const toRemove = new Set(availableVehicles.filter(v => v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) || v.plate.toLowerCase().includes(vehicleSearch.toLowerCase())).map(v => v.id)); setSelectedVehicleIds(selectedVehicleIds.filter(id => !toRemove.has(id))); }}>
                            {t("team.editDialog.deselectAllVehicles")}
                          </Button>
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-1">
                          {availableVehicles.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("team.roleContext.noVehiclesAvailable")}
                            </p>
                          ) : filteredVehicles.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("team.roleContext.noVehiclesForFilter")}
                            </p>
                          ) : (
                            filteredVehicles.map(v => (
                              <div key={v.id} className="flex items-center space-x-2 py-1.5">
                                <Checkbox
                                  id={`vehicle-${v.id}`}
                                  checked={selectedVehicleIds.includes(v.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedVehicleIds(checked === true
                                      ? [...selectedVehicleIds, v.id]
                                      : selectedVehicleIds.filter(id => id !== v.id));
                                  }}
                                />
                                <label htmlFor={`vehicle-${v.id}`} className="text-sm cursor-pointer flex-1">
                                  {v.name} <span className="text-muted-foreground">({v.plate})</span>
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {hasAssignedScope && !disableRoleAndAccess && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t("team.editDialog.assignedDrivers")}</CardTitle>
                        <CardDescription>{t("team.editDialog.assignedDriversHint")}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder={t("team.editDialog.driverSearchPlaceholder")}
                            value={driverSearch}
                            onChange={(e) => setDriverSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => setSelectedDriverIds([...new Set([...selectedDriverIds, ...availableDrivers.filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase())).map(d => d.id)])])}>
                            {t("team.editDialog.selectAllDrivers")}
                          </Button>
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => { const toRemove = new Set(availableDrivers.filter(d => d.name.toLowerCase().includes(driverSearch.toLowerCase())).map(d => d.id)); setSelectedDriverIds(selectedDriverIds.filter(id => !toRemove.has(id))); }}>
                            {t("team.editDialog.deselectAllDrivers")}
                          </Button>
                        </div>
                        <div className="max-h-48 overflow-y-auto rounded-md border p-3 space-y-1">
                          {availableDrivers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("team.roleContext.noDriversAvailable")}
                            </p>
                          ) : filteredDrivers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("team.roleContext.noDriversForFilter")}
                            </p>
                          ) : (
                            filteredDrivers.map(d => (
                              <div key={d.id} className="flex items-center space-x-2 py-1.5">
                                <Checkbox
                                  id={`driver-${d.id}`}
                                  checked={selectedDriverIds.includes(d.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedDriverIds(checked === true
                                      ? [...selectedDriverIds, d.id]
                                      : selectedDriverIds.filter(id => id !== d.id));
                                  }}
                                />
                                <label htmlFor={`driver-${d.id}`} className="text-sm cursor-pointer flex-1">
                                  {d.name}
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting
                        ? t("team.editDialog.saving")
                        : t("team.editDialog.saveButton")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("team.createUserDialog.cancelButton")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>

          {showRoleSidePanel && (
            <div className="sticky top-0">
              <RoleHelpPanel role={selectedRole} t={t} />
            </div>
          )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

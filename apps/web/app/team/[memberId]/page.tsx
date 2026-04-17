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
import { useTranslation } from "@/i18n/useTranslation";
import {
  organizationAPI,
  customersAPI,
  type Customer,
} from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { rolesAPI, type Role } from "@/lib/api/roles";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  user: { id: string; name: string | null; email: string };
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

export default function EditMemberPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const memberId = typeof params.memberId === "string" ? params.memberId : null;

  const { currentOrganization, user } = useAuth();
  const { can } = usePermissions();
  const [member, setMember] = useState<TeamMember | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingMember, setLoadingMember] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");

  const schema = z
    .object({
      roleId: z.string().min(1, t("team.inviteDialog.validation.roleRequired")),
      fullAccess: z.boolean().default(true),
      customerIds: z.array(z.string()).default([]),
      name: z.string().default(""),
      email: z.string().default(""),
      newPassword: z.string().default(""),
      confirmPassword: z.string().default(""),
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
      fullAccess: true,
      customerIds: [],
      name: "",
      email: "",
      newPassword: "",
      confirmPassword: "",
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
            fullAccess: true,
            customerIds: found.customers?.map((c) => c.id) ?? [],
            name: found.user.name ?? "",
            email: found.user.email,
            newPassword: "",
            confirmPassword: "",
          });
        }
      })
      .catch(() => {
        setMembers([]);
        setMember(null);
      })
      .finally(() => setLoadingMember(false));
  }, [currentOrganization?.id, memberId]);

  const loadCustomers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoadingCustomers(true);
    customersAPI
      .list(currentOrganization.id)
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadMembersAndMember();
  }, [loadMembersAndMember]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    rolesAPI
      .getRoles(currentOrganization.id)
      .then((res) => setRoles(res.data?.roles ?? []))
      .catch(() => setRoles([]));
  }, [currentOrganization?.id]);

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
      });
      toast.success(t("team.toastMessages.memberUpdated"), {
        description: t("team.toastMessages.memberUpdatedDescription"),
      });
      router.push("/team");
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

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("team.title")}</h1>
        <p className="text-muted-foreground">{t("team.selectOrganization")}</p>
      </div>
    );
  }

  if (loadingMember) {
    return (
      <div className="space-y-6 max-w-3xl">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <p className="text-muted-foreground">{t("team.memberNotFound")}</p>
        <Button asChild>
          <Link href="/team">{t("team.backToTeam")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/team">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("team.editDialog.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("team.editDialog.description", {
              name: member.user.name || member.user.email,
            })}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
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
                        <Input type="text" {...field} />
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
                        <Input type="email" {...field} />
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
                      <Input type="password" {...field} />
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
                        <Input type="password" {...field} />
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
                    <FormLabel>{t("team.inviteDialog.roleLabel")}</FormLabel>
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
                        {t("team.inviteDialog.fullAccess")}
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
                        placeholder={t(
                          "team.createUserDialog.customerSearchPlaceholder",
                        )}
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
                      className={`max-h-96 overflow-y-auto rounded-md border p-3 space-y-1 ${
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
                                      ? [
                                          ...new Set([
                                            ...customerIds,
                                            ...idsToAdd,
                                          ]),
                                        ]
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

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? t("team.editDialog.saving")
                    : t("team.editDialog.saveButton")}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/team">
                    {t("team.createUserDialog.cancelButton")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

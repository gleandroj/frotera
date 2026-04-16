"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n/useTranslation";
import {
  organizationAPI,
  customersAPI,
  type Customer,
} from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { usePermissions, Module, Action } from "@/lib/hooks/use-permissions";
import { rolesAPI, type Role } from "@/lib/api/roles";
import { ErrorMessage, Form, Formik } from "formik";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";

interface TeamMember {
  id: string;
  user: { id: string; name: string | null; email: string };
  role: { id: string; name: string; color?: string | null; permissions: Array<{ id: string; module: string; actions: string[]; scope: string }> };
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
    const children = byParent.get(id) ?? [];
    for (const ch of children) {
      result.push(ch.id);
      stack.push(ch.id);
    }
  }
  return result;
}

type EditMemberFormValues = {
  roleId: string;
  fullAccess: boolean;
  customerIds: string[];
  name: string;
  email: string;
  newPassword: string;
  confirmPassword: string;
};

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

  const EditMemberFormSchema = useMemo(
    () =>
      z
        .object({
          roleId: z.string().min(1, t("team.inviteDialog.validation.roleRequired")),
          fullAccess: z.boolean().optional(),
          customerIds: z.array(z.string()).optional(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          newPassword: z.string().min(8).optional().or(z.literal("")),
          confirmPassword: z.string().optional(),
        })
        .refine(
          (data) =>
            !data.newPassword || data.newPassword === data.confirmPassword,
          {
            message: "As senhas não coincidem",
            path: ["confirmPassword"],
          },
        ),
    [t],
  );

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
    rolesAPI.getRoles(currentOrganization.id)
      .then((res) => setRoles(res.data?.roles ?? []))
      .catch(() => setRoles([]));
  }, [currentOrganization?.id]);

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

  const updateMember = async (values: EditMemberFormValues) => {
    if (!currentOrganization || !member) return;
    try {
      await organizationAPI.updateMember(currentOrganization.id, member.id, {
        roleId: values.roleId,
        customerRestricted: !values.fullAccess,
        customerIds: values.fullAccess ? undefined : values.customerIds,
        name: values.name || undefined,
        email:
          values.email !== member.user.email ? values.email : undefined,
        newPassword: values.newPassword || undefined,
      });
      toast.success(t("team.toastMessages.memberUpdated"), {
        description: t("team.toastMessages.memberUpdatedDescription"),
      });
      router.push("/team");
    } catch (err: any) {
      const errorCode = err.response?.data?.errorCode;
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
              err.response?.data?.message ||
              err.message ||
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

      <Formik<EditMemberFormValues>
        key={member.id}
        initialValues={{
          roleId: member.role.id,
          fullAccess: currentUserRestricted ? false : !member.customerRestricted,
          customerIds: member.customers?.map((c) => c.id) ?? [],
          name: member.user.name ?? "",
          email: member.user.email,
          newPassword: "",
          confirmPassword: "",
        }}
        validationSchema={toFormikValidationSchema(EditMemberFormSchema)}
        onSubmit={updateMember}
      >
        {({ values, setFieldValue, handleChange, handleBlur, isSubmitting, errors, touched }) => (
          <Form className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações do Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    type="text"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={errors.name && touched.name ? "border-red-500" : ""}
                  />
                  {errors.name && touched.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={values.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={errors.email && touched.email ? "border-red-500" : ""}
                  />
                  {errors.email && touched.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-newPassword">Nova Senha</Label>
                  <Input
                    id="edit-newPassword"
                    name="newPassword"
                    type="password"
                    value={values.newPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={
                      errors.newPassword && touched.newPassword
                        ? "border-red-500"
                        : ""
                    }
                  />
                  {errors.newPassword && touched.newPassword && (
                    <p className="text-sm text-red-500">{errors.newPassword}</p>
                  )}
                </div>

                {values.newPassword.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-confirmPassword">
                      Confirmar Nova Senha
                    </Label>
                    <Input
                      id="edit-confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={values.confirmPassword}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={
                        errors.confirmPassword && touched.confirmPassword
                          ? "border-red-500"
                          : ""
                      }
                    />
                    {errors.confirmPassword && touched.confirmPassword && (
                      <p className="text-sm text-red-500">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
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
                <div className="space-y-2">
                  <Label htmlFor="edit-role">
                    {t("team.inviteDialog.roleLabel")}
                  </Label>
                  <Select
                    value={values.roleId}
                    onValueChange={(value: string) =>
                      setFieldValue("roleId", value)
                    }
                  >
                    <SelectTrigger
                      id="edit-role"
                      disabled={disableRoleAndAccess}
                      className={
                        errors.roleId && touched.roleId ? "border-red-500" : ""
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ErrorMessage
                    name="roleId"
                    component="div"
                    className="text-sm text-red-500 mt-1"
                  />
                </div>

                {!currentUserRestricted && !disableRoleAndAccess && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-fullAccess"
                      checked={values.fullAccess}
                      onCheckedChange={(v) => {
                        setFieldValue("fullAccess", v === true);
                        if (v === true) setFieldValue("customerIds", []);
                      }}
                    />
                    <Label
                      htmlFor="edit-fullAccess"
                      className="font-normal cursor-pointer"
                    >
                      {t("team.inviteDialog.fullAccess")}
                    </Label>
                  </div>
                )}

                {(currentUserRestricted ||
                  disableRoleAndAccess ||
                  !values.fullAccess) && (
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
                          onChange={(e) =>
                            setCustomerSearch(e.target.value)
                          }
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
                              c.parentId != null &&
                              values.customerIds.includes(c.parentId)
                                ? []
                                : [
                                    c.id,
                                    ...getDescendantIds(c.id, customers),
                                  ],
                            );
                            setFieldValue("customerIds", [
                              ...new Set([...values.customerIds, ...idsToAdd]),
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
                            setFieldValue(
                              "customerIds",
                              values.customerIds.filter(
                                (id) => !idsToRemove.has(id),
                              ),
                            );
                          }}
                        >
                          {t("team.createUserDialog.deselectAllCustomers")}
                        </Button>
                      </div>
                      <div
                        className={`max-h-96 overflow-y-auto rounded-md border p-3 space-y-1 ${
                          disableRoleAndAccess
                            ? "pointer-events-none opacity-60"
                            : ""
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
                              c.parentId != null &&
                              values.customerIds.includes(c.parentId);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center space-x-2 py-1.5"
                                style={{
                                  paddingLeft: (c.depth ?? 0) * 16,
                                }}
                              >
                                <Checkbox
                                  id={`edit-customer-${c.id}`}
                                  checked={values.customerIds.includes(c.id)}
                                  disabled={
                                    disableRoleAndAccess || parentSelected
                                  }
                                  onCheckedChange={(v) => {
                                    if (
                                      disableRoleAndAccess ||
                                      parentSelected
                                    )
                                      return;
                                    const idsToAdd =
                                      v === true
                                        ? [
                                            c.id,
                                            ...getDescendantIds(
                                              c.id,
                                              customers,
                                            ),
                                          ]
                                        : [];
                                    const idsToRemove =
                                      v === false
                                        ? [
                                            c.id,
                                            ...getDescendantIds(
                                              c.id,
                                              customers,
                                            ),
                                          ]
                                        : [];
                                    const next =
                                      v === true
                                        ? [
                                            ...new Set([
                                              ...values.customerIds,
                                              ...idsToAdd,
                                            ]),
                                          ]
                                        : values.customerIds.filter(
                                            (id) => !idsToRemove.includes(id),
                                          );
                                    setFieldValue("customerIds", next);
                                  }}
                                />
                                <Label
                                  htmlFor={`edit-customer-${c.id}`}
                                  className={`font-normal text-sm flex-1 ${
                                    disableRoleAndAccess || parentSelected
                                      ? "cursor-not-allowed opacity-70"
                                      : "cursor-pointer"
                                  }`}
                                >
                                  {c.name}
                                </Label>
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
          </Form>
        )}
      </Formik>
    </div>
  );
}

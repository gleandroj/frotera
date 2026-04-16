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
import { organizationAPI, customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { rolesAPI, type Role } from "@/lib/api/roles";
import { ErrorMessage, Field, Form, Formik } from "formik";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";

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

type CreateUserFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  roleId: string;
  fullAccess: boolean;
  customerIds: string[];
};

export default function NewUserPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization, user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [currentUserRestricted, setCurrentUserRestricted] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [defaultRoleId, setDefaultRoleId] = useState("");

  const CreateUserFormSchema = useMemo(
    () =>
      z
        .object({
          email: z
            .string({
              required_error: t("team.createUserDialog.validation.emailRequired"),
              invalid_type_error: t("team.createUserDialog.validation.emailInvalid"),
            })
            .email(t("team.createUserDialog.validation.emailInvalid"))
            .max(254, t("team.createUserDialog.validation.emailTooLong")),
          password: z
            .string({
              required_error: t("team.createUserDialog.validation.passwordRequired"),
            })
            .min(8, t("team.createUserDialog.validation.passwordMinLength")),
          confirmPassword: z.string({
            required_error: t("team.createUserDialog.validation.confirmPasswordRequired"),
          }),
          name: z.string().optional(),
          roleId: z.string().min(1, t("team.createUserDialog.validation.roleRequired")),
          fullAccess: z.boolean().optional(),
          customerIds: z.array(z.string()).optional(),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("team.createUserDialog.validation.confirmPasswordMatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

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
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    if (!currentOrganization?.id) return;
    rolesAPI.getRoles(currentOrganization.id)
      .then((res) => {
        const list = res.data?.roles ?? [];
        setRoles(list);
        if (list.length > 0) setDefaultRoleId(list[0].id);
      })
      .catch(() => setRoles([]));
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (!currentOrganization?.id || !user?.id) return;
    organizationAPI
      .getMembers(currentOrganization.id)
      .then((res) => {
        const members = res.data?.memberships ?? [];
        const me = members.find((m: { user: { id: string } }) => m.user.id === user.id);
        setCurrentUserRestricted(me?.customerRestricted === true);
      })
      .catch(() => setCurrentUserRestricted(false));
  }, [currentOrganization?.id, user?.id]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("team.title")}</h1>
        <p className="text-muted-foreground">{t("team.selectOrganization")}</p>
      </div>
    );
  }

  const createUser = async (
    values: CreateUserFormValues,
    { setSubmitting }: { setSubmitting: (v: boolean) => void },
  ) => {
    try {
      setSubmitting(true);
      await organizationAPI.createMember(currentOrganization.id, {
        email: values.email,
        password: values.password,
        name: values.name?.trim() || undefined,
        roleId: values.roleId,
        customerRestricted: !values.fullAccess,
        customerIds: values.fullAccess ? undefined : values.customerIds,
      });
      toast.success(t("team.toastMessages.userCreated"), {
        description: t("team.toastMessages.userCreatedDescription"),
      });
      router.push("/team");
    } catch (err: any) {
      const errorCode = err.response?.data?.errorCode;
      const errorMessage =
        err.response?.data?.message || err.message || t("team.errorMessages.failedToCreateUser");

      switch (errorCode) {
        case "PLAN_LIMIT_EXCEEDED":
          toast.error(t("errors.memberLimitExceeded"), {
            description: t("errors.upgradeRequired"),
            action: {
              label: t("dashboard.planLimits.needMore.upgrade"),
              onClick: () => router.push("/settings/billing"),
            },
          });
          break;
        case "USER_ALREADY_EXISTS":
          toast.error(t("team.errorMessages.userAlreadyExists"), {
            description: t("team.errorMessages.userAlreadyExistsDescription"),
          });
          break;
        case "MEMBER_CANNOT_GRANT_FULL_ACCESS":
          toast.error(t("team.errorMessages.cannotGrantFullAccess"), {
            description: t("team.errorMessages.cannotGrantFullAccessDescription"),
          });
          break;
        default:
          toast.error(t("team.toastMessages.error"), { description: errorMessage });
          break;
      }
    } finally {
      setSubmitting(false);
    }
  };

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
            {t("team.createUserDialog.newUserPageTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("team.createUserDialog.newUserPageDescription")}
          </p>
        </div>
      </div>

      <Formik
        key={defaultRoleId}
        initialValues={{
          email: "",
          password: "",
          confirmPassword: "",
          name: "",
          roleId: defaultRoleId,
          fullAccess: !currentUserRestricted,
          customerIds: [] as string[],
        }}
        validationSchema={toFormikValidationSchema(CreateUserFormSchema)}
        onSubmit={createUser}
      >
        {({ values, setFieldValue, isSubmitting, errors, touched }) => (
          <Form className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("team.createUserDialog.title")}</CardTitle>
                <CardDescription>
                  {t("team.createUserDialog.description", {
                    organizationName: currentOrganization.name,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("team.createUserDialog.emailLabel")}</Label>
                    <Field
                      as={Input}
                      id="email"
                      name="email"
                      type="email"
                      placeholder={t("team.createUserDialog.emailPlaceholder")}
                      className={errors.email && touched.email ? "border-red-500" : ""}
                    />
                    <ErrorMessage
                      name="email"
                      component="div"
                      className="text-sm text-red-500 mt-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("team.createUserDialog.nameLabel")}</Label>
                    <Field
                      as={Input}
                      id="name"
                      name="name"
                      type="text"
                      placeholder={t("team.createUserDialog.namePlaceholder")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("team.createUserDialog.passwordLabel")}</Label>
                    <Field
                      as={Input}
                      id="password"
                      name="password"
                      type="password"
                      placeholder={t("team.createUserDialog.passwordPlaceholder")}
                      className={errors.password && touched.password ? "border-red-500" : ""}
                    />
                    <ErrorMessage
                      name="password"
                      component="div"
                      className="text-sm text-red-500 mt-1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">
                      {t("team.createUserDialog.confirmPasswordLabel")}
                    </Label>
                    <Field
                      as={Input}
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder={t("team.createUserDialog.confirmPasswordPlaceholder")}
                      className={
                        errors.confirmPassword && touched.confirmPassword ? "border-red-500" : ""
                      }
                    />
                    <ErrorMessage
                      name="confirmPassword"
                      component="div"
                      className="text-sm text-red-500 mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">{t("team.createUserDialog.roleLabel")}</Label>
                  <Select
                    value={values.roleId}
                    onValueChange={(value: string) => setFieldValue("roleId", value)}
                  >
                    <SelectTrigger
                      className={errors.roleId && touched.roleId ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder={t("team.createUserDialog.roleLabel")} />
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

                {!currentUserRestricted && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fullAccess"
                      checked={values.fullAccess}
                      onCheckedChange={(v) => {
                        setFieldValue("fullAccess", v === true);
                        if (v === true) setFieldValue("customerIds", []);
                      }}
                    />
                    <Label htmlFor="fullAccess" className="font-normal cursor-pointer">
                      {t("team.createUserDialog.fullAccess")}
                    </Label>
                  </div>
                )}

                {(currentUserRestricted || !values.fullAccess) && (
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
                              c.parentId != null && values.customerIds.includes(c.parentId)
                                ? []
                                : [c.id, ...getDescendantIds(c.id, customers)],
                            );
                            setFieldValue(
                              "customerIds",
                              [...new Set([...values.customerIds, ...idsToAdd])],
                            );
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
                              values.customerIds.filter((id) => !idsToRemove.has(id)),
                            );
                          }}
                        >
                          {t("team.createUserDialog.deselectAllCustomers")}
                        </Button>
                      </div>
                      <div className="max-h-96 overflow-y-auto rounded-md border p-3 space-y-1">
                        {loadingCustomers ? (
                          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                        ) : filteredCustomers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {customerSearch.trim()
                              ? t("common.noResults")
                              : t("customers.noCustomers")}
                          </p>
                        ) : (
                          filteredCustomers.map((c) => {
                            const parentSelected =
                              c.parentId != null && values.customerIds.includes(c.parentId);
                            return (
                              <div
                                key={c.id}
                                className="flex items-center space-x-2 py-1.5"
                                style={{ paddingLeft: (c.depth ?? 0) * 16 }}
                              >
                                <Checkbox
                                  id={`customer-${c.id}`}
                                  checked={values.customerIds.includes(c.id)}
                                  disabled={parentSelected}
                                  onCheckedChange={(v) => {
                                    const idsToAdd =
                                      v === true
                                        ? [c.id, ...getDescendantIds(c.id, customers)]
                                        : [];
                                    const idsToRemove =
                                      v === false
                                        ? [c.id, ...getDescendantIds(c.id, customers)]
                                        : [];
                                    const next =
                                      v === true
                                        ? [...new Set([...values.customerIds, ...idsToAdd])]
                                        : values.customerIds.filter(
                                            (id) => !idsToRemove.includes(id),
                                          );
                                    setFieldValue("customerIds", next);
                                  }}
                                />
                                <Label
                                  htmlFor={`customer-${c.id}`}
                                  className={`font-normal text-sm flex-1 ${
                                    parentSelected
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
                      ? t("team.createUserDialog.creating")
                      : t("team.createUserDialog.createButton")}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/team">{t("team.createUserDialog.cancelButton")}</Link>
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

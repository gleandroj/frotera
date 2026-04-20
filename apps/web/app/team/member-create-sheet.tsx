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
import { organizationAPI, customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { rolesAPI, type Role } from "@/lib/api/roles";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const FRIENDLY_PASSWORD_WORDS = [
  "rota",
  "pneu",
  "carga",
  "motor",
  "eixo",
  "placa",
  "diesel",
  "tanque",
  "chassi",
  "freio",
];

const FRIENDLY_PASSWORD_JOINERS = [".", "-", "_", "@"];
const FRIENDLY_PASSWORD_SUFFIXES = [
  "go",
  "rio",
  "sol",
  "lua",
  "mar",
  "zen",
  "via",
  "pro",
];

function randomInt(max: number): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pickRandom<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function generateFriendlyPassword(): string {
  const digits = "23456789";
  const word = pickRandom(FRIENDLY_PASSWORD_WORDS);
  const joiner = pickRandom(FRIENDLY_PASSWORD_JOINERS);
  const suffix = pickRandom(FRIENDLY_PASSWORD_SUFFIXES);
  const d1 = digits[randomInt(digits.length)];
  const d2 = digits[randomInt(digits.length)];
  return `${word}${joiner}${suffix}${d1}${d2}`;
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

interface MemberCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MemberCreateSheet({
  open,
  onOpenChange,
  onSuccess,
}: MemberCreateSheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentOrganization, user, selectedCustomerId } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [currentUserRestricted, setCurrentUserRestricted] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);

  const schema = z
    .object({
      email: z
        .string({ required_error: t("team.createUserDialog.validation.emailRequired") })
        .email(t("team.createUserDialog.validation.emailInvalid"))
        .max(254, t("team.createUserDialog.validation.emailTooLong")),
      sendCredentials: z.boolean().default(false),
      password: z
        .string({ required_error: t("team.createUserDialog.validation.passwordRequired") })
        .min(8, t("team.createUserDialog.validation.passwordMinLength")),
      confirmPassword: z.string({
        required_error: t("team.createUserDialog.validation.confirmPasswordRequired"),
      }),
      name: z.string().default(""),
      roleId: z.string().min(1, t("team.createUserDialog.validation.roleRequired")),
      fullAccess: z.boolean().default(false),
      customerIds: z.array(z.string()).default([]),
      isSuperAdmin: z.boolean().default(false),
      isSystemUser: z.boolean().default(false),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("team.createUserDialog.validation.confirmPasswordMatch"),
      path: ["confirmPassword"],
    })
    .refine(
      (data) => data.fullAccess || data.customerIds.length > 0,
      {
        message: t("team.createUserDialog.validation.customerAccessRequired"),
        path: ["customerIds"],
      },
    );

  type CreateUserFormValues = z.infer<typeof schema>;

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      sendCredentials: false,
      password: "",
      confirmPassword: "",
      name: "",
      roleId: "",
      fullAccess: false,
      customerIds: [],
      isSuperAdmin: false,
      isSystemUser: false,
    },
  });

  const { isSubmitting } = form.formState;
  const fullAccess = form.watch("fullAccess");
  const customerIds = form.watch("customerIds");
  const sendCredentials = form.watch("sendCredentials");

  const loadCustomers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoadingCustomers(true);
    customersAPI
      .list(
        currentOrganization.id,
        selectedCustomerId ? { customerId: selectedCustomerId } : undefined,
      )
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch(() => setCustomers([]))
      .finally(() => setLoadingCustomers(false));
  }, [currentOrganization?.id, selectedCustomerId]);

  useEffect(() => {
    if (!open) return;
    loadCustomers();
  }, [open, loadCustomers]);

  useEffect(() => {
    if (!open || !currentOrganization?.id) return;
    rolesAPI.getRoles(currentOrganization.id).then((res) => {
      const list = res.data?.roles ?? [];
      setRoles(list);
      if (list.length > 0) {
        form.setValue("roleId", list[0].id);
      }
    }).catch(() => setRoles([]));
  }, [open, currentOrganization?.id]);

  useEffect(() => {
    if (!open || !currentOrganization?.id || !user?.id) return;
    organizationAPI.getMembers(currentOrganization.id).then((res) => {
      const members = res.data?.memberships ?? [];
      const me = members.find((m: { user: { id: string } }) => m.user.id === user.id);
      setCurrentUserRestricted(me?.customerRestricted === true);
    }).catch(() => setCurrentUserRestricted(false));
  }, [open, currentOrganization?.id, user?.id]);

  useEffect(() => {
    if (!open) {
      form.reset({
        email: "",
        sendCredentials: false,
        password: "",
        confirmPassword: "",
        name: "",
        roleId: "",
        fullAccess: false,
        customerIds: [],
        isSuperAdmin: false,
        isSystemUser: false,
      });
      setCustomerSearch("");
    }
  }, [open]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.trim().toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const handleSubmit = async (values: CreateUserFormValues) => {
    try {
      await organizationAPI.createMember(currentOrganization!.id, {
        email: values.email,
        password: values.password,
        name: values.name?.trim() || undefined,
        roleId: values.roleId,
        customerRestricted: !values.fullAccess,
        customerIds: values.fullAccess ? undefined : values.customerIds,
        isSuperAdmin: user?.isSuperAdmin ? values.isSuperAdmin : undefined,
        isSystemUser: user?.isSuperAdmin ? values.isSystemUser : undefined,
        sendCredentials: values.sendCredentials || undefined,
      });
      toast.success(t("team.toastMessages.userCreated"), {
        description: t("team.toastMessages.userCreatedDescription"),
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errorCode?: string; message?: string } }; message?: string };
      const errorCode = e.response?.data?.errorCode;
      const errorMessage = e.response?.data?.message || e.message || t("team.errorMessages.failedToCreateUser");

      switch (errorCode) {
        case "PLAN_LIMIT_EXCEEDED":
          toast.error(t("errors.memberLimitExceeded"), {
            description: t("errors.upgradeRequired"),
            action: {
              label: t("errors.upgradeAction"),
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
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("team.createUserDialog.newUserPageTitle")}</SheetTitle>
          <SheetDescription>
            {t("team.createUserDialog.description", {
              organizationName: currentOrganization?.name ?? "",
            })}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, onRhfInvalidSubmit(form, t))}
            className="space-y-6 mt-6"
            autoComplete="off"
          >
            <Card>
              <CardHeader>
                <CardTitle>{t("team.createUserDialog.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("team.createUserDialog.emailLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t("team.createUserDialog.emailPlaceholder")}
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("team.createUserDialog.nameLabel")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("team.createUserDialog.namePlaceholder")}
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="sendCredentials"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => {
                            field.onChange(v === true);
                            if (v === true) {
                              const pwd = generateFriendlyPassword();
                              form.setValue("password", pwd);
                              form.setValue("confirmPassword", pwd);
                            } else {
                              form.setValue("password", "");
                              form.setValue("confirmPassword", "");
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        Enviar credenciais por email (senha temporária)
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {sendCredentials ? (
                  <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                    <p className="text-sm font-medium">Senha temporária gerada</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-background border px-3 py-2 text-base font-mono tracking-widest">
                        {form.watch("password")}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const pwd = generateFriendlyPassword();
                          form.setValue("password", pwd);
                          form.setValue("confirmPassword", pwd);
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Esta senha será enviada ao usuário por email. Ele deverá alterá-la no primeiro acesso.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("team.createUserDialog.passwordLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t("team.createUserDialog.passwordPlaceholder")}
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("team.createUserDialog.confirmPasswordLabel")}</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={t("team.createUserDialog.confirmPasswordPlaceholder")}
                              autoComplete="new-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team.createUserDialog.roleLabel")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("team.createUserDialog.roleLabel")} />
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

                {!currentUserRestricted && (
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

                {(currentUserRestricted || !fullAccess) && (
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
                      <FormField
                        control={form.control}
                        name="customerIds"
                        render={() => (
                          <FormItem className="space-y-0">
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                      <div className="max-h-64 overflow-y-auto rounded-md border p-3 space-y-1">
                        {loadingCustomers ? (
                          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                        ) : filteredCustomers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {customerSearch.trim() ? t("common.noResults") : t("customers.noCustomers")}
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
                                  id={`create-customer-${c.id}`}
                                  checked={customerIds.includes(c.id)}
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
                                    form.setValue(
                                      "customerIds",
                                      v === true
                                        ? [...new Set([...customerIds, ...idsToAdd])]
                                        : customerIds.filter((id) => !idsToRemove.includes(id)),
                                    );
                                  }}
                                />
                                <label
                                  htmlFor={`create-customer-${c.id}`}
                                  className={`font-normal text-sm flex-1 ${
                                    parentSelected ? "cursor-not-allowed opacity-70" : "cursor-pointer"
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
                      ? t("team.createUserDialog.creating")
                      : t("team.createUserDialog.createButton")}
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
      </SheetContent>
    </Sheet>
  );
}

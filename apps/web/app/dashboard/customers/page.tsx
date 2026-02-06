"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFormDialog } from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";
import { Pencil, Trash2 } from "lucide-react";

export default function CustomersPage() {
  const { t } = useTranslation();
  const { currentOrganization, selectedCustomerId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);

  const fetchCustomers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    customersAPI
      .list(currentOrganization.id, {
        customerId: selectedCustomerId ?? undefined,
      })
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? t("common.error"));
      })
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, t]);

  useEffect(() => {
    if (!currentOrganization?.id) {
      setLoading(false);
      return;
    }
    fetchCustomers();
  }, [currentOrganization?.id, fetchCustomers]);

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("navigation.items.customers")}
        </h1>
        <p className="text-muted-foreground">
          {t("vehicles.selectOrganization")}
        </p>
      </div>
    );
  }

  const getParentName = (parentId: string | null | undefined) => {
    if (!parentId) return "—";
    const parent = customers.find((c) => c.id === parentId);
    return parent?.name ?? parentId;
  };

  const indentPx = 24;
  const rootDepth = 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("navigation.items.customers")}
          </h1>
          <p className="text-muted-foreground">
            {t("customers.listDescription")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          {t("customers.createCustomer")}
        </Button>
      </div>

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && customers.length === 0 && (
        <p className="text-muted-foreground">{t("customers.noCustomers")}</p>
      )}
      {!loading && !error && customers.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 w-[50%] px-3 py-2 text-xs font-medium">
                  {t("common.name")}
                </TableHead>
                <TableHead className="h-9 text-muted-foreground w-[30%] px-3 py-2 text-xs font-medium">
                  {t("customers.parent")}
                </TableHead>
                <TableHead className="h-9 w-[100px] px-3 py-2 text-xs font-medium">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const depth = c.depth ?? 0;
                const isRoot = depth === rootDepth;
                return (
                  <TableRow key={c.id} className={isRoot ? "bg-muted/30" : undefined}>
                    <TableCell className="px-3 py-2">
                      <div
                        className="flex items-center gap-1 min-w-0"
                        style={{ paddingLeft: depth * indentPx }}
                      >
                        {depth > 0 && (
                          <span className="shrink-0 text-muted-foreground/60 select-none text-xs" aria-hidden>
                            └
                          </span>
                        )}
                        <span className="font-medium truncate text-sm">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-muted-foreground text-sm">
                      {getParentName(c.parentId)}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditCustomer(c)}
                          aria-label={t("common.edit")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteCustomer(c)}
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customer={null}
        organizationId={currentOrganization.id}
        customers={customers}
        onSuccess={fetchCustomers}
      />
      <CustomerFormDialog
        open={!!editCustomer}
        onOpenChange={(open) => !open && setEditCustomer(null)}
        customer={editCustomer ?? null}
        organizationId={currentOrganization.id}
        customers={customers}
        onSuccess={fetchCustomers}
      />
      <DeleteCustomerDialog
        open={!!deleteCustomer}
        onOpenChange={(open) => !open && setDeleteCustomer(null)}
        customer={deleteCustomer}
        organizationId={currentOrganization.id}
        onSuccess={fetchCustomers}
      />
    </div>
  );
}

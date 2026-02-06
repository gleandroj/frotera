"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { getCustomerColumns } from "./columns";
import { CustomerFormDialog } from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";

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

  const columns = useMemo(
    () =>
      getCustomerColumns(t, {
        customers,
        onEdit: setEditCustomer,
        onDelete: setDeleteCustomer,
      }),
    [t, customers],
  );

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
        <DataTable<Customer, unknown>
          columns={columns}
          data={customers}
          filterPlaceholder={t("customers.filterByName")}
          filterColumnId="name"
          noResultsLabel={t("customers.noResults")}
        />
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

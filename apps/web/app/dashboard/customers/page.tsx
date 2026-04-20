"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { Action, Module, usePermissions } from "@/lib/hooks/use-permissions";
import { customersAPI, type Customer } from "@/lib/frontend/api-client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import {
  RecordStatusFilter,
  RECORD_STATUS_ACTIVE,
  listParamsForRecordStatus,
  type RecordListStatus,
} from "@/components/list-filters/record-status-filter";
import { getCustomerColumns } from "./columns";
import { CustomerFormDialog } from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";

export default function CustomersPage() {
  const { t } = useTranslation();
  const { user, currentOrganization, selectedCustomerId } = useAuth();
  const { can } = usePermissions();
  const canEditCustomer = can(Module.COMPANIES, Action.EDIT);
  const canDeleteCustomer = can(Module.COMPANIES, Action.DELETE);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null);
  const [listStatus, setListStatus] = useState<RecordListStatus>(RECORD_STATUS_ACTIVE);

  const fetchCustomers = useCallback(() => {
    if (!currentOrganization?.id) return;
    setLoading(true);
    setError(null);
    customersAPI
      .list(
        currentOrganization.id,
        listParamsForRecordStatus(listStatus, selectedCustomerId ?? undefined),
      )
      .then((res) => {
        const list = res.data?.customers ?? [];
        setCustomers(Array.isArray(list) ? list : []);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? t("common.error"));
      })
      .finally(() => setLoading(false));
  }, [currentOrganization?.id, selectedCustomerId, listStatus, t]);

  const handleReactivate = useCallback(
    async (customer: Customer) => {
      if (!currentOrganization?.id) return;
      try {
        await customersAPI.update(currentOrganization.id, customer.id, {
          inactive: false,
        });
        toast.success(t("customers.reactivated"));
        fetchCustomers();
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? t("common.error"));
      }
    },
    [currentOrganization?.id, fetchCustomers, t],
  );

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
        onReactivate: handleReactivate,
        canEditCustomer,
        canDeleteCustomer,
        isSuperAdmin: user?.isSuperAdmin === true,
        isOrganizationOwner: currentOrganization?.role?.key === 'ORGANIZATION_OWNER',
      }),
    [t, customers, handleReactivate, canEditCustomer, canDeleteCustomer, user?.isSuperAdmin, currentOrganization?.role?.key],
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
        {(currentOrganization?.role?.permissions?.some((p: any) => p.module === "COMPANIES" && p.actions.includes("CREATE")) ?? false) && (
          <Button onClick={() => setCreateOpen(true)}>
            {t("customers.createCustomer")}
          </Button>
        )}
      </div>

      {loading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && (
        <DataTable<Customer, unknown>
          columns={columns}
          data={customers}
          filterPlaceholder={t("common.search")}
          filterColumnId="name"
          noResultsLabel={
            customers.length === 0
              ? t("customers.noCustomers")
              : t("customers.noResults")
          }
          toolbarLeading={
            <RecordStatusFilter
              id="customers-list-status"
              value={listStatus}
              onValueChange={setListStatus}
            />
          }
        />
      )}

      <CustomerFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        customer={null}
        organizationId={currentOrganization.id}
        customers={customers}
        onSuccess={fetchCustomers}
        defaultParentId={selectedCustomerId ?? undefined}
        allowRootCreation={user?.isSuperAdmin === true || currentOrganization?.role?.key === 'ORGANIZATION_OWNER'}
      />
      <CustomerFormDialog
        open={!!editCustomer}
        onOpenChange={(open) => !open && setEditCustomer(null)}
        customer={editCustomer ?? null}
        organizationId={currentOrganization.id}
        customers={customers}
        onSuccess={fetchCustomers}
        defaultParentId={selectedCustomerId ?? undefined}
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

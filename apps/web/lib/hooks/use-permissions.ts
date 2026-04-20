"use client";

import { useAuth } from "./use-auth";

export enum Module {
  VEHICLES  = 'VEHICLES',
  TRACKING  = 'TRACKING',
  TRACKER_DISCOVERIES = 'TRACKER_DISCOVERIES',
  COMPANIES = 'COMPANIES',
  USERS     = 'USERS',
  REPORTS   = 'REPORTS',
  DRIVERS   = 'DRIVERS',
  DOCUMENTS = 'DOCUMENTS',
  FUEL      = 'FUEL',
  CHECKLIST = 'CHECKLIST',
  INCIDENTS = 'INCIDENTS',
  TELEMETRY = 'TELEMETRY',
  FINANCIAL = 'FINANCIAL',
  DASHBOARD = 'DASHBOARD',
  REPORTS_FUEL_CONSUMPTION = 'REPORTS_FUEL_CONSUMPTION',
  REPORTS_FUEL_COSTS       = 'REPORTS_FUEL_COSTS',
  REPORTS_FUEL_BENCHMARK   = 'REPORTS_FUEL_BENCHMARK',
  REPORTS_FUEL_EFFICIENCY  = 'REPORTS_FUEL_EFFICIENCY',
  REPORTS_FUEL_SUMMARY     = 'REPORTS_FUEL_SUMMARY',
  CHECKLIST_TEMPLATES      = 'CHECKLIST_TEMPLATES',
}

export enum Action {
  VIEW   = 'VIEW',
  CREATE = 'CREATE',
  EDIT   = 'EDIT',
  DELETE = 'DELETE',
}

export enum Scope {
  ALL      = 'ALL',
  ASSIGNED = 'ASSIGNED',
}

const ORGANIZATION_OWNER_KEY = "ORGANIZATION_OWNER";

export function usePermissions() {
  const { user, currentOrganization, organizations } = useAuth();

  /** Tracker SMS / server reference — visible only to privileged accounts. */
  const canAccessTrackerHelp =
    user?.isSuperAdmin === true ||
    user?.isSystemUser === true ||
    currentOrganization?.role?.key === ORGANIZATION_OWNER_KEY;

  function can(module: Module, action: Action): boolean {
    if (!currentOrganization) return false;
    if (user?.isSuperAdmin) return true;

    const role = currentOrganization.role;
    if (!role || !role.permissions) return false;

    const perm = role.permissions.find((p) => p.module === module);
    return perm?.actions?.includes(action) ?? false;
  }

  function canAny(module: Module, actions: Action[]): boolean {
    return actions.some((action) => can(module, action));
  }

  function canAnyModule(modules: Module[], action: Action): boolean {
    return modules.some((module) => can(module, action));
  }

  function getScope(module: Module): Scope | null {
    if (!currentOrganization) return null;
    if (user?.isSuperAdmin) return Scope.ALL;
    const role = currentOrganization.role;
    if (!role || !role.permissions) return null;
    const perm = role.permissions.find((p) => p.module === module);
    return (perm?.scope as Scope) ?? null;
  }

  function canGlobal(module: Module, action: Action): boolean {
    if (user?.isSuperAdmin) return true;

    return organizations.some((organization) => {
      const role = organization.role;
      if (!role?.permissions) return false;
      const perm = role.permissions.find((p) => p.module === module);
      return perm?.actions?.includes(action) ?? false;
    });
  }

  function getRoleName(): string {
    return currentOrganization?.role?.name ?? '';
  }

  function getRoleColor(): string | null {
    return currentOrganization?.role?.color ?? null;
  }

  const canManageUsers = can(Module.USERS, Action.CREATE);
  const canEditUsers = can(Module.USERS, Action.EDIT);
  const canDeleteUsers = can(Module.USERS, Action.DELETE);

  return {
    can,
    canAny,
    canAnyModule,
    canGlobal,
    getScope,
    getRoleName,
    getRoleColor,
    canManageUsers,
    canEditUsers,
    canDeleteUsers,
    canAccessTrackerHelp,
  };
}

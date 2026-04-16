"use client";

import { useAuth } from "./use-auth";

export enum Module {
  VEHICLES  = 'VEHICLES',
  TRACKING  = 'TRACKING',
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
}

export enum Action {
  VIEW   = 'VIEW',
  CREATE = 'CREATE',
  EDIT   = 'EDIT',
  DELETE = 'DELETE',
}

export function usePermissions() {
  const { user, currentOrganization } = useAuth();

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
    getRoleName,
    getRoleColor,
    canManageUsers,
    canEditUsers,
    canDeleteUsers,
  };
}

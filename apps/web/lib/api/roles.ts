import { externalApi } from "@/lib/frontend/api-client";

export interface RolePermission {
  id: string;
  module: string;
  actions: string[];
  scope: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  color?: string | null;
  organizationId?: string | null;
  permissions: RolePermission[];
  createdAt: string;
  updatedAt: string;
}

export const rolesAPI = {
  getRoles: (organizationId: string) =>
    externalApi.get<{ roles: Role[] }>(`/api/organizations/${organizationId}/roles`),

  getRole: (organizationId: string, roleId: string) =>
    externalApi.get<Role>(`/api/organizations/${organizationId}/roles/${roleId}`),

  createRole: (
    organizationId: string,
    data: {
      name: string;
      description?: string;
      color?: string;
      permissions: Array<{ module: string; actions: string[]; scope: string }>;
    }
  ) =>
    externalApi.post<{ message: string; role: Role }>(
      `/api/organizations/${organizationId}/roles`,
      data
    ),

  updateRole: (
    organizationId: string,
    roleId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      permissions?: Array<{ module: string; actions: string[]; scope: string }>;
    }
  ) =>
    externalApi.patch<{ message: string; role: Role }>(
      `/api/organizations/${organizationId}/roles/${roleId}`,
      data
    ),

  deleteRole: (organizationId: string, roleId: string) =>
    externalApi.delete<{ message: string }>(
      `/api/organizations/${organizationId}/roles/${roleId}`
    ),
};

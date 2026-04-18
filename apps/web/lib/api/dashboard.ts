import { apiClient } from "../frontend/api-client";

export interface DashboardStats {
  teamMembers: number;
  vehiclesActive: number;
  driversActive: number;
  trackers: number;
  customers: number;
  openIncidents: number;
}

export interface DashboardResponse {
  message: string;
  data: DashboardStats;
}

export async function getDashboardStats(
  organizationId: string
): Promise<DashboardResponse> {
  const res = await apiClient.get<DashboardResponse>(
    `/api/organizations/${organizationId}/dashboard`
  );
  return res.data;
}

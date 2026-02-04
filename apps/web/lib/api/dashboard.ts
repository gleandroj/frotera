import { apiClient } from "../frontend/api-client";

export interface DashboardStats {
  teamMembers: number;
  pendingInvitations: number;
}

export interface DashboardResponse {
  message: string;
  data: DashboardStats;
}

export interface PlanLimitsOverview {
  subscription?: {
    planName: string;
    planType: string;
    billingInterval: string;
    status: string;
  };
  limits: {
    maxTeamMembers?: number | null;
  } | null;
  usage: {
    currentTeamMembers: number;
  };
  availableSlots: {
    teamMembers: number | null;
  } | null;
}

export async function getDashboardStats(
  organizationId: string
): Promise<DashboardResponse> {
  return apiClient.get<DashboardResponse>(
    `/organizations/${organizationId}/dashboard`
  );
}

export async function getPlanLimitsOverview(
  organizationId: string
): Promise<{ message: string; data: PlanLimitsOverview }> {
  return apiClient.get<{ message: string; data: PlanLimitsOverview }>(
    `/organizations/${organizationId}/dashboard/plan-limits`
  );
}

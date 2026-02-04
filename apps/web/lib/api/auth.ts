// Auth API client
import { externalApi } from "../../lib/frontend/api-client";

// Types
export interface ForgotPasswordRequest {
  email: string;
  language?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  message: string;
}

const BASE = "/api/auth";

// API functions
export async function forgotPassword(
  data: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> {
  const response = await externalApi.post(`${BASE}/forgot-password`, data);
  return response.data;
}

export async function resetPassword(
  data: ResetPasswordRequest
): Promise<ResetPasswordResponse> {
  const response = await externalApi.post(`${BASE}/reset-password`, data);
  return response.data;
}

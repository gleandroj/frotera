import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { io, Socket } from "socket.io-client";
import {
  getLocalStorage,
  removeLocalStorage,
  setLocalStorage,
} from "./client-utils";

export const externalApiUrl = process.env.NEXT_PUBLIC_API_URL;
export const internalApiUrl = process.env.NEXT_PUBLIC_APP_URL;

// Create axios instance
export const externalApi = axios.create({
  baseURL: externalApiUrl || "http://localhost:3001",
  timeout: 10000,
});

/** Alias for server-side or legacy usage (e.g. dashboard API) */
export const apiClient = externalApi;

// Create axios instance
export const internalApi = axios.create({
  baseURL: internalApiUrl || "http://localhost:3000",
  timeout: 10000,
});

// Token management
export const getAccessToken = (): string | null => {
  return getLocalStorage("accessToken");
};

export const getRefreshToken = (): string | null => {
  return getLocalStorage("refreshToken");
};

// Export a function to create a socket connection with latest auth/org info
export function buildSocket(orgId: string): Socket {
  return io((externalApiUrl || "http://localhost:3001") + "/messages", {
    autoConnect: false,
    transports: ["websocket", "polling"], // Fallback to polling if websocket fails
    reconnection: false, // We handle reconnection manually for better control
    auth: {
      token: getAccessToken(),
      organizationId: orgId,
    },
  });
}

// Tracker positions WebSocket (namespace /tracker-positions)
export function buildTrackerPositionsSocket(orgId: string): Socket {
  const base = externalApiUrl || "http://localhost:3001";
  return io(base + "/tracker-positions", {
    autoConnect: false,
    transports: ["websocket", "polling"],
    reconnection: true,
    auth: {
      token: getAccessToken(),
      organizationId: orgId,
    },
  });
}

const setTokens = (accessToken: string, refreshToken: string): void => {
  setLocalStorage("accessToken", accessToken);
  setLocalStorage("refreshToken", refreshToken);
};

const clearTokens = (): void => {
  removeLocalStorage("accessToken");
  removeLocalStorage("refreshToken");
};

// Request interceptor to add auth token and locale
externalApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Only add token for requests to our domain
    if (config.url?.startsWith("/")) {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Add locale header for potential future use
    if (typeof document !== "undefined") {
      const locale = document.documentElement.lang || "en";
      config.headers["Accept-Language"] = locale;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

externalApi.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Don't handle 401s for login endpoint
    if (originalRequest.url?.includes("/api/auth/login")) {
      return Promise.reject(error);
    }

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            // Use externalApi instead of undefined api
            return externalApi(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        // No refresh token, redirect to login
        clearTokens();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }

      try {
        // Attempt to refresh the token
        const response = await axios.post(
          `${externalApi.defaults.baseURL}/api/auth/refresh`,
          {
            refreshToken,
          }
        );

        const { accessToken, refreshToken: newRefreshToken } =
          response.data.tokens;

        setTokens(accessToken, newRefreshToken);
        processQueue(null, accessToken);

        // Retry the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        // Use externalApi instead of undefined api
        return externalApi(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null);
        clearTokens();

        if (typeof window !== "undefined") {
          // Show a toast or notification about session expiry
          console.log("Session expired. Please log in again.");
          window.location.href = "/login?expired=true";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle service suspension (503)
    if (error.response?.status === 503) {
      if (typeof window !== "undefined") {
        window.location.href = "/suspended";
      }
      return Promise.reject(error);
    }

    // Handle other errors
    if (error.response?.status === 403) {
      // Forbidden - might need 2FA verification
      const errorData = error.response.data as any;
      if (errorData.error?.includes("2FA")) {
        if (typeof window !== "undefined") {
          window.location.href = "/2fa-verify";
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auth-specific API calls
export const authAPI = {
  login: (email: string, password: string, twoFactorCode?: string) =>
    externalApi.post("/api/auth/login", { email, password, twoFactorCode }),
  signup: (
    email: string, 
    password: string, 
    name?: string, 
    language?: string,
    organizationName?: string
  ) =>
    externalApi.post("/api/auth/signup", { 
      email, 
      password, 
      name, 
      language,
      organizationName
    }),
  logout: () => externalApi.post("/api/auth/logout"),
  refresh: (refreshToken: string) =>
    externalApi.post("/api/auth/refresh", { refreshToken }),
  setup2FA: () => externalApi.post("/api/auth/2fa/setup"),
  verify2FA: (token: string, enable?: boolean) =>
    externalApi.post("/api/auth/2fa/verify", { token, enable }),
  disable2FA: (token: string) =>
    externalApi.post("/api/auth/2fa/disable", { token }),
  verifyEmail: (token: string) =>
    externalApi.post("/api/auth/verify-email", { token }),
  updateLanguage: (language: string) =>
    externalApi.patch("/api/auth/language", { language }),
};

// Organization-specific API calls
export const organizationAPI = {
  create: (
    name: string,
    description?: string,
    priceId?: string,
    paymentMethodId?: string
  ) =>
    externalApi.post("/api/organizations", {
      name,
      description,
      ...(priceId && paymentMethodId && { priceId, paymentMethodId }),
    }),
  getUserOrganizations: () => externalApi.get("/api/organizations"),
  getDetails: (organizationId: string) =>
    externalApi.get(`/api/organizations/${organizationId}`),
  update: (
    organizationId: string,
    data: { name?: string; description?: string }
  ) => externalApi.patch(`/api/organizations/${organizationId}`, data),
  getMembers: (organizationId: string, params?: { customerId?: string | null }) =>
    externalApi.get(`/api/organizations/${organizationId}/members`, {
      params: params?.customerId != null ? { customerId: params.customerId } : undefined,
    }),
  createMember: (
    organizationId: string,
    data: {
      email: string;
      password: string;
      name?: string;
      roleId: string;
      customerRestricted?: boolean;
      customerIds?: string[];
    }
  ) =>
    externalApi.post(
      `/api/organizations/${organizationId}/members`,
      data
    ),
  updateMember: (
    organizationId: string,
    memberId: string,
    data: {
      roleId?: string;
      customerRestricted?: boolean;
      customerIds?: string[];
      name?: string;
      email?: string;
      newPassword?: string;
    }
  ) =>
    externalApi.patch(
      `/api/organizations/${organizationId}/members/${memberId}`,
      data
    ),
  removeMember: (organizationId: string, memberId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/members/${memberId}`
    ),
  getRoles: (organizationId: string) =>
    externalApi.get(`/api/organizations/${organizationId}/roles`),
  getRole: (organizationId: string, roleId: string) =>
    externalApi.get(`/api/organizations/${organizationId}/roles/${roleId}`),
  createRole: (organizationId: string, data: any) =>
    externalApi.post(`/api/organizations/${organizationId}/roles`, data),
  updateRole: (organizationId: string, roleId: string, data: any) =>
    externalApi.patch(`/api/organizations/${organizationId}/roles/${roleId}`, data),
  deleteRole: (organizationId: string, roleId: string) =>
    externalApi.delete(`/api/organizations/${organizationId}/roles/${roleId}`),
};

// Customer type and API
export interface Customer {
  id: string;
  organizationId: string;
  parentId?: string | null;
  name: string;
  depth?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListParams {
  customerId?: string | null;
}

export const customersAPI = {
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get<{ customers: Customer[] }>(
      `/api/organizations/${organizationId}/customers`,
      { params: params?.customerId ? { customerId: params.customerId } : undefined }
    ),
  create: (organizationId: string, data: { name: string; parentId?: string }) =>
    externalApi.post<Customer>(
      `/api/organizations/${organizationId}/customers`,
      data
    ),
  get: (organizationId: string, customerId: string) =>
    externalApi.get<Customer>(
      `/api/organizations/${organizationId}/customers/${customerId}`
    ),
  update: (
    organizationId: string,
    customerId: string,
    data: { name?: string; parentId?: string | null }
  ) =>
    externalApi.patch<Customer>(
      `/api/organizations/${organizationId}/customers/${customerId}`,
      data
    ),
  delete: (organizationId: string, customerId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/customers/${customerId}`
    ),
};

// Vehicles (with optional associated tracker device)
export interface VehicleTrackerDevice {
  id: string;
  imei: string;
  model: string;
  name?: string | null;
  serialSat?: string | null;
  equipmentModel?: string | null;
  carrier?: string | null;
  simCardNumber?: string | null;
  cellNumber?: string | null;
  connectedAt?: string | null;
}

export interface Vehicle {
  id: string;
  organizationId: string;
  name?: string | null;
  plate?: string | null;
  serial?: string | null;
  color?: string | null;
  year?: string | null;
  renavam?: string | null;
  chassis?: string | null;
  vehicleType?: string | null;
  inactive?: boolean;
  notes?: string | null;
  trackerDeviceId?: string | null;
  customerId?: string | null;
  customer?: { id: string; name: string } | null;
  trackerDevice?: VehicleTrackerDevice | null;
  createdAt: string;
  updatedAt: string;
}

/** New device to create and link when creating a vehicle */
export interface CreateVehicleNewDevicePayload {
  imei: string;
  model: string; // TrackerModel: X12_GT06 | X22_NT20
  name?: string;
  serialSat?: string;
  equipmentModel?: string;
  individualPassword?: string;
  carrier?: string;
  simCardNumber?: string;
  cellNumber?: string;
}

export interface CreateVehiclePayload {
  name?: string;
  plate?: string;
  serial?: string;
  color?: string;
  year?: string;
  renavam?: string;
  chassis?: string;
  vehicleType?: string;
  inactive?: boolean;
  notes?: string;
  trackerDeviceId?: string;
  customerId?: string;
  /** Create and link a new tracker device (takes precedence over trackerDeviceId) */
  newDevice?: CreateVehicleNewDevicePayload;
}

export interface UpdateVehiclePayload {
  name?: string;
  plate?: string;
  serial?: string;
  color?: string;
  year?: string;
  renavam?: string;
  chassis?: string;
  vehicleType?: string;
  inactive?: boolean;
  notes?: string;
  trackerDeviceId?: string;
  customerId?: string;
}

export const vehiclesAPI = {
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get<Vehicle[]>(
      `/api/organizations/${organizationId}/vehicles`,
      { params: params?.customerId ? { customerId: params.customerId } : undefined }
    ),
  get: (organizationId: string, vehicleId: string) =>
    externalApi.get<Vehicle>(
      `/api/organizations/${organizationId}/vehicles/${vehicleId}`,
    ),
  create: (organizationId: string, payload: CreateVehiclePayload) =>
    externalApi.post<Vehicle>(
      `/api/organizations/${organizationId}/vehicles`,
      payload,
    ),
  update: (
    organizationId: string,
    vehicleId: string,
    payload: UpdateVehiclePayload,
  ) =>
    externalApi.patch<Vehicle>(
      `/api/organizations/${organizationId}/vehicles/${vehicleId}`,
      payload,
    ),
  delete: (organizationId: string, vehicleId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/vehicles/${vehicleId}`,
    ),
};

// Tracker devices and positions
export interface PositionHistoryQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export const trackerDevicesAPI = {
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get(
      `/api/organizations/${organizationId}/tracker-devices`,
      { params: params?.customerId ? { customerId: params.customerId } : undefined }
    ),
  get: (organizationId: string, deviceId: string) =>
    externalApi.get(
      `/api/organizations/${organizationId}/tracker-devices/${deviceId}`
    ),
  getLastPosition: (organizationId: string, deviceId: string) =>
    externalApi.get(
      `/api/organizations/${organizationId}/tracker-devices/${deviceId}/positions/last`
    ),
  getPositionHistory: (
    organizationId: string,
    deviceId: string,
    query?: PositionHistoryQuery
  ) =>
    externalApi.get(
      `/api/organizations/${organizationId}/tracker-devices/${deviceId}/positions`,
      { params: query }
    ),
};

// ── DOCUMENTS ────────────────────────────────────────────────────────────────

export type DocumentType = 'CRLV' | 'INSURANCE' | 'LICENSE' | 'INSPECTION' | 'OTHER';
export type DocumentStatus = 'VALID' | 'EXPIRING' | 'EXPIRED';

export interface VehicleDocument {
  id: string;
  organizationId: string;
  vehicleId: string;
  createdById: string;
  type: DocumentType;
  title: string;
  fileUrl?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  status: DocumentStatus;
  daysUntilExpiry: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentPayload {
  vehicleId: string;
  type: DocumentType;
  title: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateDocumentPayload {
  type?: DocumentType;
  title?: string;
  fileUrl?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  notes?: string;
}

export const documentsAPI = {
  list: (organizationId: string, params?: {
    vehicleId?: string;
    type?: DocumentType;
    expiryBefore?: string;
  }) =>
    externalApi.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents`,
      { params }
    ),

  listExpiring: (organizationId: string, days = 30) =>
    externalApi.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents/expiring`,
      { params: { days } }
    ),

  getOne: (organizationId: string, id: string) =>
    externalApi.get<VehicleDocument>(
      `/api/organizations/${organizationId}/documents/${id}`
    ),

  create: (organizationId: string, payload: CreateDocumentPayload) =>
    externalApi.post<VehicleDocument>(
      `/api/organizations/${organizationId}/documents`,
      payload
    ),

  update: (organizationId: string, id: string, payload: UpdateDocumentPayload) =>
    externalApi.patch<VehicleDocument>(
      `/api/organizations/${organizationId}/documents/${id}`,
      payload
    ),

  remove: (organizationId: string, id: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/documents/${id}`
    ),
};

// ── DRIVERS ──────────────────────────────────────────────────────────────────

export interface DriverVehicleAssignment {
  id: string;
  driverId: string;
  vehicleId: string;
  startDate: string;
  endDate?: string | null;
  isPrimary: boolean;
  vehicle?: {
    id: string;
    name?: string | null;
    plate?: string | null;
  };
}

export interface Driver {
  id: string;
  organizationId: string;
  customerId?: string | null;
  name: string;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  vehicleAssignments?: DriverVehicleAssignment[];
}

export interface CreateDriverPayload {
  name: string;
  customerId?: string;
  cpf?: string;
  cnh?: string;
  cnhCategory?: string;
  cnhExpiry?: string;   // ISO 8601
  phone?: string;
  email?: string;
  photo?: string;
  notes?: string;
}

export interface UpdateDriverPayload {
  name?: string;
  customerId?: string | null;
  cpf?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  cnhExpiry?: string | null;
  phone?: string | null;
  email?: string | null;
  photo?: string | null;
  active?: boolean;
  notes?: string | null;
}

export const driversAPI = {
  list: (organizationId: string, params?: { customerId?: string | null }) =>
    externalApi.get<{ drivers: Driver[] }>(
      `/api/organizations/${organizationId}/drivers`,
      {
        params: params?.customerId
          ? { customerId: params.customerId }
          : undefined,
      }
    ),

  get: (organizationId: string, driverId: string) =>
    externalApi.get<Driver>(
      `/api/organizations/${organizationId}/drivers/${driverId}`
    ),

  create: (organizationId: string, payload: CreateDriverPayload) =>
    externalApi.post<Driver>(
      `/api/organizations/${organizationId}/drivers`,
      payload
    ),

  update: (organizationId: string, driverId: string, payload: UpdateDriverPayload) =>
    externalApi.patch<Driver>(
      `/api/organizations/${organizationId}/drivers/${driverId}`,
      payload
    ),

  delete: (organizationId: string, driverId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/drivers/${driverId}`
    ),

  assignVehicle: (
    organizationId: string,
    driverId: string,
    payload: { vehicleId: string; isPrimary?: boolean }
  ) =>
    externalApi.post(
      `/api/organizations/${organizationId}/drivers/${driverId}/assign-vehicle`,
      payload
    ),

  unassignVehicle: (organizationId: string, driverId: string, vehicleId: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/drivers/${driverId}/assign-vehicle/${vehicleId}`
    ),
};

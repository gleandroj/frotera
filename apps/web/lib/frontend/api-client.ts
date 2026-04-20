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

export function buildTelemetryAlertsSocket(orgId: string): Socket {
  const base = externalApiUrl || "http://localhost:3001";
  return io(base + "/telemetry-alerts", {
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
  changePassword: (currentPassword: string, newPassword: string) =>
    externalApi.post("/api/auth/change-password", { currentPassword, newPassword }),
};

export type TrackerDiscoveryLoginRow = {
  id: string;
  imei: string;
  protocol: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  loginCount: number;
  lastRemoteAddress: string | null;
};

export type SuperadminVehicleWithoutTrackerRow = {
  id: string;
  plate: string | null;
  name: string | null;
  customer: { id: string; name: string };
};

/** Superadmin: IMEIs seen on TCP before device registration */
export const superadminTrackerDiscoveryAPI = {
  list: () =>
    externalApi.get<TrackerDiscoveryLoginRow[]>("/api/superadmin/tracker-discoveries"),
  listOrganizations: () =>
    externalApi.get<{ id: string; name: string }[]>(
      "/api/superadmin/tracker-discoveries/lookup/organizations",
    ),
  listVehiclesWithoutTracker: (organizationId: string) =>
    externalApi.get<SuperadminVehicleWithoutTrackerRow[]>(
      `/api/superadmin/tracker-discoveries/lookup/organizations/${organizationId}/vehicles-without-tracker`,
    ),
  registerToVehicle: (imei: string, vehicleId: string) =>
    externalApi.post<{
      deviceId: string;
      vehicleId: string;
      organizationId: string;
    }>(
      `/api/superadmin/tracker-discoveries/${encodeURIComponent(imei)}/register-to-vehicle`,
      { vehicleId },
    ),
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
  getMembers: (
    organizationId: string,
    params?: { customerId?: string | null; includeInactive?: boolean }
  ) =>
    externalApi.get(`/api/organizations/${organizationId}/members`, {
      params:
        params?.customerId != null || params?.includeInactive === true
          ? {
              ...(params?.customerId != null ? { customerId: params.customerId } : {}),
              ...(params?.includeInactive === true ? { includeInactive: "true" } : {}),
            }
          : undefined,
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
      isSuperAdmin?: boolean;
      isSystemUser?: boolean;
      sendCredentials?: boolean;
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
      isSuperAdmin?: boolean;
      isSystemUser?: boolean;
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
  enableMember: (organizationId: string, memberId: string) =>
    externalApi.patch(
      `/api/organizations/${organizationId}/members/${memberId}/enable`
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
  setMemberVehicles: (organizationId: string, memberId: string, vehicleIds: string[]) =>
    externalApi.patch(`/api/organizations/${organizationId}/members/${memberId}/vehicles`, { vehicleIds }),
  setMemberDrivers: (organizationId: string, memberId: string, driverIds: string[]) =>
    externalApi.patch(`/api/organizations/${organizationId}/members/${memberId}/drivers`, { driverIds }),
};

export interface CustomerFleetSettingResolved {
  customerId: string;
  customerName: string | null;
  deviceOfflineThresholdMinutes: number | null;
  defaultSpeedLimitKmh: number | null;
}

export interface ListCustomerFleetSettingsResponse {
  customers: CustomerFleetSettingResolved[];
}

export type FleetPatchApplyMode = "single" | "all_accessible";

export const customerFleetSettingsAPI = {
  list: (organizationId: string) =>
    externalApi.get<ListCustomerFleetSettingsResponse>(
      `/api/organizations/${organizationId}/customer-fleet-settings`,
    ),
  patch: (
    organizationId: string,
    data: {
      applyMode: FleetPatchApplyMode;
      customerId?: string;
      deviceOfflineThresholdMinutes?: number | null;
      defaultSpeedLimitKmh?: number | null;
    },
  ) =>
    externalApi.patch<ListCustomerFleetSettingsResponse>(
      `/api/organizations/${organizationId}/customer-fleet-settings`,
      data,
    ),
};

// Customer type and API
export interface Customer {
  id: string;
  organizationId: string;
  parentId?: string | null;
  name: string;
  inactive: boolean;
  depth?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListParams {
  customerId?: string | null;
  /** Query param `activeOnly=true` — active customers, non-inactive vehicles, active drivers, active geofences (per endpoint). */
  activeOnly?: boolean;
  /** Query param `inactiveOnly=true` — inactive customers, inactive vehicles, inactive drivers, inactive geofences (per endpoint). */
  inactiveOnly?: boolean;
}

function buildListQueryParams(
  params?: ListParams,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const q: Record<string, string> = {};
  if (params.customerId) q.customerId = params.customerId;
  if (params.activeOnly === true) q.activeOnly = "true";
  if (params.inactiveOnly === true) q.inactiveOnly = "true";
  return Object.keys(q).length ? q : undefined;
}

export const customersAPI = {
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get<{ customers: Customer[] }>(
      `/api/organizations/${organizationId}/customers`,
      { params: buildListQueryParams(params) },
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
  vehicleSpecies?: string | null;
  vehicleBodyType?: string | null;
  vehicleTraction?: string | null;
  vehicleUseCategory?: string | null;
  inactive?: boolean;
  speedLimit?: number | null;
  /** Hodômetro (km) na entrada do veículo na frota */
  initialOdometerKm?: number | null;
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
  model: string; // TrackerModel (Prisma enum)
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
  vehicleSpecies?: string | null;
  vehicleBodyType?: string | null;
  vehicleTraction?: string | null;
  vehicleUseCategory?: string | null;
  inactive?: boolean;
  speedLimit?: number | null;
  initialOdometerKm?: number | null;
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
  vehicleSpecies?: string | null;
  vehicleBodyType?: string | null;
  vehicleTraction?: string | null;
  vehicleUseCategory?: string | null;
  inactive?: boolean;
  speedLimit?: number | null;
  initialOdometerKm?: number | null;
  notes?: string;
  trackerDeviceId?: string;
  customerId?: string;
}

export interface FleetPosition {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  ignitionOn?: boolean | null;
  recordedAt: string;
}

export interface FleetVehicleStatus {
  id: string;
  name?: string | null;
  plate?: string | null;
  color?: string | null;
  vehicleType?: string | null;
  inactive: boolean;
  customer?: { id: string; name: string } | null;
  trackerDevice?: { id: string; imei: string; connectedAt?: string | null } | null;
  lastPosition?: FleetPosition | null;
}

export const vehiclesAPI = {
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get<Vehicle[]>(
      `/api/organizations/${organizationId}/vehicles`,
      { params: buildListQueryParams(params) },
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
  fleetStatus: (organizationId: string, params?: { customerId?: string | null }) =>
    externalApi.get<FleetVehicleStatus[]>(
      `/api/organizations/${organizationId}/vehicles/fleet-status`,
      { params: params?.customerId ? { customerId: params.customerId } : undefined },
    ),
};

export interface Incident {
  id: string;
  organizationId: string;
  customerId: string;
  vehicleId: string | null;
  driverId: string | null;
  createdById: string;
  type: "ACCIDENT" | "THEFT" | "FINE" | "BREAKDOWN" | "VANDALISM" | "OTHER";
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cost: number | null;
  insuranceClaim: boolean;
  claimNumber: string | null;
  notes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: IncidentAttachment[];
  customer?: { id: string; name: string } | null;
  vehicle?: { id: string; name: string | null; plate: string | null } | null;
}

export interface IncidentAttachment {
  id: string;
  incidentId: string;
  fileUrl: string;
  fileType: string;
  name: string;
  createdAt: string;
}

export interface IncidentStats {
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  totalCost: number;
  openCount: number;
}

export interface IncidentListResponse {
  incidents: Incident[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const incidentsAPI = {
  list: (
    orgId: string,
    params?: {
      type?: string;
      status?: string;
      severity?: string;
      vehicleId?: string;
      driverId?: string;
      dateFrom?: string;
      dateTo?: string;
      customerId?: string;
      page?: number;
      limit?: number;
    },
  ) =>
    externalApi.get<IncidentListResponse>(
      `/api/organizations/${orgId}/incidents`,
      { params },
    ),

  create: (orgId: string, data: Record<string, unknown>) =>
    externalApi.post<Incident>(
      `/api/organizations/${orgId}/incidents`,
      data,
    ),

  getOne: (orgId: string, id: string) =>
    externalApi.get<Incident>(`/api/organizations/${orgId}/incidents/${id}`),

  update: (orgId: string, id: string, data: Record<string, unknown>) =>
    externalApi.patch<Incident>(
      `/api/organizations/${orgId}/incidents/${id}`,
      data,
    ),

  remove: (orgId: string, id: string) =>
    externalApi.delete(`/api/organizations/${orgId}/incidents/${id}`),

  addAttachment: (
    orgId: string,
    id: string,
    data: { fileUrl: string; fileType: string; name: string },
  ) =>
    externalApi.post<IncidentAttachment>(
      `/api/organizations/${orgId}/incidents/${id}/attachments`,
      data,
    ),

  uploadAttachment: (orgId: string, incidentId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return externalApi.post<IncidentAttachment>(
      `/api/organizations/${orgId}/incidents/${incidentId}/attachments/upload`,
      body,
      { timeout: 120_000 },
    );
  },

  removeAttachment: (orgId: string, id: string, attachmentId: string) =>
    externalApi.delete(
      `/api/organizations/${orgId}/incidents/${id}/attachments/${attachmentId}`,
    ),

  stats: (
    orgId: string,
    params?: { dateFrom?: string; dateTo?: string; customerId?: string },
  ) =>
    externalApi.get<IncidentStats>(
      `/api/organizations/${orgId}/incidents/stats`,
      { params },
    ),
};

// ── TELEMETRY ───────────────────────────────────────────────────────────────

export type TelemetryAlertType =
  | "SPEEDING"
  | "HARSH_BRAKING"
  | "RAPID_ACCELERATION"
  | "GEOFENCE_ENTER"
  | "GEOFENCE_EXIT"
  | "DEVICE_OFFLINE"
  | "LOW_BATTERY"
  | "IGNITION_ON"
  | "IGNITION_OFF";

export type TelemetryAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type GeofenceTypeApi = "CIRCLE" | "POLYGON";

export interface TelemetryAlert {
  id: string;
  organizationId: string;
  vehicleId: string | null;
  deviceId: string;
  type: TelemetryAlertType;
  severity: TelemetryAlertSeverity;
  message: string;
  metadata: Record<string, unknown> | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
  vehicle?: { id: string; name: string | null; plate: string | null } | null;
  device?: { id: string; imei: string; name: string | null } | null;
}

export interface TelemetryAlertListResponse {
  data: TelemetryAlert[];
  total: number;
}

export interface TelemetryAlertStats {
  total: number;
  unacknowledged: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface GeofenceZone {
  id: string;
  organizationId: string;
  customerId: string;
  customerName?: string | null;
  name: string;
  description: string | null;
  type: GeofenceTypeApi;
  coordinates: Record<string, unknown>;
  vehicleIds: string[];
  alertOnEnter: boolean;
  alertOnExit: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGeofencePayload {
  customerId: string;
  name: string;
  description?: string;
  type: GeofenceTypeApi;
  coordinates: Record<string, unknown>;
  vehicleIds?: string[];
  alertOnEnter?: boolean;
  alertOnExit?: boolean;
}

export const telemetryAPI = {
  listAlerts: (
    orgId: string,
    params?: {
      type?: string;
      severity?: string;
      vehicleId?: string;
      customerId?: string;
      acknowledged?: boolean;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    },
  ) =>
    externalApi.get<TelemetryAlertListResponse>(
      `/api/organizations/${orgId}/telemetry/alerts`,
      { params },
    ),

  getAlertStats: (orgId: string, params?: { customerId?: string }) =>
    externalApi.get<TelemetryAlertStats>(
      `/api/organizations/${orgId}/telemetry/alerts/stats`,
      { params: params?.customerId ? { customerId: params.customerId } : undefined },
    ),

  acknowledgeAlert: (orgId: string, alertId: string) =>
    externalApi.patch<TelemetryAlert>(
      `/api/organizations/${orgId}/telemetry/alerts/${alertId}/acknowledge`,
      {},
    ),

  listGeofences: (orgId: string, params?: ListParams) =>
    externalApi.get<GeofenceZone[]>(
      `/api/organizations/${orgId}/telemetry/geofences`,
      { params: buildListQueryParams(params) },
    ),

  createGeofence: (orgId: string, data: CreateGeofencePayload) =>
    externalApi.post<GeofenceZone>(
      `/api/organizations/${orgId}/telemetry/geofences`,
      data,
    ),

  updateGeofence: (
    orgId: string,
    id: string,
    data: Partial<CreateGeofencePayload> & { active?: boolean },
  ) =>
    externalApi.patch<GeofenceZone>(
      `/api/organizations/${orgId}/telemetry/geofences/${id}`,
      data,
    ),

  deleteGeofence: (orgId: string, id: string) =>
    externalApi.delete(`/api/organizations/${orgId}/telemetry/geofences/${id}`),
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
  customerId?: string | null;
  customerName?: string | null;
  vehicleName?: string | null;
  vehiclePlate?: string | null;
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
  issueDate: string;
  expiryDate: string;
  fileUrl?: string;
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
    customerId?: string | null;
    type?: DocumentType;
    expiryBefore?: string;
    expiryStatus?: Extract<DocumentStatus, 'EXPIRING' | 'EXPIRED'>;
  }) =>
    externalApi.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents`,
      { params }
    ),

  listExpiring: (organizationId: string, days = 30, customerId?: string | null) =>
    externalApi.get<{ documents: VehicleDocument[] }>(
      `/api/organizations/${organizationId}/documents/expiring`,
      { params: { days, ...(customerId ? { customerId } : {}) } }
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

  uploadAttachment: (organizationId: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return externalApi.post<{ fileUrl: string }>(
      `/api/organizations/${organizationId}/documents/upload`,
      body,
      { timeout: 120_000 }
    );
  },
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
  list: (organizationId: string, params?: ListParams) =>
    externalApi.get<{ drivers: Driver[] }>(
      `/api/organizations/${organizationId}/drivers`,
      { params: buildListQueryParams(params) },
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

// ── FUEL ──────────────────────────────────────────────────────────────────────

export type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'ELECTRIC' | 'GNV';

export interface FuelLog {
  id: string;
  organizationId: string;
  vehicleId: string;
  driverId?: string | null;
  createdById: string;
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  station?: string | null;
  state?: string | null;
  city?: string | null;
  receipt?: string | null;
  notes?: string | null;
  consumption?: number | null;   // km/l
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    name: string | null;
    plate: string | null;
    customer?: { id: string; name: string } | null;
  } | null;
  driver?: { id: string; name: string } | null;
}

export interface FuelStats {
  totalCost: number;
  totalLiters: number;
  count: number;
  avgConsumption: number | null;
  avgCostPerKm: number | null;
  currentMonthCost: number;
  currentMonthCount: number;
}

export interface CreateFuelLogPayload {
  vehicleId: string;
  driverId?: string;
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  fuelType: FuelType;
  station?: string;
  state?: string;
  city?: string;
  receipt?: string;
  notes?: string;
}

export interface UpdateFuelLogPayload {
  driverId?: string | null;
  date?: string;
  odometer?: number;
  liters?: number;
  pricePerLiter?: number;
  fuelType?: FuelType;
  station?: string;
  state?: string;
  city?: string;
  receipt?: string;
  notes?: string;
}

export interface IbgeEstadoOption {
  sigla: string;
  nome: string;
}

export interface IbgeMunicipioOption {
  id: number;
  nome: string;
}

export interface FuelListParams {
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
  fuelType?: FuelType;
}

export interface FuelStatsParams {
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const fuelAPI = {
  list: (organizationId: string, params?: FuelListParams) =>
    externalApi.get<FuelLog[]>(
      `/api/organizations/${organizationId}/fuel`,
      { params },
    ),
  get: (organizationId: string, id: string) =>
    externalApi.get<FuelLog>(
      `/api/organizations/${organizationId}/fuel/${id}`,
    ),
  create: (organizationId: string, payload: CreateFuelLogPayload) =>
    externalApi.post<FuelLog>(
      `/api/organizations/${organizationId}/fuel`,
      payload,
    ),
  update: (organizationId: string, id: string, payload: UpdateFuelLogPayload) =>
    externalApi.patch<FuelLog>(
      `/api/organizations/${organizationId}/fuel/${id}`,
      payload,
    ),
  delete: (organizationId: string, id: string) =>
    externalApi.delete(
      `/api/organizations/${organizationId}/fuel/${id}`,
    ),
  getStats: (organizationId: string, params?: FuelStatsParams) =>
    externalApi.get<FuelStats>(
      `/api/organizations/${organizationId}/fuel/stats`,
      { params },
    ),
  listGeoStates: (organizationId: string) =>
    externalApi.get<IbgeEstadoOption[]>(
      `/api/organizations/${organizationId}/fuel/geo/states`,
    ),
  listGeoMunicipios: (organizationId: string, uf: string) =>
    externalApi.get<IbgeMunicipioOption[]>(
      `/api/organizations/${organizationId}/fuel/geo/municipios`,
      { params: { uf } },
    ),
  uploadReceipt: (organizationId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return externalApi.post<{
      fileUrl: string;
      originalName: string;
      mimeType: string;
    }>(`/api/organizations/${organizationId}/fuel/upload-receipt`, body, {
      timeout: 120_000,
    });
  },
};

// ── FUEL REPORTS ─────────────────────────────────────────────────────────────

export interface VehicleConsumption {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  avgConsumption: number | null;
  bestConsumption: number | null;
  worstConsumption: number | null;
  totalKm: number | null;
  totalLiters: number;
  logsCount: number;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient_data';
  timeSeries: Array<{ date: string; consumption: number | null }>;
}

export interface CostsPeriod {
  period: string;
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgPricePerLiter: number | null;
  costPerKm: number | null;
  byFuelType: Record<string, { cost: number; liters: number }>;
}

export interface BenchmarkSummary {
  totalPaid: number;
  totalAtMarketPrice: number | null;
  totalOverpaid: number | null;
  overpaidPct: number | null;
  timeSeries: Array<{
    date: string;
    avgPricePaid: number;
    marketAvgPrice: number | null;
    difference: number | null;
  }>;
}

export interface VehicleEfficiency {
  vehicleId: string;
  vehicleName: string | null;
  vehiclePlate: string | null;
  currentAvgConsumption: number | null;
  historicalAvgConsumption: number | null;
  consumptionDropPct: number | null;
  isAlert: boolean;
  estimatedExtraCost: number | null;
  lastFuelDate: string | null;
}

export interface PeriodSummary {
  period: string;
  totalCost: number;
  totalLiters: number;
  logsCount: number;
  avgConsumption: number | null;
  avgPricePaid: number | null;
  avgMarketPrice: number | null;
  costPerKm: number | null;
  vsLastPeriod: {
    costChangePct: number | null;
    consumptionChangePct: number | null;
    litersChangePct: number | null;
  };
}

export const fuelReportsAPI = {
  consumption: (
    orgId: string,
    params?: { vehicleId?: string; customerId?: string; dateFrom?: string; dateTo?: string },
  ) =>
    externalApi.get<VehicleConsumption[]>(`/api/organizations/${orgId}/fuel/reports/consumption`, { params }),

  costs: (
    orgId: string,
    params?: { vehicleId?: string; customerId?: string; dateFrom?: string; dateTo?: string; groupBy?: string },
  ) =>
    externalApi.get<CostsPeriod[]>(`/api/organizations/${orgId}/fuel/reports/costs`, { params }),

  benchmark: (
    orgId: string,
    params?: { vehicleId?: string; customerId?: string; dateFrom?: string; dateTo?: string; state?: string },
  ) =>
    externalApi.get<BenchmarkSummary>(`/api/organizations/${orgId}/fuel/reports/benchmark`, { params }),

  efficiency: (orgId: string, params?: { thresholdPct?: number; customerId?: string }) =>
    externalApi.get<VehicleEfficiency[]>(`/api/organizations/${orgId}/fuel/reports/efficiency`, { params }),

  summary: (
    orgId: string,
    params: { period: 'day' | 'month' | 'year'; date: string; vehicleId?: string; customerId?: string },
  ) =>
    externalApi.get<PeriodSummary>(`/api/organizations/${orgId}/fuel/reports/summary`, { params }),

  marketPrices: (orgId: string, params: { state: string; fuelType: string }) =>
    externalApi.get<{ avgPrice: number | null; refDate: string | null }>(
      `/api/organizations/${orgId}/fuel/market-prices`, { params }
    ),
};

// ── CHECKLIST ────────────────────────────────────────────────────────────────

export type ItemType = "YES_NO" | "TEXT" | "NUMBER" | "PHOTO" | "SELECT" | "SIGNATURE" | "FILE";
export type EntryStatus = "PENDING" | "COMPLETED" | "INCOMPLETE";
export type ChecklistDriverRequirement = "REQUIRED" | "OPTIONAL" | "HIDDEN";

export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  label: string;
  type: ItemType;
  required: boolean;
  options: string[];
  order: number;
}

export interface ChecklistTemplate {
  id: string;
  organizationId: string;
  customerId?: string;
  customerName?: string | null;
  name: string;
  description?: string | null;
  active: boolean;
  vehicleRequired: boolean;
  driverRequirement: ChecklistDriverRequirement;
  items: ChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistAnswer {
  id: string;
  entryId: string;
  itemId?: string | null;
  itemLabel?: string | null;
  itemType?: string | null;
  itemOptions?: string[];
  itemRequired?: boolean | null;
  itemOrder?: number | null;
  value?: string | null;
  photoUrl?: string | null;
}

export interface ChecklistEntry {
  id: string;
  organizationId: string;
  templateId: string;
  templateName?: string | null;
  customerName?: string | null;
  vehicleId?: string | null;
  vehicleName?: string | null;
  vehiclePlate?: string | null;
  driverId?: string | null;
  driverName?: string | null;
  memberId: string;
  memberName?: string | null;
  status: EntryStatus;
  completedAt?: string | null;
  answers: ChecklistAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateChecklistTemplatePayload {
  name: string;
  customerId?: string;
  description?: string;
  active?: boolean;
  vehicleRequired: boolean;
  driverRequirement: ChecklistDriverRequirement;
  items: {
    label: string;
    type: ItemType;
    required: boolean;
    options?: string[];
    order: number;
  }[];
}

export interface CreateChecklistEntryPayload {
  templateId: string;
  vehicleId?: string;
  driverId?: string;
  answers: { itemId: string; value?: string; photoUrl?: string }[];
}

export interface ChecklistEntryFilters {
  vehicleId?: string;
  driverId?: string;
  memberId?: string;
  templateId?: string;
  status?: EntryStatus;
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
}

export interface ChecklistSummaryQuery {
  dateFrom?: string;
  dateTo?: string;
  templateId?: string;
  vehicleId?: string;
  customerId?: string;
}

export interface ChecklistSummaryPeriod {
  dateFrom: string;
  dateTo: string;
}

export interface ChecklistSummaryTotals {
  total: number;
  pending: number;
  completed: number;
  incomplete: number;
  completionRate: number;
}

export interface ChecklistSummaryByTemplate {
  templateId: string;
  templateName: string;
  total: number;
  pending: number;
  completed: number;
  incomplete: number;
  completionRate: number;
}

export interface ChecklistSummaryResponse {
  period: ChecklistSummaryPeriod;
  totals: ChecklistSummaryTotals;
  byTemplate: ChecklistSummaryByTemplate[];
}

export const checklistAPI = {
  listTemplates: (organizationId: string, params?: { customerId?: string }) =>
    externalApi.get<ChecklistTemplate[]>(
      `/api/organizations/${organizationId}/checklist/templates`,
      { params },
    ),
  createTemplate: (organizationId: string, payload: CreateChecklistTemplatePayload) =>
    externalApi.post<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates`,
      payload,
    ),
  getTemplate: (organizationId: string, templateId: string) =>
    externalApi.get<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
    ),
  updateTemplate: (
    organizationId: string,
    templateId: string,
    payload: Partial<CreateChecklistTemplatePayload>,
  ) =>
    externalApi.patch<ChecklistTemplate>(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
      payload,
    ),
  deleteTemplate: (organizationId: string, templateId: string) =>
    externalApi.delete<{ message: string }>(
      `/api/organizations/${organizationId}/checklist/templates/${templateId}`,
    ),
  reportsSummary: (organizationId: string, params?: ChecklistSummaryQuery) =>
    externalApi.get<ChecklistSummaryResponse>(
      `/api/organizations/${organizationId}/checklist/reports/summary`,
      { params },
    ),
  listEntries: (organizationId: string, filters?: ChecklistEntryFilters) =>
    externalApi.get<ChecklistEntry[]>(
      `/api/organizations/${organizationId}/checklist/entries`,
      { params: filters },
    ),
  createEntry: (organizationId: string, payload: CreateChecklistEntryPayload) =>
    externalApi.post<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries`,
      payload,
    ),
  uploadAttachment: (
    organizationId: string,
    file: File,
    purpose: "photo" | "file" | "signature",
  ) => {
    const body = new FormData();
    body.append("file", file);
    return externalApi.post<{ fileUrl: string; originalName: string; mimeType: string }>(
      `/api/organizations/${organizationId}/checklist/upload`,
      body,
      {
        params: { purpose },
        timeout: 120_000,
      },
    );
  },
  getEntry: (organizationId: string, entryId: string) =>
    externalApi.get<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries/${entryId}`,
    ),
  updateEntryStatus: (
    organizationId: string,
    entryId: string,
    status: EntryStatus,
  ) =>
    externalApi.patch<ChecklistEntry>(
      `/api/organizations/${organizationId}/checklist/entries/${entryId}`,
      { status },
    ),
};

export const publicChecklistAPI = {
  getTemplate: (organizationId: string, templateId: string) =>
    externalApi.get<ChecklistTemplate>(`/api/public/checklist/template`, {
      params: { organizationId, templateId },
    }),
  listVehicles: (organizationId: string, templateId: string) =>
    externalApi.get<{ id: string; name?: string | null; plate?: string | null }[]>(
      `/api/public/checklist/vehicles`,
      { params: { organizationId, templateId } },
    ),
  listDrivers: (organizationId: string, templateId: string) =>
    externalApi.get<{ id: string; name: string }[]>(
      `/api/public/checklist/drivers`,
      { params: { organizationId, templateId } },
    ),
  createEntry: (payload: {
    organizationId: string;
    templateId: string;
    vehicleId: string;
    driverId?: string;
    answers: { itemId: string; value?: string; photoUrl?: string }[];
  }) => externalApi.post<ChecklistEntry>(`/api/public/checklist/entries`, payload),
  uploadAttachment: (
    organizationId: string,
    templateId: string,
    file: File,
    purpose: "photo" | "file" | "signature",
  ) => {
    const body = new FormData();
    body.append("file", file);
    return externalApi.post<{ fileUrl: string; originalName: string; mimeType: string }>(
      `/api/public/checklist/upload`,
      body,
      {
        params: { organizationId, templateId, purpose },
        timeout: 120_000,
      },
    );
  },
};

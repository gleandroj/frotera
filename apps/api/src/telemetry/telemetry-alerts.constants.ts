/** Single Redis pub/sub channel; payload includes organizationId. */
export const TELEMETRY_ALERT_CHANNEL = "telemetry:alerts";

export const GEOFENCE_ORG_CACHE_PREFIX = "telemetry:geofences:";

export const GEOFENCE_STATE_HASH_PREFIX = "telemetry:geofence:";

export const ALERT_DEDUP_PREFIX = "telemetry:alert:dedup:";

export const GEOFENCE_ORG_CACHE_TTL_SEC = 60;

export const SPEEDING_DEDUP_SEC = 300;

export const DEVICE_OFFLINE_DEDUP_MULT = 2;

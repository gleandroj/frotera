/** CLI options for the tracker TCP simulator. */
export interface TrackerTcpOptions {
  host: string;
  port: number;
  imei: string;
  speed: number;
  interval: number;
  apiKey: string;
  /** Skip cache and force Routes API request */
  noCache?: boolean;
}

/** Result of a route fetch (from API or cache). */
export interface RouteResult {
  points: LatLng[];
  totalDistanceM: number;
  totalDurationSec: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** One position in the simulated schedule. */
export interface ScheduledPosition {
  lat: number;
  lng: number;
  date: Date;
  speedKmh: number;
  heading: number;
}

/** Google Routes API waypoint (origin/destination). */
export interface RoutesWaypoint {
  location?: { latLng: { latitude: number; longitude: number } };
  address?: string;
}

/** Cached route file shape. */
export interface CachedRoute {
  origin: string;
  destination: string;
  points: LatLng[];
  totalDistanceM: number;
  totalDurationSec: number;
  cachedAt: string;
}

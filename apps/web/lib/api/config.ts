import { externalApi } from "../frontend/api-client";

export interface PublicConfig {
  trialDays: number;
  /** When false, public signup is disabled. Controlled in AdminJS App Settings. */
  signupEnabled: boolean;
}

/**
 * Get public configuration from the API (server-side)
 * Use this in Server Components to avoid client-side fetching
 */
export async function getPublicConfig(): Promise<PublicConfig> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes
      next: { revalidate: 300 }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }

    const config = await response.json();
    return config;
  } catch (error) {
    console.error('Error fetching public config:', error);
    // Return conservative default config (public signup disabled) as fallback
    return { trialDays: 0, signupEnabled: false };
  }
}

/**
 * Get public configuration from the API (client-side)
 * Use this in Client Components
 */
export const configApi = {
  /**
   * Get public configuration
   */
  get: async (): Promise<PublicConfig> => {
    const response = await externalApi.get("/api/config");
    return response.data;
  },
};

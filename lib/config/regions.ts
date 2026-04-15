/**
 * Region definitions for global / CN deployment split.
 *
 * Only GLOBAL is active today. CN is prepared for future use.
 * The active region is selected via the APP_REGION environment variable.
 *
 * Usage:
 *   import { REGIONS, type Region } from '@/lib/config/regions';
 */

export const REGIONS = {
  GLOBAL: "global",
  CN: "cn",
} as const;

export type Region = (typeof REGIONS)[keyof typeof REGIONS];

export const DEFAULT_REGION: Region = REGIONS.GLOBAL;

// ---------------------------------------------------------------------------
// Feature flags per region
// ---------------------------------------------------------------------------

export interface RegionFeatures {
  /** Whether an analytics provider is expected to be configured */
  analyticsEnabled: boolean;
  /** Whether a maps provider is expected to be configured */
  mapsEnabled: boolean;
  /** Whether social/OAuth login is enabled */
  socialLoginEnabled: boolean;
  /** Whether a payment provider is active (vs manual admin approval) */
  paymentProviderEnabled: boolean;
  /** Whether transactional email notifications are active */
  emailNotificationsEnabled: boolean;
}

export const REGION_FEATURES: Record<Region, RegionFeatures> = {
  /**
   * Global deployment (current active config).
   * All features default off until explicitly integrated.
   * Flip individual flags to true as each provider is wired up.
   */
  global: {
    analyticsEnabled: false,
    mapsEnabled: false,
    socialLoginEnabled: false,
    paymentProviderEnabled: false,
    emailNotificationsEnabled: false,
  },

  /**
   * China deployment (future — not yet active).
   * Flags mirror global until CN-specific providers are implemented.
   * When building the CN version, update these flags and wire up
   * CN-compliant providers in lib/services/adapters/.
   */
  cn: {
    analyticsEnabled: false,
    mapsEnabled: false,
    socialLoginEnabled: false,
    paymentProviderEnabled: false,
    emailNotificationsEnabled: false,
  },
};

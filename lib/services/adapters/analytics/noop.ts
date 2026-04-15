/**
 * No-op analytics adapter.
 *
 * Used when no analytics provider is configured (current state for both
 * GLOBAL and CN). All calls are silently discarded.
 *
 * Replace or supplement this with a real adapter when analytics is needed:
 *   GLOBAL → lib/services/adapters/analytics/posthog.ts
 *   CN     → lib/services/adapters/analytics/baidu.ts
 */

import type { AnalyticsProvider } from "../../providers/analytics";

export class NoopAnalytics implements AnalyticsProvider {
  trackPageView(_path: string, _title?: string): void {}
  trackEvent(_name: string, _properties?: Record<string, unknown>): void {}
  identify(_userId: string, _traits?: Record<string, unknown>): void {}
  reset(): void {}
}

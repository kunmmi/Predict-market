/**
 * Analytics provider interface.
 *
 * Current state: No analytics integrated. NoopAnalytics is active.
 *
 * To add analytics:
 *   1. Pick a provider suitable for your region:
 *      GLOBAL → PostHog, Mixpanel, Plausible (avoid Google Analytics — blocked in CN)
 *      CN     → Baidu Analytics (百度统计), Umeng (友盟)
 *   2. Create an adapter in lib/services/adapters/analytics/<provider>.ts
 *      that implements this interface.
 *   3. Register it in lib/services/registry.ts.
 *   4. Set NEXT_PUBLIC_ANALYTICS_PROVIDER and NEXT_PUBLIC_ANALYTICS_ID in .env.
 */

export interface AnalyticsProvider {
  /**
   * Track a page view.
   * Call on route changes in client components.
   */
  trackPageView(path: string, title?: string): void;

  /**
   * Track a named event with optional properties.
   * Examples: 'trade_placed', 'deposit_submitted', 'promoter_registered'
   */
  trackEvent(name: string, properties?: Record<string, unknown>): void;

  /**
   * Associate subsequent events with a known user.
   * Call after login / on session restore.
   */
  identify(userId: string, traits?: Record<string, unknown>): void;

  /**
   * Clear the user identity (call on logout).
   */
  reset(): void;
}

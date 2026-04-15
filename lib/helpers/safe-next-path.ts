/**
 * Prevent open redirects after login: only allow internal dashboard/admin paths.
 */
export function getSafeNextPath(raw: string | null): string {
  if (!raw) {
    return "/dashboard";
  }

  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  if (raw.startsWith("/dashboard") || raw.startsWith("/admin")) {
    return raw;
  }

  return "/dashboard";
}

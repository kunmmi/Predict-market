import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { config as appConfig } from "@/lib/config";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    appConfig.supabase.url(),
    appConfig.supabase.anonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<NextResponse["cookies"]["set"]>[2],
            );
          });
        },
      },
    },
  );

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/promoter") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/admin");

  // Single auth call — no retries, no sleep, no fallback getSession().
  // Retrying inside middleware was causing MIDDLEWARE_INVOCATION_TIMEOUT on
  // Vercel's edge runtime (hard cap ~1.5 s). For non-protected routes we
  // still call getUser() so Supabase SSR can refresh the auth cookie, but
  // we never block the request on an error.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    // If Supabase itself errored but the browser has a session cookie, let
    // the request through rather than bouncing the user — the page-level
    // requireUser() will handle it properly.
    if (error && hasSupabaseAuthCookie(request)) {
      console.error("Middleware auth lookup failed; preserving request with session cookie.", error.message);
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

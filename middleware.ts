import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { config as appConfig } from "@/lib/config";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

async function getRequestUserWithFallback(
  supabase: ReturnType<typeof createServerClient>,
): Promise<{ user: User | null; errorMessage: string | null }> {
  let errorMessage: string | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error) return { user, errorMessage: null };

    errorMessage = error.message;
    if (attempt < 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!sessionError && session?.user) {
    return { user: session.user, errorMessage: null };
  }

  return { user: null, errorMessage };
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

  const { user, errorMessage } = await getRequestUserWithFallback(supabase);

  if (isProtected && !user) {
    if (errorMessage && hasSupabaseAuthCookie(request)) {
      console.error("Middleware auth lookup failed; preserving request with session cookie.", errorMessage);
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

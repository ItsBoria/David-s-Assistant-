import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv } from "./env";

const protectedPathPrefix = "/app";

function makePrivate(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

function copyCookies(source: NextResponse, destination: NextResponse) {
  source.cookies.getAll().forEach((cookie) => destination.cookies.set(cookie));

  return makePrivate(destination);
}

function isProtectedPath(pathname: string) {
  return (
    pathname === protectedPathPrefix ||
    pathname.startsWith(`${protectedPathPrefix}/`)
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { anonKey, url } = getSupabasePublicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, {
            ...options,
            path: "/",
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
          });
        });
      },
    },
  });

  // getClaims verifies the JWT signature against the project's signing keys.
  // Route protection must never trust an unverified session read from cookies.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname, search } = request.nextUrl;

  if (!claims?.sub && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);

    return copyCookies(response, NextResponse.redirect(loginUrl));
  }

  return makePrivate(response);
}

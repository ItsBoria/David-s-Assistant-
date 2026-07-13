import { NextResponse, type NextRequest } from "next/server";

import { getSafeInternalPath } from "@/lib/security/safe-redirect";
import { createClient } from "@/lib/supabase/server";

function authErrorUrl(request: NextRequest, reason: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth/error";
  url.search = "";
  url.searchParams.set("reason", reason);

  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = getSafeInternalPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(authErrorUrl(request, "invalid_callback"));
  }

  const supabase = await createClient({ cookieWrites: "required" });
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(authErrorUrl(request, "confirmation_failed"));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

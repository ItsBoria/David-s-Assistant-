import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeInternalPath } from "@/lib/security/safe-redirect";
import { createClient } from "@/lib/supabase/server";

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return [
    "email",
    "email_change",
    "magiclink",
    "signup",
  ].includes(value ?? "");
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = getSafeInternalPath(request.nextUrl.searchParams.get("next"));

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient({ cookieWrites: "required" });
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/auth/error";
  errorUrl.search = "";
  errorUrl.searchParams.set("reason", "confirmation_failed");

  return NextResponse.redirect(errorUrl);
}

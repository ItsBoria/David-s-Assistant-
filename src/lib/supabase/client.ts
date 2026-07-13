"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) {
    return browserClient;
  }

  const { anonKey, url } = getSupabasePublicEnv();

  browserClient = createBrowserClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });

  return browserClient;
}

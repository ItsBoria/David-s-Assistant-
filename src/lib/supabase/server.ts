import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "./env";

type ServerClientOptions = {
  cookieWrites?: "best-effort" | "required";
};

export async function createClient({
  cookieWrites = "best-effort",
}: ServerClientOptions = {}) {
  const cookieStore = await cookies();
  const { anonKey, url } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, options, value }) => {
            cookieStore.set(name, value, {
              ...options,
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });
          });
        } catch (error) {
          if (cookieWrites === "required") {
            throw error;
          }

          // Server Components cannot write cookies. The proxy refreshes the
          // session before rendering and owns cookie mutation in that case.
        }
      },
    },
  });
}

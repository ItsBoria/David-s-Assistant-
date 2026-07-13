const configurationError =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(configurationError);
  }

  try {
    const parsedUrl = new URL(url);

    const isLoopback =
      parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";

    if (parsedUrl.protocol !== "https:" && !isLoopback) {
      throw new Error(configurationError);
    }
  } catch {
    throw new Error(configurationError);
  }

  return { anonKey, url };
}

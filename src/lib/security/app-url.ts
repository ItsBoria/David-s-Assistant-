type AuthCallbackUrlOptions = {
  configuredUrl?: string;
  requestOrigin?: string | null;
  production: boolean;
};

const configurationError =
  "NEXT_PUBLIC_APP_URL must be a valid HTTPS origin in production.";

/** Resolves the canonical email-confirmation callback without trusting proxy hosts. */
export function getAuthCallbackUrl({
  configuredUrl,
  production,
  requestOrigin,
}: AuthCallbackUrlOptions): string | undefined {
  const usesRequestFallback = !configuredUrl;
  const candidate = configuredUrl ?? (production ? undefined : requestOrigin);

  if (!candidate) {
    if (production) {
      throw new Error(configurationError);
    }

    return undefined;
  }

  try {
    const url = new URL(candidate);
    const isLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const hasCredentials = Boolean(url.username || url.password);
    const allowedProtocol = production
      ? url.protocol === "https:"
      : url.protocol === "https:" || (url.protocol === "http:" && isLoopback);

    if (
      hasCredentials ||
      !allowedProtocol ||
      (usesRequestFallback && !isLoopback)
    ) {
      throw new Error(configurationError);
    }

    return new URL("/auth/callback", url).toString();
  } catch (error) {
    if (production) {
      throw new Error(configurationError, { cause: error });
    }

    return undefined;
  }
}

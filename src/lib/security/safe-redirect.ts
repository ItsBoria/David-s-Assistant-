const internalOrigin = "https://internal.invalid";
const unsafePathCharacters = /[\u0000-\u0020\u007f\\]/;

/**
 * Returns a normalized same-origin application path or a trusted fallback.
 *
 * URLSearchParams decodes percent-encoded control characters before this value
 * reaches us. Rejecting C0 controls, whitespace, DEL, and backslashes prevents
 * WHATWG URL normalization from turning a path-looking value into a protocol-
 * relative redirect.
 */
export function getSafeInternalPath(
  value: string | null | undefined,
  fallback = "/app",
): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    unsafePathCharacters.test(value)
  ) {
    return fallback;
  }

  try {
    const base = new URL(internalOrigin);
    const resolved = new URL(value, base);

    if (resolved.origin !== base.origin) {
      return fallback;
    }

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

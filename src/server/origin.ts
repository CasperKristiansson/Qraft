import type { IncomingMessage } from "node:http";

export function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/u.test(host)
  );
}

export function requestOrigin(request: IncomingMessage): string | null {
  const host = request.headers.host;
  if (!host) return null;
  const encrypted = Boolean((request.socket as { encrypted?: boolean }).encrypted);
  return parseOrigin(`${encrypted ? "https" : "http"}://${host}`)?.origin ?? null;
}

export function isAllowedWebOrigin(request: Request, configuredOrigin?: string): boolean {
  const url = new URL(request.url);
  const configured = configuredOrigin ? parseOrigin(configuredOrigin) : null;
  if (configuredOrigin && !configured) return false;
  const host = request.headers.get("host") ?? url.host;
  const actual = parseOrigin(`${url.protocol}//${host}`);
  const trustedHost = (hostname: string) =>
    isLoopback(hostname) || hostname === configured?.hostname;
  if (!actual || !trustedHost(actual.hostname) || !trustedHost(url.hostname)) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  // Local CLI clients can omit Origin; web clients still need a trusted Host.
  return origin === null || origin === (configured?.origin ?? actual.origin);
}

import type { IncomingMessage } from "node:http";

export function requestOrigin(request: IncomingMessage): string | null {
  const host = request.headers.host;
  if (!host) return null;
  const encrypted = Boolean((request.socket as { encrypted?: boolean }).encrypted);
  return `${encrypted ? "https" : "http"}://${host}`;
}

export function isAllowedOrigin(request: IncomingMessage, configuredOrigin?: string): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  const effective = configuredOrigin
    ? configuredOrigin.replace(/\/$/u, "")
    : requestOrigin(request);
  return effective !== null && origin === effective;
}

export function isAllowedWebOrigin(request: Request, configuredOrigin?: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const url = new URL(request.url);
  const host = request.headers.get("host");
  const effective = configuredOrigin?.replace(/\/$/u, "") ?? `${url.protocol}//${host ?? url.host}`;
  return origin === effective;
}

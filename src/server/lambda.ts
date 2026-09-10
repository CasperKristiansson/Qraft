/** API Gateway HTTP API v2 / Lambda Function URL event subset. */
export interface QraftHttpEvent {
  version: string;
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  cookies?: string[];
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { domainName: string; http: { method: string } };
}

/** Bridge only: the backend still owns mandatory host authorization for every request. */
export function createQraftLambdaHandler(backend: { handle(request: Request): Promise<Response> }) {
  return async (event: QraftHttpEvent) => {
    if (
      event.version !== "2.0" ||
      !event.rawPath?.startsWith("/") ||
      event.rawPath.startsWith("//")
    )
      return {
        statusCode: 400,
        headers: { "Cache-Control": "no-store" },
        body: "Invalid HTTP event.",
      };
    const headers = new Headers();
    for (const [key, value] of Object.entries(event.headers ?? {}))
      if (value !== undefined) headers.set(key, value);
    if (event.cookies) headers.set("cookie", event.cookies.join("; "));
    const method = event.requestContext.http.method;
    if ((event.body?.length ?? 0) > 48 * 1024)
      return {
        statusCode: 413,
        headers: { "Cache-Control": "no-store" },
        body: "Request too large.",
      };
    const request = new Request(
      `https://${event.requestContext.domainName}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`,
      {
        method,
        headers,
        ...(event.body && !["GET", "HEAD"].includes(method)
          ? { body: event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body }
          : {}),
      },
    );
    const response = await backend.handle(request);
    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      body: await response.text(),
      isBase64Encoded: false,
    };
  };
}

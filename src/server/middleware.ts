import { createDocumentHandler, type MiddlewareOptions } from "./document-handler";
import { nodeMiddleware } from "./node-http";

export type { MiddlewareOptions } from "./document-handler";

export function createQraftMiddleware(options: MiddlewareOptions) {
  return nodeMiddleware(createDocumentHandler(options));
}

import { resolve } from "node:path";
import { normalizePath, type Plugin } from "vite";
import { z } from "zod";
import { nodeMiddleware } from "./server/node-http";
import { createProject } from "./server/project";

export interface QraftViteOptions {
  file?: string;
  endpoint?: string;
}

const optionsSchema = z.strictObject({
  file: z.string().min(1).optional(),
  endpoint: z
    .string()
    .regex(/^\/[A-Za-z0-9/_-]*[A-Za-z0-9_-]$/u)
    .optional(),
});

export function qraft(input: QraftViteOptions = {}): Plugin {
  const options = optionsSchema.parse(input);
  let project: Awaited<ReturnType<typeof createProject>> | undefined;
  const close = () => {
    project?.dispose();
    project = undefined;
  };

  return {
    name: "qraft",
    apply: "serve",
    async configureServer(server) {
      project = await createProject({
        ...(options.file ? { file: options.file } : {}),
        ...(options.endpoint ? { endpoint: options.endpoint } : {}),
        root: server.config.root,
        ...(server.config.server.origin ? { origin: server.config.server.origin } : {}),
        watch(path, changed) {
          server.watcher.add(path);
          const onChange = (candidate: string) => {
            if (normalizePath(resolve(candidate)) === normalizePath(path)) changed();
          };
          for (const event of ["add", "change", "unlink"] as const)
            server.watcher.on(event, onChange);
          return () => {
            for (const event of ["add", "change", "unlink"] as const)
              server.watcher.off(event, onChange);
          };
        },
      });
      server.middlewares.use(nodeMiddleware(project.handle));
      server.httpServer?.once("close", close);
    },
    closeBundle: close,
  };
}

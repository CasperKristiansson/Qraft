import { z } from "zod";

const text = z.string().transform((value) => value.trim().replace(/\s+/gu, " ")).refine((value) => Array.from(value).length > 0 && Array.from(value).length <= 2_000 && !/[\x00-\x08\x0e-\x1f\x7f]/u.test(value), "Use 1 to 2,000 Unicode characters without control characters");
const id = z.string().min(1).max(200);

export const elementContextSchema = z.strictObject({
  tag: z.string().max(80),
  attributes: z.record(z.string().regex(/^(id|class|role|aria-label|name|type|title|data-testid|data-test|data-cy)$/u), z.string().max(300)).refine((value) => Object.keys(value).length <= 12),
  text: z.string().max(300),
  ancestors: z.array(z.string().max(300)).max(5),
});

export const elementReferenceSchema = z.strictObject({
  route: z.string().max(2_000),
  component: z.string().max(2_000).nullable(),
  source: z.string().max(2_000).nullable(),
  line: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  selector: z.string().max(8_000).nullable(),
  context: elementContextSchema.optional(),
});

export const qaCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("createSection"), title: text }),
  z.strictObject({ type: z.literal("createTask"), sectionId: id, title: text }),
  z.strictObject({ type: z.literal("setTaskChecked"), taskId: id, checked: z.boolean() }),
  z.strictObject({ type: z.literal("addNote"), taskId: id, body: text, element: elementReferenceSchema.nullable().optional() }),
  z.strictObject({ type: z.literal("editNote"), noteId: id, body: text }),
  z.strictObject({ type: z.literal("setTaskStatus"), taskId: id, status: z.enum(["open", "completed", "skipped"]) }),
]);

export const commandRequestSchema = z.strictObject({
  commandId: z.string().min(1).max(200),
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/u),
  command: qaCommandSchema,
});

export type QACommand = z.infer<typeof qaCommandSchema>;
export type CommandRequest = z.infer<typeof commandRequestSchema>;

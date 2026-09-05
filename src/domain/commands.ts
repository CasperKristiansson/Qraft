import { z } from "zod";

const text = z.string().transform((value) => value.trim().replace(/\s+/gu, " ")).pipe(z.string().min(1).max(2_000));
const id = z.string().min(1).max(200);

export const elementReferenceSchema = z.strictObject({
  route: z.string().max(2_000),
  component: z.string().max(2_000).nullable(),
  source: z.string().max(2_000).nullable(),
  line: z.number().int().positive().nullable(),
  column: z.number().int().positive().nullable(),
  selector: z.string().max(8_000).nullable(),
});

export const qaCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("createSection"), title: text }),
  z.strictObject({ type: z.literal("createTask"), sectionId: id, title: text }),
  z.strictObject({ type: z.literal("setTaskChecked"), taskId: id, checked: z.boolean() }),
  z.strictObject({ type: z.literal("addNote"), taskId: id, body: text }),
  z.strictObject({ type: z.literal("addFinding"), taskId: id, body: text, element: elementReferenceSchema.nullable() }),
  z.strictObject({ type: z.literal("setFindingChecked"), findingId: id, checked: z.boolean() }),
]);

export const commandRequestSchema = z.strictObject({
  commandId: z.string().min(1).max(200),
  baseRevision: z.string().regex(/^[a-f0-9]{64}$/u),
  command: qaCommandSchema,
});

export type QACommand = z.infer<typeof qaCommandSchema>;
export type CommandRequest = z.infer<typeof commandRequestSchema>;

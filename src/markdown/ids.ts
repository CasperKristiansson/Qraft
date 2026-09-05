import { randomUUID } from "node:crypto";
import type { EntityKind } from "./parse";

export type IdFactory = (kind: EntityKind) => string;

export const createEntityId: IdFactory = (kind) => `${kind}_${randomUUID()}`;

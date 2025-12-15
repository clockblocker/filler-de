import z from "zod/v4";
import {
	type PageBasenameLegacy,
	PageBasenameLegacySchemaLegacy,
} from "./page";
import { type ScrollBasename, ScrollBasenameSchemaLegacy } from "./scroll";

export const NoteBasenameLegacySchemaLegacy = z.union([
	PageBasenameLegacySchemaLegacy,
	ScrollBasenameSchemaLegacy,
]);

export type NoteBasenameLegacy = PageBasenameLegacy | ScrollBasename;

export const isNoteBasenameLegacy = (s: string): s is NoteBasenameLegacy =>
	NoteBasenameLegacySchemaLegacy.safeParse(s).success;

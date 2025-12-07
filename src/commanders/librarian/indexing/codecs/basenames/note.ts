import z from "zod/v4";
import { type PageBasename, PageBasenameSchema } from "./page";
import { type ScrollBasename, ScrollBasenameSchema } from "./scroll";

export const NoteBasenameSchema = z.union([
	PageBasenameSchema,
	ScrollBasenameSchema,
]);

export type NoteBasename = PageBasename | ScrollBasename;

export const isNoteBasename = (s: string): s is NoteBasename =>
	NoteBasenameSchema.safeParse(s).success;

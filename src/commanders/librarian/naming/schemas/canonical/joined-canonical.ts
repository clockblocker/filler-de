import type z from "zod";
import { joinSeparatedCanonicalBasename } from "../transformers";
import {
	SeparatedCanonicalBasenameForCodexSchema,
	SeparatedCanonicalBasenameForSectionSchema,
	SeparatedCanonicalBasenameSchema,
} from "./separated-canonical";

export const JoinedCanonicalBasenameSchema =
	SeparatedCanonicalBasenameSchema.transform(joinSeparatedCanonicalBasename);

export const JoinedCanonicalBasenameForFileSchema =
	JoinedCanonicalBasenameSchema;

export const JoinedCanonicalBasenameForFolderSchema =
	SeparatedCanonicalBasenameForSectionSchema.transform(
		joinSeparatedCanonicalBasename,
	);

export const JoinedCanonicalBasenameForCodexSchema =
	SeparatedCanonicalBasenameForCodexSchema.transform(
		joinSeparatedCanonicalBasename,
	);

export type JoinedCanonicalBasename = z.infer<
	typeof JoinedCanonicalBasenameSchema
>;
export type JoinedCanonicalBasenameForFile = z.infer<
	typeof JoinedCanonicalBasenameForFileSchema
>;
export type JoinedCanonicalBasenameForFolder = z.infer<
	typeof JoinedCanonicalBasenameForFolderSchema
>;
export type JoinedCanonicalBasenameForCodex = z.infer<
	typeof JoinedCanonicalBasenameForCodexSchema
>;

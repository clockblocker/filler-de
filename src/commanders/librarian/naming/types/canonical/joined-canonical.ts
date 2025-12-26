import z from "zod";
import { separateJoinedCanonicalBasename } from "../transformers";
import {
	SeparatedCanonicalBasenameForCodexSchema,
	SeparatedCanonicalBasenameForSectionSchema,
	SeparatedCanonicalBasenameSchema,
} from "./separated-canonical";

export const JoinedCanonicalBasenameSchema = joinedStringSchema(
	SeparatedCanonicalBasenameSchema,
	separateJoinedCanonicalBasename,
);

export const JoinedCanonicalBasenameForFileSchema =
	JoinedCanonicalBasenameSchema;

export const JoinedCanonicalBasenameForFolderSchema = joinedStringSchema(
	SeparatedCanonicalBasenameForSectionSchema,
	separateJoinedCanonicalBasename,
);

export const JoinedCanonicalBasenameForCodexSchema = joinedStringSchema(
	SeparatedCanonicalBasenameForCodexSchema,
	separateJoinedCanonicalBasename,
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

function joinedStringSchema<
	TSeparatedSchema extends typeof SeparatedCanonicalBasenameSchema,
>(
	separatedSchema: TSeparatedSchema,
	separate: (joined: string) => z.input<TSeparatedSchema>,
	message = "Invalid joined codex canonical basename",
) {
	return z.string().superRefine((joined, ctx) => {
		const separated = separate(joined);
		if (!separatedSchema.safeParse(separated).success) {
			ctx.addIssue({ code: "custom", message });
		}
	});
}

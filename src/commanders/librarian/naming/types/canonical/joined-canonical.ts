import z from "zod";
import {
	joinSeparatedCanonicalBasename,
	separateJoinedCanonicalBasename,
} from "../transformers";
import {
	SeparatedCanonicalBasenameForCodexSchema,
	SeparatedCanonicalBasenameForSectionSchema,
	SeparatedCanonicalBasenameSchema,
} from "./separated-canonical";

// export const JoinedCanonicalBasenameSchema =
// 	SeparatedCanonicalBasenameSchema.transform(joinSeparatedCanonicalBasename);

export const JoinedCanonicalBasenameSchema = z
	.string()
	.superRefine((joined, ctx) => {
		const separated = separateJoinedCanonicalBasename(joined);
		if (!SeparatedCanonicalBasenameSchema.safeParse(separated).success) {
			ctx.addIssue({
				code: "custom",
				message: "Invalid joined canonical basename",
			});
		}
	});

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

export function joinSeparatedSchema<
	T extends typeof SeparatedCanonicalBasenameSchema,
>(separatedSchema: T) {
	return separatedSchema.transform(joinSeparatedCanonicalBasename);
}

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

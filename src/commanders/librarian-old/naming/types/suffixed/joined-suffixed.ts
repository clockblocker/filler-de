import z from "zod";
import { CUSTOM_ERROR_CODE } from "../../../../librarin-shared/types/literals";
import { separateJoinedSuffixedBasename } from "../transformers";
import {
	SeparatedSuffixedBasenameForCodexSchema,
	SeparatedSuffixedBasenameForSectionSchema,
	SeparatedSuffixedBasenameSchema,
} from "./separated-suffixed";

export const JoinedSuffixedBasenameSchema = joinedStringSchema(
	SeparatedSuffixedBasenameSchema,
	separateJoinedSuffixedBasename,
);

export const JoinedSuffixedBasenameForFileSchema = JoinedSuffixedBasenameSchema;

export const JoinedSuffixedBasenameForFolderSchema = joinedStringSchema(
	SeparatedSuffixedBasenameForSectionSchema,
	separateJoinedSuffixedBasename,
);

export const JoinedSuffixedBasenameForCodexSchema = joinedStringSchema(
	SeparatedSuffixedBasenameForCodexSchema,
	separateJoinedSuffixedBasename,
);

export type JoinedSuffixedBasename = z.infer<
	typeof JoinedSuffixedBasenameSchema
>;
export type JoinedSuffixedBasenameForFile = z.infer<
	typeof JoinedSuffixedBasenameForFileSchema
>;
export type JoinedSuffixedBasenameForFolder = z.infer<
	typeof JoinedSuffixedBasenameForFolderSchema
>;
export type JoinedSuffixedBasenameForCodex = z.infer<
	typeof JoinedSuffixedBasenameForCodexSchema
>;

function joinedStringSchema<
	TSeparatedSchema extends typeof SeparatedSuffixedBasenameSchema,
>(
	separatedSchema: TSeparatedSchema,
	separate: (joined: string) => z.input<TSeparatedSchema>,
	message = "Invalid joined codex canonical basename",
) {
	return z.string().superRefine((joined, ctx) => {
		const separated = separate(joined);
		if (!separatedSchema.safeParse(separated).success) {
			ctx.addIssue({ code: CUSTOM_ERROR_CODE, message });
		}
	});
}

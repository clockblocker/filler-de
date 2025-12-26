import { err, ok, type Result } from "neverthrow";
import {
	type JoinedSuffixedBasename,
	JoinedSuffixedBasenameSchema,
} from "../../types/suffixed/joined-canonical";
import {
	makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename,
} from "./joined-canonical-basename-and-separated-canonical-basename";

export const tryParseAsJoinedSuffixedBasename = (
	dirtyBasename: string,
): Result<JoinedSuffixedBasename, string> => {
	const parseResult = JoinedSuffixedBasenameSchema.safeParse(
		makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
			makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
				dirtyBasename,
			),
		),
	);

	if (!parseResult.success) {
		const errorMessage = parseResult.error.issues
			.map((issue) => issue.message)
			.join("; ");
		return err(
			`Invalid joined canonical basename: "${dirtyBasename}". ${errorMessage}`,
		);
	}

	return ok(parseResult.data);
};

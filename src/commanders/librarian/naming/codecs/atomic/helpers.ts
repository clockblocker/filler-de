import { err, ok, type Result } from "neverthrow";
import {
	type JoinedCanonicalBasename,
	JoinedCanonicalBasenameSchema,
} from "../../types/canonical/joined-canonical";
import {
	makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename,
} from "./joined-canonical-basename-and-separated-canonical-basename";

export const tryParseAsJoinedCanonicalBasename = (
	dirtyBasename: string,
): Result<JoinedCanonicalBasename, string> => {
	const parseResult = JoinedCanonicalBasenameSchema.safeParse(
		makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(
			makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
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

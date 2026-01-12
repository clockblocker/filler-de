import { err, ok, type Result } from "neverthrow";
import type { CodecError } from "../../../codecs/errors";

/**
 * Temporary adapter to convert CodecError to string for migration.
 * TODO: Remove after full migration to CodecError.
 */
export function codecErrorToString(error: CodecError): string {
	switch (error.kind) {
		case "SegmentIdError":
		case "SuffixError":
		case "SplitPathError":
		case "LocatorError":
		case "ZodError":
			return error.message;
	}
}

/**
 * Temporary adapter to convert Result<T, CodecError> to Result<T, string>.
 * TODO: Remove after full migration to CodecError.
 */
export function adaptCodecResult<T>(
	result: Result<T, CodecError>,
): Result<T, string> {
	return result.mapErr(codecErrorToString);
}

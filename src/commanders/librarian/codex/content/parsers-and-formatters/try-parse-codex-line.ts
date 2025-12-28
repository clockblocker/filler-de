import { err, ok, type Result } from "neverthrow";
import { makeTryParseStringAs } from "../../../naming/errors";
import {
	CodexLineForChildSectionCodexSchema,
	CodexLineForFileSchema,
	CodexLineForParentSectionCodexSchema,
	CodexLineForScrollSchema,
	type TypedCodexLine,
} from "../schema/line";
import { CodexLineType } from "../schema/literals";

const tryParseCodexLineForScroll = makeTryParseStringAs(
	CodexLineForScrollSchema,
);

const tryParseCodexLineForFile = makeTryParseStringAs(CodexLineForFileSchema);

const tryParseCodexLineForChildSectionCodex = makeTryParseStringAs(
	CodexLineForChildSectionCodexSchema,
);

const tryParseCodexLineForParentSectionCodex = makeTryParseStringAs(
	CodexLineForParentSectionCodexSchema,
);

export function tryParseCodexLine(
	dirtyLine: string,
): Result<TypedCodexLine<CodexLineType>, string> {
	const trimmedLine = dirtyLine.trim();

	const parentSectionResult =
		tryParseCodexLineForParentSectionCodex(trimmedLine);
	if (parentSectionResult.isOk()) {
		return ok({
			line: parentSectionResult.value,
			type: CodexLineType.ParentSectionCodex,
		});
	}

	// Check Scroll before ChildSectionCodex since they have the same structure
	// Scroll is more common, and ChildSectionCodex should have __- prefix
	const scrollResult = tryParseCodexLineForScroll(trimmedLine);
	if (scrollResult.isOk()) {
		// Verify it's not a codex line (codex lines have __- prefix)
		const backlinkMatch = trimmedLine.match(/\[\[([^\|]+)\|/);
		if (backlinkMatch && backlinkMatch[1]?.startsWith("__-")) {
			// It's actually a codex line, skip Scroll
		} else {
			return ok({
				line: scrollResult.value,
				type: CodexLineType.Scroll,
			});
		}
	}

	const childSectionResult =
		tryParseCodexLineForChildSectionCodex(trimmedLine);
	if (childSectionResult.isOk()) {
		return ok({
			line: childSectionResult.value,
			type: CodexLineType.ChildSectionCodex,
		});
	}

	const fileResult = tryParseCodexLineForFile(trimmedLine);
	if (fileResult.isOk()) {
		return ok({
			line: fileResult.value,
			type: CodexLineType.File,
		});
	}

	return err("Failed to parse codex line: does not match any known format");
}

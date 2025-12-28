import { err, ok, type Result } from "neverthrow";
import { formatAsTypedCodexLine } from "./parsers-and-formatters/format-node-as-typed-codex-line";
import { parseIntendedTreeNode } from "./parsers-and-formatters/parse-intended-tree-node";
import { tryParseCodexLine } from "./parsers-and-formatters/try-parse-codex-line";
import type { AnyIntendedTreeNode } from "./schema/intended-tree-node";
import type { CodexLine } from "./schema/line";

export function formatAsLine<T extends AnyIntendedTreeNode>(
	intendedTreeNode: T,
): CodexLine<T["type"]> {
	const typedCodexLine = formatAsTypedCodexLine(intendedTreeNode);
	return typedCodexLine.line as CodexLine<T["type"]>;
}

export function tryParseAsIntendedTreeNode(
	codexLine: string,
): Result<AnyIntendedTreeNode, string> {
	const typedCodexLineResult = tryParseCodexLine(codexLine);
	if (typedCodexLineResult.isErr()) {
		return err(typedCodexLineResult.error);
	}
	const typedCodexLine = typedCodexLineResult.value;
	const intendedTreeNode = parseIntendedTreeNode(typedCodexLine);
	return ok(intendedTreeNode);
}

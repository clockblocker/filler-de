import type { CodecIssue, CodecIssueCode } from "../model/issues";
import type { SourceTracked } from "../model/blocks";
import { CLOSE_RE, MARKER_RE } from "./constants";

export function splitLines(input: string): string[] {
	const matches = input.match(/[^\n]*\n|[^\n]+$/gu);
	return matches ?? [];
}

export function getMarkerId(line: string): string | null {
	if (CLOSE_RE.test(line)) {
		return null;
	}
	const match = line.match(MARKER_RE);
	return match?.[1] ?? null;
}

export function isBlankLine(line: string): boolean {
	return /^\s*$/u.test(line);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

export function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, inner]) => {
			if (Array.isArray(inner)) {
				return inner.length > 0;
			}
			return inner !== undefined;
		}),
	) as T;
}

export function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

export function makeIssue(
	code: CodecIssueCode,
	message: string,
	extra: Omit<CodecIssue, "code" | "message"> = {},
): CodecIssue {
	return { code, message, ...extra };
}

export function stripSource<T extends SourceTracked>(value: T): T {
	const clone = { ...value };
	delete clone.sourceMarkdown;
	return clone;
}

export function pushByBlockId<T>(
	map: Map<string, T[]>,
	blockId: string,
	block: T,
): void {
	const current = map.get(blockId) ?? [];
	current.push(block);
	map.set(blockId, current);
}

export function mergeUnknownRecords(
	left: Record<string, unknown> | undefined,
	right: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!left) {
		return right ? { ...right } : undefined;
	}
	if (!right) {
		return { ...left };
	}

	const result: Record<string, unknown> = { ...left };
	for (const [key, value] of Object.entries(right)) {
		const current = result[key];
		if (Array.isArray(current) && Array.isArray(value)) {
			result[key] = dedupeArray([...current, ...value]);
			continue;
		}
		if (isRecord(current) && isRecord(value)) {
			result[key] = mergeUnknownRecords(current, value) ?? {};
			continue;
		}
		result[key] = value;
	}
	return result;
}

export function dedupeArray(values: unknown[]): unknown[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		const key = stableStringify(value);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

export function mergeStringArrays(
	left: string[] | undefined,
	right: string[] | undefined,
): string[] | undefined {
	if (!left && !right) {
		return undefined;
	}
	return dedupeArray([...(left ?? []), ...(right ?? [])]) as string[];
}

export function coalesceValue<T>(
	left: T | undefined,
	right: T | undefined,
): T | undefined {
	return right !== undefined ? right : left;
}

export function joinMarkdown(left: string, right: string): string {
	return left.trimEnd().length === 0
		? right
		: `${left.trimEnd()}\n\n${right.trimStart()}`;
}

export function hasPayloadKeys<T extends Record<string, unknown>>(
	value: T,
	keys: Array<keyof T>,
): boolean {
	return keys.some((key) => value[key] !== undefined);
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => sortValue(item));
	}
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, sortValue(value[key])]),
		);
	}
	return value;
}

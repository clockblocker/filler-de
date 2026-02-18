import { createHash } from "node:crypto";
import type { IntentKey, PropagationIntent } from "./types";

export type BuildPropagationIntentKeyInput = Pick<
	PropagationIntent,
	| "sourceStableId"
	| "sourceSection"
	| "targetPath"
	| "entryMatch"
	| "mutation"
	| "creationKey"
>;

type CanonicalJson =
	| null
	| boolean
	| number
	| string
	| CanonicalJson[]
	| { [key: string]: CanonicalJson };

/**
 * Canonical tuple order follows Stage 4 dedupe semantics:
 * sourceStableId, sourceSection, targetPath, entryMatch, mutation, creationKey.
 */
function toCanonicalIntentTuple(
	input: BuildPropagationIntentKeyInput,
): readonly [
	string,
	string,
	string,
	BuildPropagationIntentKeyInput["entryMatch"],
	BuildPropagationIntentKeyInput["mutation"],
	string | null,
] {
	return [
		input.sourceStableId,
		input.sourceSection,
		input.targetPath,
		input.entryMatch,
		input.mutation,
		input.creationKey ?? null,
	];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function toCanonicalJsonValue(value: unknown): CanonicalJson {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(toCanonicalJsonValue);
	}

	if (!isRecord(value)) {
		return String(value);
	}

	const entries = Object.entries(value)
		.filter(([, entryValue]) => entryValue !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));
	const normalizedObject: { [key: string]: CanonicalJson } = {};
	for (const [key, entryValue] of entries) {
		normalizedObject[key] = toCanonicalJsonValue(entryValue);
	}
	return normalizedObject;
}

export function canonicalJsonStringify(value: unknown): string {
	return JSON.stringify(toCanonicalJsonValue(value));
}

export function buildPropagationIntentKey(
	input: BuildPropagationIntentKeyInput,
): IntentKey {
	const canonicalPayload = toCanonicalIntentTuple(input);
	return createHash("sha256")
		.update(canonicalJsonStringify(canonicalPayload))
		.digest("hex");
}

export function dedupePropagationIntentsByIntentKey(
	intents: ReadonlyArray<PropagationIntent>,
): PropagationIntent[] {
	const seen = new Set<string>();
	const deduped: PropagationIntent[] = [];
	for (const intent of intents) {
		if (seen.has(intent.intentKey)) {
			continue;
		}
		seen.add(intent.intentKey);
		deduped.push(intent);
	}
	return deduped;
}

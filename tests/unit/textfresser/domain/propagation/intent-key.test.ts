import { describe, expect, it } from "bun:test";
import {
	type BuildPropagationIntentKeyInput,
	buildPropagationIntentKey,
	dedupePropagationIntentsByIntentKey,
} from "../../../../../src/commanders/textfresser/domain/propagation/intent-key";
import type { PropagationIntent } from "../../../../../src/commanders/textfresser/domain/propagation/types";

function makeIntentKeyInput(
	overrides: Partial<BuildPropagationIntentKeyInput> = {},
): BuildPropagationIntentKeyInput {
	return {
		entryMatch: {
			stableId: "stable-target",
			strategy: "byStableId",
		},
		mutation: {
			op: "addRelation",
			relationKind: "synonym",
			sectionKind: "Relation",
			targetLemma: "Haus",
			targetWikilink: "[[Haus]]",
		},
		sourceSection: "Relation",
		sourceStableId: "stable-source",
		targetPath: "Worter/de/lexem/haus/Haus.md",
		...overrides,
	};
}

function makeIntent(
	intentKey: string,
	overrides: Partial<PropagationIntent> = {},
): PropagationIntent {
	return {
		entryMatch: {
			stableId: "stable-target",
			strategy: "byStableId",
		},
		intentKey,
		mutation: {
			op: "addRelation",
			relationKind: "synonym",
			sectionKind: "Relation",
			targetLemma: "Haus",
			targetWikilink: "[[Haus]]",
		},
		sourceNotePath: "Worter/de/lexem/machen/Machen.md",
		sourceSection: "Relation",
		sourceStableId: "stable-source",
		targetPath: "Worter/de/lexem/haus/Haus.md",
		...overrides,
	};
}

describe("buildPropagationIntentKey", () => {
	it("is deterministic for identical semantic input", () => {
		const input = makeIntentKeyInput();
		const first = buildPropagationIntentKey(input);
		const second = buildPropagationIntentKey(input);

		expect(first).toBe(second);
	});

	it("changes when semantic payload changes", () => {
		const baseline = buildPropagationIntentKey(makeIntentKeyInput());
		const differentTargetPath = buildPropagationIntentKey(
			makeIntentKeyInput({
				targetPath: "Worter/de/lexem/baum/Baum.md",
			}),
		);
		const differentMutation = buildPropagationIntentKey(
			makeIntentKeyInput({
				mutation: {
					op: "addRelation",
					relationKind: "antonym",
					sectionKind: "Relation",
					targetLemma: "Haus",
					targetWikilink: "[[Haus]]",
				},
			}),
		);

		expect(differentTargetPath).not.toBe(baseline);
		expect(differentMutation).not.toBe(baseline);
	});

	it("is insensitive to object field ordering", () => {
		const leadingMutationFields = {
			op: "addRelation",
			relationKind: "synonym",
		} as const;
		const trailingMutationFields = {
			sectionKind: "Relation",
			targetLemma: "Haus",
			targetWikilink: "[[Haus]]",
		} as const;
		const orderedMutation: BuildPropagationIntentKeyInput["mutation"] = {
			...leadingMutationFields,
			...trailingMutationFields,
		};
		const reorderedMutation: BuildPropagationIntentKeyInput["mutation"] = {
			...trailingMutationFields,
			...leadingMutationFields,
		};

		const ordered = buildPropagationIntentKey(
			makeIntentKeyInput({
				mutation: orderedMutation,
			}),
		);
		const reordered = buildPropagationIntentKey(
			makeIntentKeyInput({
				mutation: reorderedMutation,
			}),
		);

		expect(reordered).toBe(ordered);
	});

	it("is sensitive to presence or absence of creationKey", () => {
		const withoutCreationKey = buildPropagationIntentKey(
			makeIntentKeyInput(),
		);
		const withCreationKey = buildPropagationIntentKey(
			makeIntentKeyInput({
				creationKey: "create:haus:relation",
			}),
		);

		expect(withCreationKey).not.toBe(withoutCreationKey);
	});
});

describe("dedupePropagationIntentsByIntentKey", () => {
	it("keeps first-seen order and removes duplicate keys", () => {
		const first = makeIntent("intent-1");
		const duplicate = makeIntent("intent-1", {
			sourceSection: "Morphology",
		});
		const third = makeIntent("intent-2", {
			targetPath: "Worter/de/lexem/baum/Baum.md",
		});

		const deduped = dedupePropagationIntentsByIntentKey([
			first,
			duplicate,
			third,
		]);

		expect(deduped).toEqual([first, third]);
	});
});

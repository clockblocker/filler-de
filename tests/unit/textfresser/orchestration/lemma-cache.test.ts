import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";
import type { LemmaResult } from "../../../../src/commanders/textfresser/commands/lemma/types";
import type { Attestation } from "../../../../src/commanders/textfresser/common/attestation/types";
import {
	buildLemmaInvocationKey,
	getValidLemmaInvocationCache,
	handleLemmaCacheHit,
	LEMMA_IDEMPOTENCE_WINDOW_MS,
} from "../../../../src/commanders/textfresser/orchestration/lemma/lemma-cache";
import type { TextfresserState } from "../../../../src/commanders/textfresser/state/textfresser-state";
import type { SplitPathToMdFile } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

const SOURCE_PATH: SplitPathToMdFile = {
	basename: "Source",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Books"],
};

function makeAttestation(): Attestation {
	return {
		source: {
			path: SOURCE_PATH,
			ref: "![[Source#^1|^]]",
			textRaw: "Er geht schnell. ^1",
			textWithOnlyTargetMarked: "Er [geht] schnell. ^1",
		},
		target: {
			offsetInBlock: 3,
			surface: "geht",
		},
	};
}

function makeLemmaResult(): LemmaResult {
	return {
		attestation: makeAttestation(),
		disambiguationResult: { matchedIndex: 1 },
		lemma: "gehen",
		linguisticUnit: "Lexem",
		posLikeKind: "Verb",
		surfaceKind: "Lemma",
	};
}

function makeState(cacheAtMs: number): TextfresserState {
	const lemmaResult = makeLemmaResult();
	const resolvedTargetPath: SplitPathToMdFile = {
		basename: "gehen",
		extension: "md",
		kind: "MdFile",
		pathParts: ["Worter", "de", "lexem", "lemma", "g", "geh", "gehen"],
	};

	return {
		attestationForLatestNavigated: null,
		inFlightGenerate: null,
		languages: { known: "English", target: "German" },
		latestFailedSections: [],
		latestLemmaInvocationCache: {
			cachedAtMs: cacheAtMs,
			key: buildLemmaInvocationKey(lemmaResult.attestation),
			lemmaResult,
			resolvedTargetPath,
		},
		latestLemmaResult: null,
		latestLemmaTargetOwnedByInvocation: false,
		lookupInLibrary: () => [],
		pendingGenerate: null,
		promptRunner: {} as TextfresserState["promptRunner"],
		vam: {} as TextfresserState["vam"],
	};
}

function buildDictEntryContent(params: {
	entryId: string;
	sectionKinds: string[];
}): string {
	const sectionBlocks = params.sectionKinds
		.map(
			(kind) =>
				`<span class="entry_section_title entry_section_title_${kind}">${kind}</span>\ncontent`,
		)
		.join("\n");
	return `Header ^${params.entryId}\n\n${sectionBlocks}\n`;
}

describe("lemma cache", () => {
	it("builds stable invocation keys from attestation", () => {
		const key = buildLemmaInvocationKey(makeAttestation());
		expect(key).toContain("Books/Source.md");
		expect(key).toContain("![[Source#^1|^]]");
		expect(key).toContain("geht");
	});

	it("accepts cache only inside the idempotence window", () => {
		const now = Date.now();
		const state = makeState(now - (LEMMA_IDEMPOTENCE_WINDOW_MS - 1));
		const cache = state.latestLemmaInvocationCache;
		expect(cache).toBeTruthy();
		if (!cache) return;

		expect(getValidLemmaInvocationCache(state, cache.key)).not.toBeNull();

		state.latestLemmaInvocationCache = {
			...cache,
			cachedAtMs: now - (LEMMA_IDEMPOTENCE_WINDOW_MS + 1),
		};
		expect(getValidLemmaInvocationCache(state, cache.key)).toBeNull();
	});

	it("cache-hit complete entry stays silent", async () => {
		const state = makeState(Date.now());
		const cache = state.latestLemmaInvocationCache;
		expect(cache).toBeTruthy();
		if (!cache) return;

		const content = buildDictEntryContent({
			entryId: "LX-LM-VERB-1",
			sectionKinds: [
				"kontexte",
				"synonyme",
				"morpheme",
				"morphologie",
				"flexion",
				"translations",
				"tags",
			],
		});
		let refetchCalls = 0;

		const result = await handleLemmaCacheHit({
			cache: {
				...cache,
				generatedEntryId: "LX-LM-VERB-1",
			},
			onRefetch: () => {
				refetchCalls += 1;
			},
			readContent: async () => ok(content),
			state,
		});

		expect(result.isOk()).toBe(true);
		expect(refetchCalls).toBe(0);
	});

	it("cache-hit incomplete entry triggers refetch", async () => {
		const state = makeState(Date.now());
		const cache = state.latestLemmaInvocationCache;
		expect(cache).toBeTruthy();
		if (!cache) return;

		const content = buildDictEntryContent({
			entryId: "LX-LM-VERB-1",
			sectionKinds: ["kontexte", "translations"],
		});
		let refetchCalls = 0;

		const result = await handleLemmaCacheHit({
			cache: {
				...cache,
				generatedEntryId: "LX-LM-VERB-1",
			},
			onRefetch: () => {
				refetchCalls += 1;
			},
			readContent: async () => ok(content),
			state,
		});

		expect(result.isOk()).toBe(true);
		expect(refetchCalls).toBe(1);
	});
});

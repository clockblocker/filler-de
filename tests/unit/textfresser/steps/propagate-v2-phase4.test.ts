import { describe, expect, it } from "bun:test";
import type { GenerateSectionsResult } from "../../../../src/commanders/textfresser/commands/generate/steps/generate-sections";
import { propagateGeneratedSections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-generated-sections";
import { propagateInflections } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-inflections";
import { propagateMorphemes } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphemes";
import { propagateMorphologyRelations } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-morphology-relations";
import { propagateRelations } from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-relations";
import {
	foldScopedActionsToSingleWritePerTarget,
	propagateV2,
} from "../../../../src/commanders/textfresser/commands/generate/steps/propagate-v2";
import { dictNoteHelper } from "../../../../src/commanders/textfresser/domain/dict-note";
import type { DictEntry } from "../../../../src/commanders/textfresser/domain/dict-note/types";
import { parsePropagationNote } from "../../../../src/commanders/textfresser/domain/propagation";
import { cssSuffixFor } from "../../../../src/commanders/textfresser/targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../src/commanders/textfresser/targets/de/sections/section-kind";
import { type NounInflectionCell } from "../../../../src/linguistics/de/lexem/noun";
import {
	makeSystemPathForSplitPath,
	type VaultAction,
	VaultActionKind,
} from "../../../../src/managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";

type InMemoryFile = {
	content: string;
	splitPath: SplitPathToMdFile;
};

type InMemoryVault = Map<string, InMemoryFile>;

function makeSplitPath(params: {
	basename: string;
	surfaceKind: "inflected" | "lemma";
	unitKind: "lexem" | "morphem" | "phrasem";
}): SplitPathToMdFile {
	const normalized = params.basename.toLowerCase();
	const shard1 = normalized.slice(0, 1) || "_";
	const shard2 = normalized.slice(0, 3) || normalized;
	const shard3 = normalized.slice(0, 5) || normalized;

	return {
		basename: params.basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: [
			"Worter",
			"de",
			params.unitKind,
			params.surfaceKind,
			shard1,
			shard2,
			shard3,
		],
	};
}

function keyFor(splitPath: SplitPathToMdFile): string {
	return makeSystemPathForSplitPath(splitPath);
}

function setFile(vault: InMemoryVault, file: InMemoryFile): void {
	vault.set(keyFor(file.splitPath), file);
}

function createStructuredTargetNote(params: {
	header: string;
	id: string;
	includeRelation?: boolean;
	includeTags?: boolean;
	includeUsedInMarker?: boolean;
}): string {
	const sections: DictEntry["sections"] = [];
	if (params.includeRelation ?? true) {
		sections.push({
			content: "",
			kind: cssSuffixFor[DictSectionKind.Relation],
			title: TitleReprFor[DictSectionKind.Relation].German,
		});
	}
	sections.push({
		content: params.includeUsedInMarker ? "used_in:\n[[alt]]" : "",
		kind: cssSuffixFor[DictSectionKind.Morphology],
		title: TitleReprFor[DictSectionKind.Morphology].German,
	});
	if (params.includeTags ?? false) {
		sections.push({
			content: "#seed",
			kind: cssSuffixFor[DictSectionKind.Tags],
			title: TitleReprFor[DictSectionKind.Tags].German,
		});
	}

	const entry: DictEntry = {
		headerContent: params.header,
		id: params.id,
		meta: {},
		sections,
	};

	return dictNoteHelper.serialize([entry]).body;
}

function createSeedVault(): InMemoryVault {
	const vault: InMemoryVault = new Map();

	const kohlePath = makeSplitPath({
		basename: "Kohle",
		surfaceKind: "lemma",
		unitKind: "lexem",
	});
	setFile(vault, {
		content: createStructuredTargetNote({
			header: "Kohle",
			id: "LX-LM-NOUN-1",
			includeTags: true,
			includeUsedInMarker: true,
		}),
		splitPath: kohlePath,
	});

	const kraftPath = makeSplitPath({
		basename: "Kraft",
		surfaceKind: "lemma",
		unitKind: "lexem",
	});
	setFile(vault, {
		content: createStructuredTargetNote({
			header: "Kraft",
			id: "LX-LM-NOUN-1",
			includeUsedInMarker: true,
		}),
		splitPath: kraftPath,
	});

	return vault;
}

function makeFindByBasename(vault: InMemoryVault): (basename: string) => SplitPathToMdFile[] {
	return (basename: string) => {
		const matches: SplitPathToMdFile[] = [];
		for (const file of vault.values()) {
			if (file.splitPath.basename === basename) {
				matches.push(file.splitPath);
			}
		}
		return matches;
	};
}

function makeNounFixtureCtx(vault: InMemoryVault): GenerateSectionsResult {
	const inflectionCells: NounInflectionCell[] = [
		{
			article: "die",
			case: "Nominative",
			form: "Kohlekraftwerke",
			number: "Plural",
		},
		{
			article: "der",
			case: "Genitive",
			form: "Kohlekraftwerke",
			number: "Plural",
		},
	];

	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: makeSplitPath({
					basename: "Kohlekraftwerk",
					surfaceKind: "lemma",
					unitKind: "lexem",
				}),
			},
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells,
		matchedEntry: null,
		morphemes: [
			{ kind: "Prefix", surf: "Ur" },
			{ kind: "Root", lemma: "Kohle", surf: "kohle" },
			{ kind: "Root", lemma: "Kraft", surf: "kraft" },
		],
		morphology: {
			compoundedFromLemmas: ["Kohle", "Kraft"],
		},
		nextIndex: 1,
		nounInflectionGenus: "Neutrum",
		relations: [{ kind: "Synonym", words: ["Kohle"] }],
		resultingActions: [],
		sourceTranslation: "coal power station",
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: {
					source: {
						path: makeSplitPath({
							basename: "Reading",
							surfaceKind: "lemma",
							unitKind: "lexem",
						}),
						ref: "![[Reading#^1|^]]",
					},
				},
				disambiguationResult: null,
				lemma: "Kohlekraftwerk",
				linguisticUnit: "Lexem",
				posLikeKind: "Noun",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: {
				findByBasename: makeFindByBasename(vault),
			},
		},
	} as unknown as GenerateSectionsResult;
}

type Phase5SliceFixture = {
	linguisticUnit: "Lexem" | "Phrasem";
	posLikeKind: string;
	sliceKey: string;
};

const PHASE5_NON_VERB_SLICES: ReadonlyArray<Phase5SliceFixture> = [
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Adjective",
		sliceKey: "de/lexem/adjective",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Adverb", sliceKey: "de/lexem/adverb" },
	{ linguisticUnit: "Lexem", posLikeKind: "Article", sliceKey: "de/lexem/article" },
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Conjunction",
		sliceKey: "de/lexem/conjunction",
	},
	{
		linguisticUnit: "Lexem",
		posLikeKind: "InteractionalUnit",
		sliceKey: "de/lexem/interactionalunit",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Particle", sliceKey: "de/lexem/particle" },
	{
		linguisticUnit: "Lexem",
		posLikeKind: "Preposition",
		sliceKey: "de/lexem/preposition",
	},
	{ linguisticUnit: "Lexem", posLikeKind: "Pronoun", sliceKey: "de/lexem/pronoun" },
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "Collocation",
		sliceKey: "de/phrasem/collocation",
	},
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "CulturalQuotation",
		sliceKey: "de/phrasem/culturalquotation",
	},
	{
		linguisticUnit: "Phrasem",
		posLikeKind: "DiscourseFormula",
		sliceKey: "de/phrasem/discourseformula",
	},
	{ linguisticUnit: "Phrasem", posLikeKind: "Idiom", sliceKey: "de/phrasem/idiom" },
	{ linguisticUnit: "Phrasem", posLikeKind: "Proverb", sliceKey: "de/phrasem/proverb" },
];

function makePhase5NonVerbFixtureCtx(
	vault: InMemoryVault,
	slice: Phase5SliceFixture,
): GenerateSectionsResult {
	const isPhrasem = slice.linguisticUnit === "Phrasem";
	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: makeSplitPath({
					basename: isPhrasem ? "Auf jeden Fall" : "Langsam",
					surfaceKind: "lemma",
					unitKind: isPhrasem ? "phrasem" : "lexem",
				}),
			},
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells: [],
		matchedEntry: null,
		morphemes: [],
		morphology: {
			compoundedFromLemmas: [],
		},
		nextIndex: 1,
		nounInflectionGenus: undefined,
		relations: [{ kind: "Synonym", words: ["Kohle"] }],
		resultingActions: [],
		sourceTranslation: "fixture translation",
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: {
					source: {
						path: makeSplitPath({
							basename: "Reading",
							surfaceKind: "lemma",
							unitKind: "lexem",
						}),
						ref: "![[Reading#^1|^]]",
					},
				},
				disambiguationResult: null,
				lemma: isPhrasem ? "Auf jeden Fall" : "Langsam",
				linguisticUnit: slice.linguisticUnit,
				posLikeKind: slice.posLikeKind,
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: {
				findByBasename: makeFindByBasename(vault),
			},
		},
	} as unknown as GenerateSectionsResult;
}

function makeVerbFixtureCtx(vault: InMemoryVault): GenerateSectionsResult {
	return {
		actions: [],
		allEntries: [],
		commandContext: {
			activeFile: {
				content: "",
				splitPath: makeSplitPath({
					basename: "Aufpassen",
					surfaceKind: "lemma",
					unitKind: "lexem",
				}),
			},
		},
		existingEntries: [],
		failedSections: [],
		inflectionCells: [],
		matchedEntry: null,
		morphemes: [
			{ kind: "Prefix", separability: "Separable", surf: "auf" },
			{ kind: "Root", lemma: "passen", surf: "pass" },
		],
		morphology: {
			compoundedFromLemmas: ["Kohle"],
			derivedFromLemma: "Kraft",
			prefixEquation: {
				baseLemma: "passen",
				prefixDisplay: "auf",
				prefixTarget: "auf",
				sourceLemma: "Aufpassen",
			},
		},
		nextIndex: 1,
		nounInflectionGenus: undefined,
		relations: [{ kind: "Synonym", words: ["Kohle"] }],
		resultingActions: [],
		sourceTranslation: "to pay attention",
		textfresserState: {
			languages: { known: "English", target: "German" },
			latestLemmaResult: {
				attestation: {
					source: {
						path: makeSplitPath({
							basename: "Reading",
							surfaceKind: "lemma",
							unitKind: "lexem",
						}),
						ref: "![[Reading#^1|^]]",
					},
				},
				disambiguationResult: null,
				lemma: "Aufpassen",
				linguisticUnit: "Lexem",
				posLikeKind: "Verb",
				surfaceKind: "Lemma",
			},
			lookupInLibrary: () => [],
			vam: {
				findByBasename: makeFindByBasename(vault),
			},
		},
	} as unknown as GenerateSectionsResult;
}

async function resolveProcessAfterContent(
	action: Extract<VaultAction, { kind: typeof VaultActionKind.ProcessMdFile }>,
	before: string,
): Promise<string> {
	if ("transform" in action.payload) {
		const after = action.payload.transform(before);
		return typeof after === "string" ? after : await after;
	}
	return action.payload.after;
}

async function applyActionsToVault(params: {
	actions: ReadonlyArray<VaultAction>;
	vault: InMemoryVault;
}): Promise<{ changedPaths: Set<string> }> {
	const changedPaths = new Set<string>();

	for (const action of params.actions) {
		if (action.kind === VaultActionKind.RenameMdFile) {
			const fromKey = keyFor(action.payload.from);
			const toKey = keyFor(action.payload.to);
			const existing = params.vault.get(fromKey);
			params.vault.delete(fromKey);
			params.vault.set(toKey, {
				content: existing?.content ?? "",
				splitPath: action.payload.to,
			});
			continue;
		}

		if (action.kind === VaultActionKind.UpsertMdFile) {
			const pathKey = keyFor(action.payload.splitPath);
			const existing = params.vault.get(pathKey);
			if (!existing) {
				params.vault.set(pathKey, {
					content:
						typeof action.payload.content === "string"
							? action.payload.content
							: "",
					splitPath: action.payload.splitPath,
				});
			} else if (typeof action.payload.content === "string") {
				existing.content = action.payload.content;
			}
			continue;
		}

		if (action.kind === VaultActionKind.ProcessMdFile) {
			const pathKey = keyFor(action.payload.splitPath);
			const before = params.vault.get(pathKey)?.content ?? "";
			const after = await resolveProcessAfterContent(action, before);
			params.vault.set(pathKey, {
				content: after,
				splitPath: action.payload.splitPath,
			});
			if (after !== before) {
				changedPaths.add(pathKey);
			}
			continue;
		}
	}

	return { changedPaths };
}

function buildDtoSnapshot(vault: InMemoryVault): Record<string, unknown> {
	const snapshot: Record<string, unknown> = {};
	const sortedPaths = [...vault.keys()].sort((left, right) =>
		left.localeCompare(right),
	);
	for (const path of sortedPaths) {
		const file = vault.get(path);
		if (!file) {
			continue;
		}
		const parsed = parsePropagationNote(file.content);
		if (parsed.length === 0) {
			continue;
		}
		snapshot[path] = parsed;
	}
	return snapshot;
}

function buildMutationKindSet(vault: InMemoryVault): Set<string> {
	const set = new Set<string>();
	for (const [path, file] of vault.entries()) {
		const parsed = parsePropagationNote(file.content);
		for (const entry of parsed) {
			if (entry.headerContent.startsWith("#Inflection/")) {
				set.add(`${path}|Inflection`);
			}
			for (const section of entry.sections) {
				if (section.kind === "Raw") {
					continue;
				}
				set.add(`${path}|${section.kind}`);
			}
		}
	}
	return set;
}

function buildProcessWriteCountByTarget(
	actions: ReadonlyArray<VaultAction>,
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const action of actions) {
		if (action.kind !== VaultActionKind.ProcessMdFile) {
			continue;
		}
		const key = keyFor(action.payload.splitPath);
		const next = (counts.get(key) ?? 0) + 1;
		counts.set(key, next);
	}
	return counts;
}

function runLegacyPropagationForParity(
	ctx: GenerateSectionsResult,
) {
	return propagateRelations(ctx)
		.andThen(propagateMorphologyRelations)
		.andThen(propagateMorphemes)
		.andThen(propagateInflections);
}

describe("propagation v2 phase 4 noun slice", () => {
	it("keeps semantic DTO parity with legacy v1 on curated noun fixture", async () => {
		const legacyVault = createSeedVault();
		const v2Vault = createSeedVault();

		const legacyResult = runLegacyPropagationForParity(
			makeNounFixtureCtx(legacyVault),
		);
		const v2Result = propagateV2(makeNounFixtureCtx(v2Vault));

		expect(legacyResult.isOk()).toBe(true);
		expect(v2Result.isOk()).toBe(true);
		if (legacyResult.isErr() || v2Result.isErr()) {
			return;
		}

		await applyActionsToVault({
			actions: legacyResult.value.actions,
			vault: legacyVault,
		});
		await applyActionsToVault({
			actions: v2Result.value.actions,
			vault: v2Vault,
		});

		expect(buildDtoSnapshot(v2Vault)).toEqual(buildDtoSnapshot(legacyVault));
	});

	it("is idempotent: second v2 run produces zero changed-target writes", async () => {
		const vault = createSeedVault();
		const firstRun = propagateV2(makeNounFixtureCtx(vault));
		expect(firstRun.isOk()).toBe(true);
		if (firstRun.isErr()) {
			return;
		}

		const firstApply = await applyActionsToVault({
			actions: firstRun.value.actions,
			vault,
		});
		expect(firstApply.changedPaths.size).toBeGreaterThan(0);

		const secondRun = propagateV2(makeNounFixtureCtx(vault));
		expect(secondRun.isOk()).toBe(true);
		if (secondRun.isErr()) {
			return;
		}
		const secondApply = await applyActionsToVault({
			actions: secondRun.value.actions,
			vault,
		});

		expect(secondApply.changedPaths.size).toBe(0);
	});

	it("enforces one write action per target note on v2 path", () => {
		const result = propagateV2(makeNounFixtureCtx(createSeedVault()));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		const processCounts = buildProcessWriteCountByTarget(result.value.actions);
		for (const count of processCounts.values()) {
			expect(count).toBe(1);
		}
	});

	it("fails fast on unsupported scoped actions (all-or-nothing fold gate)", () => {
		const result = foldScopedActionsToSingleWritePerTarget([
			{
				kind: VaultActionKind.TrashMdFile,
				payload: {
					splitPath: makeSplitPath({
						basename: "Broken",
						surfaceKind: "lemma",
						unitKind: "lexem",
					}),
				},
			},
		]);

		expect(result.isErr()).toBe(true);
	});

	it("supports ProcessMdFile before/after payload by normalizing it to a transform", async () => {
		const splitPath = makeSplitPath({
			basename: "ShapeMismatch",
			surfaceKind: "lemma",
			unitKind: "lexem",
		});
		const result = foldScopedActionsToSingleWritePerTarget([
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					after: "after",
					before: "before",
					splitPath,
				},
			},
		]);

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		const vault = new Map<string, InMemoryFile>();
		setFile(vault, {
			content: "before + before",
			splitPath,
		});
		await applyActionsToVault({
			actions: result.value,
			vault,
		});
		expect(vault.get(keyFor(splitPath))?.content).toBe("after + before");
	});

	it("supports UpsertMdFile non-null content with deterministic transform order", async () => {
		const splitPath = makeSplitPath({
			basename: "NonNullUpsert",
			surfaceKind: "lemma",
			unitKind: "lexem",
		});
		const result = foldScopedActionsToSingleWritePerTarget([
			{
				kind: VaultActionKind.UpsertMdFile,
				payload: {
					content: "#seed",
					splitPath,
				},
			},
			{
				kind: VaultActionKind.ProcessMdFile,
				payload: {
					splitPath,
					transform: (content: string) => `${content}\n#tail`,
				},
			},
		]);

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		const vault = new Map<string, InMemoryFile>();
		await applyActionsToVault({
			actions: result.value,
			vault,
		});
		expect(vault.get(keyFor(splitPath))?.content).toBe("#seed\n#tail");
	});

	it("matches legacy order-insensitive target+mutation-kind set", async () => {
		const legacyVault = createSeedVault();
		const v2Vault = createSeedVault();

		const legacyResult = runLegacyPropagationForParity(
			makeNounFixtureCtx(legacyVault),
		);
		const v2Result = propagateV2(makeNounFixtureCtx(v2Vault));

		expect(legacyResult.isOk()).toBe(true);
		expect(v2Result.isOk()).toBe(true);
		if (legacyResult.isErr() || v2Result.isErr()) {
			return;
		}

		await applyActionsToVault({
			actions: legacyResult.value.actions,
			vault: legacyVault,
		});
		await applyActionsToVault({
			actions: v2Result.value.actions,
			vault: v2Vault,
		});

		expect(buildMutationKindSet(v2Vault)).toEqual(
			buildMutationKindSet(legacyVault),
		);
	});
});

describe("propagation v2 phase 5 non-verb slices", () => {
	it("keeps semantic DTO parity with legacy v1 across migrated non-verb slices", async () => {
		for (const slice of PHASE5_NON_VERB_SLICES) {
			const legacyVault = createSeedVault();
			const v2Vault = createSeedVault();
			const legacyResult = runLegacyPropagationForParity(
				makePhase5NonVerbFixtureCtx(legacyVault, slice),
			);
			const v2Result = propagateV2(makePhase5NonVerbFixtureCtx(v2Vault, slice));

			expect(legacyResult.isOk()).toBe(true);
			expect(v2Result.isOk()).toBe(true);
			if (legacyResult.isErr() || v2Result.isErr()) {
				return;
			}

			await applyActionsToVault({
				actions: legacyResult.value.actions,
				vault: legacyVault,
			});
			await applyActionsToVault({
				actions: v2Result.value.actions,
				vault: v2Vault,
			});

			expect(buildDtoSnapshot(v2Vault)).toEqual(buildDtoSnapshot(legacyVault));
		}
	});

	it("is idempotent for migrated non-verb slices", async () => {
		for (const slice of PHASE5_NON_VERB_SLICES) {
			const vault = createSeedVault();
			const firstRun = propagateV2(makePhase5NonVerbFixtureCtx(vault, slice));
			expect(firstRun.isOk()).toBe(true);
			if (firstRun.isErr()) {
				return;
			}

			const firstApply = await applyActionsToVault({
				actions: firstRun.value.actions,
				vault,
			});
			expect(firstApply.changedPaths.size).toBeGreaterThan(0);

			const secondRun = propagateV2(makePhase5NonVerbFixtureCtx(vault, slice));
			expect(secondRun.isOk()).toBe(true);
			if (secondRun.isErr()) {
				return;
			}
			const secondApply = await applyActionsToVault({
				actions: secondRun.value.actions,
				vault,
			});

			expect(secondApply.changedPaths.size).toBe(0);
		}
	});

	it("enforces one write action per target note for migrated non-verb slices", () => {
		for (const slice of PHASE5_NON_VERB_SLICES) {
			const result = propagateV2(
				makePhase5NonVerbFixtureCtx(createSeedVault(), slice),
			);
			expect(result.isOk()).toBe(true);
			if (result.isErr()) {
				return;
			}

			const processCounts = buildProcessWriteCountByTarget(result.value.actions);
			for (const count of processCounts.values()) {
				expect(count).toBe(1);
			}
		}
	});
});

describe("propagation v2 phase 5 verb slice", () => {
	it("writes source-note separability-decoration action on wrapper v2 route", async () => {
		const sourcePath = makeSplitPath({
			basename: "Reading",
			surfaceKind: "lemma",
			unitKind: "lexem",
		});
		const sourceContent =
			"Beide Spannen bleiben erhalten: [[Aufpassen|Pass]] ... [[Aufpassen|auf]].";
		const vault = createSeedVault();
		setFile(vault, { content: sourceContent, splitPath: sourcePath });
		const result = propagateGeneratedSections(makeVerbFixtureCtx(vault));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		const sourceKey = keyFor(sourcePath);
		const hasSourceProcess = result.value.actions.some(
			(action) =>
				action.kind === VaultActionKind.ProcessMdFile &&
				keyFor(action.payload.splitPath) === sourceKey,
		);
		expect(hasSourceProcess).toBe(true);

		await applyActionsToVault({
			actions: result.value.actions,
			vault,
		});
		expect(vault.get(sourceKey)?.content).toEqual(sourceContent);
	});

	it("keeps semantic DTO parity with legacy v1 on curated verb fixture", async () => {
		const legacyVault = createSeedVault();
		const v2Vault = createSeedVault();

		const legacyResult = runLegacyPropagationForParity(
			makeVerbFixtureCtx(legacyVault),
		);
		const v2Result = propagateV2(makeVerbFixtureCtx(v2Vault));

		expect(legacyResult.isOk()).toBe(true);
		expect(v2Result.isOk()).toBe(true);
		if (legacyResult.isErr() || v2Result.isErr()) {
			return;
		}

		await applyActionsToVault({
			actions: legacyResult.value.actions,
			vault: legacyVault,
		});
		await applyActionsToVault({
			actions: v2Result.value.actions,
			vault: v2Vault,
		});

		expect(buildDtoSnapshot(v2Vault)).toEqual(buildDtoSnapshot(legacyVault));
	});

	it("is idempotent for verb slice", async () => {
		const vault = createSeedVault();
		const firstRun = propagateV2(makeVerbFixtureCtx(vault));
		expect(firstRun.isOk()).toBe(true);
		if (firstRun.isErr()) {
			return;
		}

		const firstApply = await applyActionsToVault({
			actions: firstRun.value.actions,
			vault,
		});
		expect(firstApply.changedPaths.size).toBeGreaterThan(0);

		const secondRun = propagateV2(makeVerbFixtureCtx(vault));
		expect(secondRun.isOk()).toBe(true);
		if (secondRun.isErr()) {
			return;
		}
		const secondApply = await applyActionsToVault({
			actions: secondRun.value.actions,
			vault,
		});

		expect(secondApply.changedPaths.size).toBe(0);
	});

	it("enforces one write action per target note for verb slice", () => {
		const result = propagateV2(makeVerbFixtureCtx(createSeedVault()));
		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			return;
		}

		const processCounts = buildProcessWriteCountByTarget(result.value.actions);
		for (const count of processCounts.values()) {
			expect(count).toBe(1);
		}
	});

	it("matches legacy order-insensitive target+mutation-kind set for verb slice", async () => {
		const legacyVault = createSeedVault();
		const v2Vault = createSeedVault();

		const legacyResult = runLegacyPropagationForParity(
			makeVerbFixtureCtx(legacyVault),
		);
		const v2Result = propagateV2(makeVerbFixtureCtx(v2Vault));

		expect(legacyResult.isOk()).toBe(true);
		expect(v2Result.isOk()).toBe(true);
		if (legacyResult.isErr() || v2Result.isErr()) {
			return;
		}

		await applyActionsToVault({
			actions: legacyResult.value.actions,
			vault: legacyVault,
		});
		await applyActionsToVault({
			actions: v2Result.value.actions,
			vault: v2Vault,
		});

		expect(buildMutationKindSet(v2Vault)).toEqual(
			buildMutationKindSet(legacyVault),
		);
	});
});

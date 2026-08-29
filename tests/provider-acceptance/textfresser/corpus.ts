export const PROVIDER_SUITES = ["smoke", "edge"] as const;
export type ProviderSuite = (typeof PROVIDER_SUITES)[number];

export type ExpectedSenseOutcome = "matched" | "new";

interface ExpectedClassification {
	readonly canonicalLemma: string;
	readonly discriminator: string;
	readonly lemmaKind: "Lexeme" | "Phraseme";
	readonly senseOutcome: ExpectedSenseOutcome;
}

export interface ProviderAcceptanceCase {
	readonly attestation: string;
	readonly dependsOn?: readonly string[];
	readonly description: string;
	readonly expected: ExpectedClassification;
	readonly group: string;
	readonly id: string;
	readonly legacySourcePath: string;
	readonly selection: string;
	readonly suite: ProviderSuite;
}

const SMOKE_SOURCE_PATH = "Outside/Migration-Smoke-Test.md";
const EDGE_SOURCE_ROOT = "textfresser/test-runs";

/**
 * The provider-owned part of the two legacy live runners. Vault mutation
 * assertions are intentionally described separately below: this corpus is
 * consumed through @textfresser/lexical-generation-next's public interface.
 */
export const PROVIDER_ACCEPTANCE_CASES = [
	{
		attestation: "Der Fahrer fährt mit der Fahrkarte zur Abfahrt. ^0",
		description: "Derivation from fahren",
		expected: {
			canonicalLemma: "Fahrer",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-FAHRER",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Fahrer",
		suite: "smoke",
	},
	{
		attestation: "Der Fahrer fährt mit der Fahrkarte zur Abfahrt. ^0",
		description: "Compound/prefix derivation",
		expected: {
			canonicalLemma: "Abfahrt",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-ABFAHRT",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Abfahrt",
		suite: "smoke",
	},
	{
		attestation:
			"Sie unterschreibt das Formular, und ihre Unterschrift steht schon unten. ^1",
		description: "Noun from unterschreiben",
		expected: {
			canonicalLemma: "Unterschrift",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-UNTERSCHRIFT",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Unterschrift",
		suite: "smoke",
	},
	{
		attestation:
			"Sie unterschreibt das Formular, und ihre Unterschrift steht schon unten. ^1",
		description: "Conjugated verb",
		expected: {
			canonicalLemma: "unterschreiben",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-UNTERSCHREIBEN",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "unterschreibt",
		suite: "smoke",
	},
	{
		attestation: "Die Bauarbeiter bauen heute einen Neubau am Stadtrand. ^2",
		description: "Compound word",
		expected: {
			canonicalLemma: "Bauarbeiter",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-BAUARBEITER",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Bauarbeiter",
		suite: "smoke",
	},
	{
		attestation: "Die Bauarbeiter bauen heute einen Neubau am Stadtrand. ^2",
		description: "Compound (Neu+Bau)",
		expected: {
			canonicalLemma: "Neubau",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-NEUBAU",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Neubau",
		suite: "smoke",
	},
	{
		attestation:
			"Ich stelle mich kurz vor, und meine Vorstellung ist sehr knapp. ^3",
		description: "Separable-verb derivation",
		expected: {
			canonicalLemma: "Vorstellung",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-VORSTELLUNG",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Vorstellung",
		suite: "smoke",
	},
	{
		attestation:
			"Wir arbeiten im Team, und die Zusammenarbeit verbessert unsere Arbeit. ^4",
		description: "Compound",
		expected: {
			canonicalLemma: "Zusammenarbeit",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-ZUSAMMENARBEIT",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Zusammenarbeit",
		suite: "smoke",
	},
	{
		attestation:
			"Wir arbeiten im Team, und die Zusammenarbeit verbessert unsere Arbeit. ^4",
		description: "Root noun",
		expected: {
			canonicalLemma: "Arbeit",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "smoke",
		id: "SMOKE-ARBEIT",
		legacySourcePath: SMOKE_SOURCE_PATH,
		selection: "Arbeit",
		suite: "smoke",
	},
	{
		attestation: "Das alte Schloss thront über der Stadt. ^h1a",
		description: "New noun entry, castle sense",
		expected: {
			canonicalLemma: "Schloss",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H1",
		id: "H1-A",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H1/H1-A-schloss-castle.md`,
		selection: "Schloss",
		suite: "edge",
	},
	{
		attestation: "Er steckte den Schlüssel ins Schloss. ^h1b",
		dependsOn: ["H1-A"],
		description: "Same lemma and POS, different lock sense",
		expected: {
			canonicalLemma: "Schloss",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H1",
		id: "H1-B",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H1/H1-B-schloss-lock.md`,
		selection: "Schloss",
		suite: "edge",
	},
	{
		attestation: "Im Schloss gab es hundert Zimmer. ^h1c",
		dependsOn: ["H1-A", "H1-B"],
		description: "Re-encounter should match the castle sense",
		expected: {
			canonicalLemma: "Schloss",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "matched",
		},
		group: "H1",
		id: "H1-C",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H1/H1-C-schloss-reencounter.md`,
		selection: "Schloss",
		suite: "edge",
	},
	{
		attestation: "Die Bank am Fluss war nass vom Regen. ^h1d",
		description: "New noun, bench sense",
		expected: {
			canonicalLemma: "Bank",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H1",
		id: "H1-D",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H1/H1-D-bank-bench.md`,
		selection: "Bank",
		suite: "edge",
	},
	{
		attestation: "Sie hebt Geld bei der Bank ab. ^h1e",
		dependsOn: ["H1-D"],
		description: "Same lemma and POS, different financial sense",
		expected: {
			canonicalLemma: "Bank",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H1",
		id: "H1-E",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H1/H1-E-bank-finance.md`,
		selection: "Bank",
		suite: "edge",
	},
	{
		attestation: "Das Essen im Restaurant war ausgezeichnet. ^h2a",
		description: "Noun: food or meal",
		expected: {
			canonicalLemma: "Essen",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-A",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-A-essen-noun.md`,
		selection: "Essen",
		suite: "edge",
	},
	{
		attestation: "Wir essen heute Abend zusammen. ^h2b",
		description: "Verb with the same spelling but a different POS",
		expected: {
			canonicalLemma: "essen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-B",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-B-essen-verb.md`,
		selection: "essen",
		suite: "edge",
	},
	{
		attestation: "Die Fliegen im Sommer sind lästig. ^h2c",
		description: "Plural noun resolves to Fliege",
		expected: {
			canonicalLemma: "Fliege",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-C",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-C-fliege-noun.md`,
		selection: "Fliegen",
		suite: "edge",
	},
	{
		attestation: "Wir fliegen morgen nach Berlin. ^h2d",
		description: "Verb resolves separately from noun Fliege",
		expected: {
			canonicalLemma: "fliegen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-D",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-D-fliegen-verb.md`,
		selection: "fliegen",
		suite: "edge",
	},
	{
		attestation: "Der Lauf des Flusses war ruhig. ^h2e",
		description: "Noun: course or run",
		expected: {
			canonicalLemma: "Lauf",
			discriminator: "NOUN",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-E",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-E-lauf-noun.md`,
		selection: "Lauf",
		suite: "edge",
	},
	{
		attestation: "Die Kinder laufen schnell im Park. ^h2f",
		description: "Verb resolves separately from noun Lauf",
		expected: {
			canonicalLemma: "laufen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "H2",
		id: "H2-F",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/H2/H2-F-laufen-verb.md`,
		selection: "laufen",
		suite: "edge",
	},
	{
		attestation: "Er macht die Tür auf. ^v1a",
		description: "Detached prefix resolves to aufmachen",
		expected: {
			canonicalLemma: "aufmachen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-A",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-A-aufmachen.md`,
		selection: "macht",
		suite: "edge",
	},
	{
		attestation: "Wann fängst du damit an? ^v1b",
		description: "Inflected stem and detached prefix resolve to anfangen",
		expected: {
			canonicalLemma: "anfangen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-B",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-B-anfangen.md`,
		selection: "fängst",
		suite: "edge",
	},
	{
		attestation: "Sie kauft im Supermarkt ein. ^v1c",
		description: "Detached prefix resolves to einkaufen",
		expected: {
			canonicalLemma: "einkaufen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-C",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-C-einkaufen.md`,
		selection: "kauft",
		suite: "edge",
	},
	{
		attestation: "Pass bitte auf die Kinder auf! ^v1d",
		description: "Imperative with two auf tokens resolves to aufpassen",
		expected: {
			canonicalLemma: "aufpassen",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-D",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-D-aufpassen.md`,
		selection: "Pass",
		suite: "edge",
	},
	{
		attestation: "Er gibt das Buch morgen zurück. ^v1e",
		description: "Detached prefix resolves to zurückgeben",
		expected: {
			canonicalLemma: "zurückgeben",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-E",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-E-zurueckgeben.md`,
		selection: "gibt",
		suite: "edge",
	},
	{
		attestation: "Sie hört mit dem Rauchen auf. ^v1f",
		description: "Detached prefix resolves to aufhören",
		expected: {
			canonicalLemma: "aufhören",
			discriminator: "VERB",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "SV",
		id: "SV-F",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/SV/SV-F-aufhoeren.md`,
		selection: "hört",
		suite: "edge",
	},
	{
		attestation: "Auf keinen Fall mache ich das. ^ph1a",
		description: "Multi-word phraseme",
		expected: {
			canonicalLemma: "auf keinen Fall",
			discriminator: "Idiom",
			lemmaKind: "Phraseme",
			senseOutcome: "new",
		},
		group: "PH1",
		id: "PH1-A",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/PH1/PH1-A-auf-keinen-fall.md`,
		selection: "Auf keinen Fall",
		suite: "edge",
	},
	{
		attestation: "Sie verließ Hals über Kopf das Haus. ^ph1b",
		description: "Idiom phraseme",
		expected: {
			canonicalLemma: "Hals über Kopf",
			discriminator: "Idiom",
			lemmaKind: "Phraseme",
			senseOutcome: "new",
		},
		group: "PH1",
		id: "PH1-B",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/PH1/PH1-B-hals-ueber-kopf.md`,
		selection: "Hals über Kopf",
		suite: "edge",
	},
	{
		attestation: "Alles ist in Ordnung. ^ph1c",
		description: "Common phrase",
		expected: {
			canonicalLemma: "in Ordnung",
			discriminator: "Idiom",
			lemmaKind: "Phraseme",
			senseOutcome: "new",
		},
		group: "PH1",
		id: "PH1-C",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/PH1/PH1-C-in-ordnung.md`,
		selection: "in Ordnung",
		suite: "edge",
	},
	{
		attestation: "Er hat ins Schwarze getroffen. ^ph1d",
		description: "Idiom with an inflected article and verb",
		expected: {
			canonicalLemma: "ins Schwarze treffen",
			discriminator: "Idiom",
			lemmaKind: "Phraseme",
			senseOutcome: "new",
		},
		group: "PH1",
		id: "PH1-D",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/PH1/PH1-D-schwarze-treffen.md`,
		selection: "ins Schwarze getroffen",
		suite: "edge",
	},
	{
		attestation: "Das Wetter ist heute schön. ^adj1a",
		description: "Adjective base form",
		expected: {
			canonicalLemma: "schön",
			discriminator: "ADJ",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "ADJ1",
		id: "ADJ1-A",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/ADJ1/ADJ1-A-schoen-base.md`,
		selection: "schön",
		suite: "edge",
	},
	{
		attestation: "Morgen wird es noch schöner. ^adj1b",
		dependsOn: ["ADJ1-A"],
		description: "Comparative resolves to schön and matches its sense",
		expected: {
			canonicalLemma: "schön",
			discriminator: "ADJ",
			lemmaKind: "Lexeme",
			senseOutcome: "matched",
		},
		group: "ADJ1",
		id: "ADJ1-B",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/ADJ1/ADJ1-B-schoener-comp.md`,
		selection: "schöner",
		suite: "edge",
	},
	{
		attestation: "Der klügste Schüler hat gewonnen. ^adj1c",
		description: "Superlative resolves to klug",
		expected: {
			canonicalLemma: "klug",
			discriminator: "ADJ",
			lemmaKind: "Lexeme",
			senseOutcome: "new",
		},
		group: "ADJ1",
		id: "ADJ1-C",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/ADJ1/ADJ1-C-klug-super.md`,
		selection: "klügste",
		suite: "edge",
	},
	{
		attestation: "Sie ist klüger als ihr Bruder. ^adj1d",
		dependsOn: ["ADJ1-C"],
		description: "Comparative resolves to klug and matches its sense",
		expected: {
			canonicalLemma: "klug",
			discriminator: "ADJ",
			lemmaKind: "Lexeme",
			senseOutcome: "matched",
		},
		group: "ADJ1",
		id: "ADJ1-D",
		legacySourcePath: `${EDGE_SOURCE_ROOT}/ADJ1/ADJ1-D-klug-comp.md`,
		selection: "klüger",
		suite: "edge",
	},
] as const satisfies readonly ProviderAcceptanceCase[];

export const LEGACY_ASSERTION_OWNERSHIP = {
	orchestration: [
		"the Lemma command rewrites the source through Textfresser",
		"the selected surface is linked exactly once",
		"the source contains no nested wikilinks after reruns",
		"the link target resolves to one dictionary note",
		"the dictionary note is persisted with Textfresser metadata",
	] as const,
	provider: [
		"the selection resolves through the production prompt and schema",
		"the canonical lemma matches the linguistic expectation",
		"the lemma kind and discriminator match",
		"sense disambiguation returns new or matched as expected",
		"a new sense produces schema-valid lexical information",
	] as const,
} as const;

/**
 * The deterministic P0 stories that used helpers.ts are retained as migration
 * data, not sent to Gemini. Their proper destination is the Textfresser
 * orchestration/in-process suite because the legacy version replaced the
 * provider and background generator with renderer monkey-patches.
 */
export const LEGACY_P0_ORCHESTRATION_CORPUS = {
	assertions: {
		idleMakesRewriteVisible: "Mann",
		latestPendingGenerate: ["klar", "deutlich"],
		rerunIsIdempotent: ["Mann", "Katze", "fängt", "auf", "klar"],
		secondGeneratedTargetContains: ["DictEntry", "entry_section_title"],
	},
	sourceContent: [
		"Der Mann liest heute ein Buch. ^n2a",
		"Die Katze schläft dort. ^n3b",
		"Er fängt morgen früh an. ^v1a",
		"Das machen wir auf jeden Fall zusammen. ^p1a",
		"Der Plan wirkt klar. ^a1a",
		"Der Ablauf bleibt deutlich. ^a1b",
	].join("\n"),
	sourcePath: "Outside/Textfresser-P0-Stabilization.md",
} as const;

/** Historical observations from edge-case-results.md, retained for comparison. */
export const LEGACY_EDGE_REPORT_BASELINE = {
	allLemmaCommandsCompleted: true,
	allSurfaceWikilinksObserved: true,
	date: "2026-02-16",
	entryNotResolvedCaseIds: [
		"H2-C",
		"SV-B",
		"SV-C",
		"SV-D",
		"SV-E",
		"SV-F",
		"PH1-A",
		"PH1-B",
		"ADJ1-B",
		"ADJ1-D",
	],
	note:
		"The legacy Markdown report mixed Obsidian CLI startup text into file reads; its entry observations are evidence, not the new provider oracle.",
} as const;

export function selectProviderCases(options: {
	readonly caseId?: string;
	readonly suite: ProviderSuite | "all";
}): readonly ProviderAcceptanceCase[] {
	const inSuite = PROVIDER_ACCEPTANCE_CASES.filter(
		(testCase) => options.suite === "all" || testCase.suite === options.suite,
	);
	if (!options.caseId) return inSuite;

	const requested = inSuite.find((testCase) => testCase.id === options.caseId);
	if (!requested) {
		throw new Error(
			`Unknown provider acceptance case '${options.caseId}' in suite '${options.suite}'`,
		);
	}

	const requiredIds = new Set<string>();
	const includeDependencies = (testCase: ProviderAcceptanceCase): void => {
		for (const dependencyId of testCase.dependsOn ?? []) {
			if (requiredIds.has(dependencyId)) continue;
			const dependency = PROVIDER_ACCEPTANCE_CASES.find(
				(candidate) => candidate.id === dependencyId,
			);
			if (!dependency) {
				throw new Error(
					`Provider case '${testCase.id}' has unknown dependency '${dependencyId}'`,
				);
			}
			requiredIds.add(dependencyId);
			includeDependencies(dependency);
		}
	};
	includeDependencies(requested);
	requiredIds.add(requested.id);

	return PROVIDER_ACCEPTANCE_CASES.filter((testCase) =>
		requiredIds.has(testCase.id),
	);
}

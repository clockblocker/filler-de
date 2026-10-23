import { describe, expect, it } from "bun:test";
import {
	generateCodexContent,
	Healer,
	type LibraryBulk,
	makeBulkInterpreter,
	makeCodecRulesFromSettings,
	makeCodecs,
	makeNodeSegmentId,
	type NodeName,
	parseCodexClickLineContent,
	type SectionNodeSegmentId,
	Tree,
	TreeNodeKind,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import {
	buildCanonicalDelimiter,
	buildFlexibleDelimiterPattern,
} from "../../../src/utils/delimiter";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

const tilde = { padded: false, symbol: "~" };

/** The Librarian's snapshot: "~" as the suffix delimiter. */
const snapshotSettings = {
	...defaultSettingsForUnitTests,
	suffixDelimiter: buildCanonicalDelimiter(tilde),
	suffixDelimiterConfig: tilde,
	suffixDelimiterPattern: buildFlexibleDelimiterPattern(tilde),
};

function sectionId(name: string): SectionNodeSegmentId {
	return makeNodeSegmentId({
		children: {},
		kind: TreeNodeKind.Section,
		nodeName: name as NodeName,
	});
}

describe("library-core under explicit settings", () => {
	it("heals with the snapshot's delimiter, never the global one", () => {
		expect(defaultSettingsForUnitTests.suffixDelimiter).toBe("-");
		const codecs = makeCodecs(makeCodecRulesFromSettings(snapshotSettings));
		const interpret = makeBulkInterpreter(codecs);
		const healer = new Healer(
			new Tree("Library" as NodeName, codecs),
			codecs,
		);
		// "-" is an ordinary character under "~": "Berry-Pie" is one name.
		const bulk: LibraryBulk = {
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: {
						basename: "Ingredients",
						extension: MD,
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Recipe", "Berry-Pie"],
					},
				},
				{
					kind: VaultEventKind.FileCreated,
					splitPath: {
						basename: "Result-picture~Ramen-Soup~Recipe",
						extension: "jpg",
						kind: SplitPathKind.File,
						pathParts: ["Library"],
					},
				},
			],
			roots: [],
		};

		const healingActions = interpret(bulk).treeActions.flatMap(
			(action) => healer.getHealingActionsFor(action).healingActions,
		);

		expect(
			healingActions.find((action) => action.kind === "RenameMdFile")
				?.payload.to,
		).toEqual({
			basename: "Ingredients~Berry-Pie~Recipe",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Recipe", "Berry-Pie"],
		});
		expect(
			healingActions.find((action) => action.kind === "RenameFile")
				?.payload.to,
		).toEqual({
			basename: "Result-picture~Ramen-Soup~Recipe",
			extension: "jpg",
			kind: SplitPathKind.File,
			pathParts: ["Library", "Recipe", "Ramen-Soup"],
		});

		// The Codex links name the same basenames, and a click on one
		// resolves back to its Section under the same delimiter.
		const recipeChain = ["Library", "Recipe"].map(sectionId);
		const recipe = healer.findSection(recipeChain);
		expect(recipe).toBeDefined();
		if (!recipe) return;
		const codex = generateCodexContent(recipe, recipeChain, codecs);
		expect(codex).toContain("[[__~Berry-Pie~Recipe|Berry-Pie]]");
		expect(codex).toContain("[[Ingredients~Berry-Pie~Recipe|Ingredients]]");
		expect(codex).toContain("[[__~Ramen-Soup~Recipe|Ramen-Soup]]");

		const click = parseCodexClickLineContent(
			"[[__~Berry-Pie~Recipe|Berry-Pie]]",
			codecs,
		);
		expect(click.isOk() ? click.value : click.error).toEqual({
			kind: "Section",
			sectionChain: ["Library", "Recipe", "Berry-Pie"].map(sectionId),
		});
	});
});

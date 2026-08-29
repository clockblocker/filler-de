import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type spyOn,
} from "bun:test";
import {
	Healer,
	type LibraryBulk,
	makeBulkInterpreter,
	makeCodecRulesFromSettings,
	makeCodecs,
	type NodeName,
	Tree,
} from "@textfresser/library-core";
import {
	MD,
	SplitPathKind,
	VaultEventKind,
} from "@textfresser/vault-action-manager";
import { defaultSettingsForUnitTests } from "../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../unit/common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Library create Healing policies", () => {
	it("heals a nested unsuffixed Scroll and a root-suffixed File to canonical paths", () => {
		const codecs = makeCodecs(
			makeCodecRulesFromSettings(defaultSettingsForUnitTests),
		);
		const interpret = makeBulkInterpreter(codecs);
		const healer = new Healer(
			new Tree("Library" as NodeName, codecs),
			codecs,
		);
		const bulk: LibraryBulk = {
			events: [
				{
					kind: VaultEventKind.FileCreated,
					splitPath: {
						basename: "Ingredients",
						extension: MD,
						kind: SplitPathKind.MdFile,
						pathParts: ["Library", "Recipe", "Berry_Pie"],
					},
				},
				{
					kind: VaultEventKind.FileCreated,
					splitPath: {
						basename: "Result_picture-Ramen-Soup-Recipe",
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
		const scrollRename = healingActions.find(
			(action) => action.kind === "RenameMdFile",
		);
		expect(scrollRename?.payload.to).toEqual({
			basename: "Ingredients-Berry_Pie-Recipe",
			extension: MD,
			kind: SplitPathKind.MdFile,
			pathParts: ["Library", "Recipe", "Berry_Pie"],
		});
		const fileRename = healingActions.find(
			(action) => action.kind === "RenameFile",
		);
		expect(fileRename?.payload.to).toEqual({
			basename: "Result_picture-Ramen-Soup-Recipe",
			extension: "jpg",
			kind: SplitPathKind.File,
			pathParts: ["Library", "Recipe", "Soup", "Ramen"],
		});
	});
});

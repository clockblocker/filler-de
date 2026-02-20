import { describe, expect, it } from "bun:test";
import { ok } from "neverthrow";
import {
	buildClosedSetSurfaceHubActions,
	buildClosedSetSurfaceHubBackfillActions,
	buildClosedSetSurfaceHubContent,
	buildClosedSetSurfaceHubSplitPath,
} from "../../../../src/commanders/textfresser/common/closed-set-surface-hub";
import {
	SplitPathKind,
	type SplitPathToMdFile,
	type SplitPathToMdFileWithReader,
} from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../src/managers/obsidian/vault-action-manager/types/vault-action";

function makePath(
	basename: string,
	pathParts: string[],
): SplitPathToMdFile {
	return {
		basename,
		extension: "md",
		kind: "MdFile",
		pathParts,
	};
}

function makePathWithReader(
	basename: string,
	pathParts: string[],
	content: string,
): SplitPathToMdFileWithReader {
	return {
		basename,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts,
		read: () => Promise.resolve(ok(content)),
	};
}

describe("closed-set surface hubs", () => {
	it("creates hub content when a second closed-set target appears", () => {
		const pronoun = makePath("die-pronoun-de", ["Library", "de", "pronoun"]);
		const article = makePath("die-article-de", ["Library", "de", "article"]);

		const actions = buildClosedSetSurfaceHubActions({
			currentClosedSetTarget: article,
			lookupInLibrary: () => [pronoun],
			surface: "Die",
			targetLanguage: "German",
			vam: {
				exists: () => false,
			},
		});

		expect(actions).toHaveLength(1);
		const action = actions[0];
		expect(action?.kind).toBe(VaultActionKind.UpsertMdFile);
		if (!action || action.kind !== VaultActionKind.UpsertMdFile) {
			throw new Error("Expected UpsertMdFile action");
		}
		expect(action.payload.splitPath).toEqual(
			buildClosedSetSurfaceHubSplitPath("die", "German"),
		);
		expect(action.payload.content).toContain("closed-set-surface-hub");
		expect(action.payload.content).toContain("die-pronoun-de");
		expect(action.payload.content).toContain("die-article-de");
	});

	it("does not create a hub for a single target when hub does not exist", () => {
		const pronoun = makePath("die-pronoun-de", ["Library", "de", "pronoun"]);

		const actions = buildClosedSetSurfaceHubActions({
			lookupInLibrary: () => [pronoun],
			surface: "die",
			targetLanguage: "German",
			vam: {
				exists: () => false,
			},
		});

		expect(actions).toHaveLength(0);
	});

	it("updates existing hub even if only one target remains", () => {
		const pronoun = makePath("die-pronoun-de", ["Library", "de", "pronoun"]);
		const hubPath = buildClosedSetSurfaceHubSplitPath("die", "German");

		const actions = buildClosedSetSurfaceHubActions({
			lookupInLibrary: () => [pronoun],
			surface: "die",
			targetLanguage: "German",
			vam: {
				exists: (path) =>
					path.pathParts.join("/") === hubPath.pathParts.join("/") &&
					path.basename === hubPath.basename,
			},
		});

		expect(actions).toHaveLength(1);
		expect(actions[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
	});

	it("trashes hub when no closed-set targets remain", () => {
		const hubPath = buildClosedSetSurfaceHubSplitPath("die", "German");

		const actions = buildClosedSetSurfaceHubActions({
			lookupInLibrary: () => [],
			surface: "die",
			targetLanguage: "German",
			vam: {
				exists: (path) =>
					path.pathParts.join("/") === hubPath.pathParts.join("/") &&
					path.basename === hubPath.basename,
			},
		});

		expect(actions).toHaveLength(1);
		const action = actions[0];
		expect(action?.kind).toBe(VaultActionKind.TrashMdFile);
	});

	it("backfill is idempotent when existing hub content is already up to date", async () => {
		const pronoun = makePath("die-pronoun-de", ["Library", "de", "pronoun"]);
		const article = makePath("die-article-de", ["Library", "de", "article"]);
		const hubPath = buildClosedSetSurfaceHubSplitPath("die", "German");
		const existingHubContent = buildClosedSetSurfaceHubContent({
			surface: "die",
			targetLanguage: "German",
			targets: [pronoun, article],
		});

		const result = await buildClosedSetSurfaceHubBackfillActions({
			lookupInLibrary: () => [pronoun, article],
			targetLanguage: "German",
			vam: {
				exists: (path) =>
					path.pathParts[0] === "Library" ||
					(path.pathParts[0] === "Worter" &&
						path.basename === "closed-set-hub"),
				list: () => ok([hubPath]),
				listAllFilesWithMdReaders: (folder) => {
					if (folder.pathParts[0] === "Library") {
						return ok([
							makePathWithReader(
								pronoun.basename,
								pronoun.pathParts,
								"",
							),
							makePathWithReader(
								article.basename,
								article.pathParts,
								"",
							),
						]);
					}
					return ok([
						makePathWithReader(
							hubPath.basename,
							hubPath.pathParts,
							existingHubContent,
						),
					]);
				},
			},
		});

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			throw new Error(result.error);
		}
		expect(result.value).toHaveLength(0);
	});

	it("backfill upserts when existing hub content is stale", async () => {
		const pronoun = makePath("die-pronoun-de", ["Library", "de", "pronoun"]);
		const article = makePath("die-article-de", ["Library", "de", "article"]);
		const hubPath = buildClosedSetSurfaceHubSplitPath("die", "German");

		const result = await buildClosedSetSurfaceHubBackfillActions({
			lookupInLibrary: () => [pronoun, article],
			targetLanguage: "German",
			vam: {
				exists: (path) =>
					path.pathParts[0] === "Library" ||
					(path.pathParts[0] === "Worter" &&
						path.basename === "closed-set-hub"),
				list: () => ok([hubPath]),
				listAllFilesWithMdReaders: (folder) => {
					if (folder.pathParts[0] === "Library") {
						return ok([
							makePathWithReader(
								pronoun.basename,
								pronoun.pathParts,
								"",
							),
							makePathWithReader(
								article.basename,
								article.pathParts,
								"",
							),
						]);
					}
					return ok([
						makePathWithReader(
							hubPath.basename,
							hubPath.pathParts,
							"old-content",
						),
					]);
				},
			},
		});

		expect(result.isOk()).toBe(true);
		if (result.isErr()) {
			throw new Error(result.error);
		}
		expect(result.value).toHaveLength(1);
		expect(result.value[0]?.kind).toBe(VaultActionKind.UpsertMdFile);
	});
});

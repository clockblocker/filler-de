import type { PrettyFileWithContent } from "../../services/obsidian-services/file-services/background/background-file-service";

const libraryCodex = {
	prettyPath: {
		basename: "__Library",
		pathParts: ["Tests", "Library"],
	},
} as const satisfies PrettyFileWithContent;

const avatarCodex = {
	prettyPath: {
		basename: "__Avatar",
		pathParts: ["Tests", "Library", "Avatar"],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Codex = {
	prettyPath: {
		basename: "__Avatar-Season_1",
		pathParts: ["Tests", "Library", "Avatar", "Season_1"],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Episode1Codex = {
	prettyPath: {
		basename: "__Avatar-Season_1-Episode_1",
		pathParts: ["Tests", "Library", "Avatar", "Season_1", "Episode_1"],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Episode1Page000 = {
	prettyPath: {
		basename: "000-Avatar-Season_1-Episode_1",
		pathParts: [
			"Tests",
			"Library",
			"Avatar",
			"Season_1",
			"Episode_1",
			"Pages",
		],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Episode1Page001 = {
	prettyPath: {
		basename: "001-Avatar-Season_1-Episode_1",
		pathParts: [
			"Tests",
			"Library",
			"Avatar",
			"Season_1",
			"Episode_1",
			"Pages",
		],
	},
};

const avatarSeason1Episode2Codex = {
	prettyPath: {
		basename: "__Avatar-Season_1-Episode_2",
		pathParts: ["Tests", "Library", "Avatar", "Season_1", "Episode_2"],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Episode2Page000 = {
	prettyPath: {
		basename: "000-Avatar-Season_1-Episode_2",
		pathParts: [
			"Tests",
			"Library",
			"Avatar",
			"Season_1",
			"Episode_2",
			"Pages",
		],
	},
} as const satisfies PrettyFileWithContent;

const avatarSeason1Episode2Page001 = {
	prettyPath: {
		basename: "001-Avatar-Season_1-Episode_2",
		pathParts: [
			"Tests",
			"Library",
			"Avatar",
			"Season_1",
			"Episode_1",
			"Pages",
		],
	},
};

export const testFile = {
	avatarCodex,
	avatarSeason1Codex,
	avatarSeason1Episode1Codex,
	avatarSeason1Episode1Page000,
	avatarSeason1Episode1Page001,
	avatarSeason1Episode2Codex,
	avatarSeason1Episode2Page000,
	avatarSeason1Episode2Page001,
	libraryCodex,
} as const;

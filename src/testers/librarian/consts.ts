import type { PrettyFileDto } from "../../services/obsidian-services/file-services/background/background-file-service";

const libraryCodex = {
	basename: "__Library",
	pathParts: ["Library"],
} as const satisfies PrettyFileDto;

const avatarCodex = {
	basename: "__Avatar",
	pathParts: ["Library", "Avatar"],
} as const satisfies PrettyFileDto;

const avatarSeason1Codex = {
	basename: "__Avatar-Season_1",
	pathParts: ["Library", "Avatar", "Season_1"],
} as const satisfies PrettyFileDto;

// E2
const avatarSeason1Episode1Codex = {
	basename: "__Avatar-Season_1-Episode_1",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode1Page000 = {
	basename: "000-Avatar-Season_1-Episode_1",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Pages"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode1Page001 = {
	basename: "001-Avatar-Season_1-Episode_1",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Pages"],
};

// E2
const avatarSeason1Episode2Codex = {
	basename: "__Avatar-Season_1-Episode_2",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_2"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode2Page000 = {
	basename: "000-Avatar-Season_1-Episode_2",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_2", "Pages"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode2Page001 = {
	basename: "001-Avatar-Season_1-Episode_2",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Pages"],
};

export const testLibrary = {
	avatar: {
		codex: avatarCodex,
		s1: {
			codex: avatarSeason1Codex,
			e1: {
				codex: avatarSeason1Episode1Codex,
				page000: avatarSeason1Episode1Page000,
				page001: avatarSeason1Episode1Page001,
			},
			e2: {
				codex: avatarSeason1Episode2Codex,
				page000: avatarSeason1Episode2Page000,
				page001: avatarSeason1Episode2Page001,
			},
		},
	},
	codex: libraryCodex,
} as const;

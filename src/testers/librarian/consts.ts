import type { PrettyFileDto } from "../../types/common-interface/dtos";

const libraryCodex = {
	basename: "__Library",
	pathParts: ["Library"],
} as const satisfies PrettyFileDto;

const avatarCodex = {
	basename: "__Avatar",
	pathParts: ["Library", "Avatar"],
} as const satisfies PrettyFileDto;

const avatarSeason1Codex = {
	basename: "__Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1"],
} as const satisfies PrettyFileDto;

// E2
const avatarSeason1Episode1Codex = {
	basename: "__Episode_1-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode1Page000 = {
	basename: "000-Page-Episode_1-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Page"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode1Page001 = {
	basename: "001-Page-Episode_1-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Page"],
};

// E2
const avatarSeason1Episode2Codex = {
	basename: "__Episode_2-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_2"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode2Page000 = {
	basename: "000-Page-Episode_2-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_2", "Page"],
} as const satisfies PrettyFileDto;

const avatarSeason1Episode2Page001 = {
	basename: "001-Page-Episode_2-Season_1-Avatar",
	pathParts: ["Library", "Avatar", "Season_1", "Episode_1", "Page"],
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

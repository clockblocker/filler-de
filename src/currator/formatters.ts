// ---

import type { NodeName } from "./types";

type SectionName = NodeName;

type PrevSectionNames = SectionName[];
type CurrentSectionName = SectionName;

type CodexNameParts = [CurrentSectionName, ...PrevSectionNames[]];

type CodexLine = {
	done: boolean;
	nameParts: CodexNameParts;
};

type Codex = {
	lines: CodexLine[];
};

// {[sectionNames.join('-'), vettedName].join('-')}
type EntrieFullName = string;

// {NNN-EntrieFullName}
type PageFullName = string;

// type SerializedCodex = {
// 	name:
// 	prevCodexName: EntrieFullName;
// };

type SerialisedEntrie = {
	name: EntrieFullName;
	pages: { pageName: PageFullName; content: string }[];
};

import { makeTryParseStringAs } from "../../../../librarin-shared/error-handeling/tryParseStringAs";

import {
	JoinedSuffixedBasenameForCodexSchema,
	JoinedSuffixedBasenameForFileSchema,
	JoinedSuffixedBasenameForFolderSchema,
} from "../../types/suffixed/joined-suffixed";

export const tryParseJoinedSuffixedBasenameForFile = makeTryParseStringAs(
	JoinedSuffixedBasenameForFileSchema,
);

export const tryParseJoinedSuffixedBasenameForFolder = makeTryParseStringAs(
	JoinedSuffixedBasenameForFolderSchema,
);

export const tryParseJoinedSuffixedBasenameForCodex = makeTryParseStringAs(
	JoinedSuffixedBasenameForCodexSchema,
);

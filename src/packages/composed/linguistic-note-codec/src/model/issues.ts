export type CodecIssueCode =
	| "ConflictingBlockPayload"
	| "DuplicateBlock"
	| "InvalidBlockPayload"
	| "InvalidMarkdown"
	| "InvalidRootDto"
	| "MissingRequiredBlock"
	| "OrderingNormalized"
	| "SemanticBlockMerged"
	| "UnclaimedStructuredBlock"
	| "UnknownTypedBlock"
	| "UnsupportedTopLevelContent";

export type CodecIssue = {
	block?: string;
	blockId?: string;
	code: CodecIssueCode;
	detail?: unknown;
	entryIndex?: number;
	message: string;
};

export class LinguisticNoteCodecError extends Error {
	issues: CodecIssue[];

	constructor(message: string, issues: CodecIssue[] = []) {
		super(message);
		this.name = "LinguisticNoteCodecError";
		this.issues = issues;
	}
}

/// <reference types="@wdio/globals/types" />

export const VAULT_PATH = "tests/simple";

// Types use `unknown` because:
// 1. Actual types (SplitPath, Result<T, string>, etc.) come from plugin code
// 2. Plugin types aren't accessible in test context due to serialization
// 3. We assert types at call sites: `as unknown as Result<T>`
// 4. Safer than `any` - forces explicit type assertions
//
// Actual types (for reference):
// - pwd(): Promise<Result<SplitPathToMdFile, string>>
// - getOpenedTFile(): Promise<Result<TFile, string>>
// - getContent(): Promise<Result<string, string>>
// - replaceAllContentInOpenedFile(content: string): Promise<Result<string, string>>
// - isFileActive(splitPath: SplitPathToMdFile): Promise<Result<boolean, string>>
// - cd(file: TFile | SplitPathToFile | SplitPathToMdFile): Promise<Result<TFile, string>>
// - splitPath(input: string): SplitPath
// - makeSystemPathForSplitPath(splitPath: SplitPath | CommonSplitPath): string
export type OpenedFileServiceTestingApi = {
	openedFileService: {
		pwd: () => Promise<unknown>;
		getOpenedTFile: () => Promise<unknown>;
		getContent: () => Promise<unknown>;
		replaceAllContentInOpenedFile: (content: string) => Promise<unknown>;
		isFileActive: (splitPath: unknown) => Promise<unknown>;
		cd: (file: unknown) => Promise<unknown>;
	};
	openedFileServiceWithResult: {
		pwd: () => Promise<unknown>;
		getOpenedTFile: () => Promise<unknown>;
		getContent: () => Promise<unknown>;
		replaceAllContentInOpenedFile: (content: string) => Promise<unknown>;
		processContent: (args: {
			splitPath: unknown;
			transform: (content: string) => string | Promise<string>;
		}) => Promise<unknown>;
		isFileActive: (splitPath: unknown) => Promise<unknown>;
		cd: (file: unknown) => Promise<unknown>;
	};
	splitPath: (input: string) => unknown;
	makeSystemPathForSplitPath: (splitPath: unknown) => string;
};

export type Result<T> = {
	isErr: () => boolean;
	isOk: () => boolean;
	error?: string;
	value?: T;
};

export type SplitPathToMdFile = {
	basename: string;
	pathParts: string[];
	type: "MdFile";
	extension: "md";
};

// GOLDEN SOURCE PRINCIPLE: Obsidian's actual behavior is always the authoritative source.
// If code/docs/tests conflict with Obsidian's behavior, fix code/docs/tests to match Obsidian.
// Never assume - always verify Obsidian's actual behavior through tests.

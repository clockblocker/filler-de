import {
	createLexicalGenerationModule,
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	type LexicalGenerationModule,
	type LexicalGenerationSettings,
	lexicalGenerationError,
	type StructuredFetchFn,
} from "../../../lexical-generation";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { ApiService } from "../../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../../types";
import type { LemmaResult } from "../commands/lemma/types";
import type { Attestation } from "../common/attestation/types";
import type { PathLookupFn } from "../common/target-path-resolver";
import type { LibraryBasenameParser } from "../domain/linguistic-wikilink";
import { PromptRunner } from "../llm/prompt-runner";

export type InFlightGenerate = {
	lemma: string;
	targetOwnedByInvocation: boolean;
	targetPath: SplitPathToMdFile;
	promise: Promise<void>;
};

export type PendingGenerate = {
	lemma: string;
	lemmaResult: LemmaResult;
	targetOwnedByInvocation: boolean;
	targetPath: SplitPathToMdFile;
	notify: (message: string) => void;
};

export type LemmaInvocationCache = {
	key: string;
	cachedAtMs: number;
	lemmaResult: LemmaResult;
	resolvedTargetPath: SplitPathToMdFile;
	generatedEntryId?: string;
};

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
	latestLemmaResult: LemmaResult | null;
	latestResolvedLemmaTargetPath?: SplitPathToMdFile;
	latestLemmaTargetOwnedByInvocation: boolean;
	latestLemmaPlaceholderPath?: SplitPathToMdFile;
	latestLemmaInvocationCache: LemmaInvocationCache | null;
	latestFailedSections: string[];
	lexicalGeneration?: LexicalGenerationModule | null;
	lexicalGenerationInitError?: LexicalGenerationError;
	targetBlockId?: string;
	inFlightGenerate: InFlightGenerate | null;
	pendingGenerate: PendingGenerate | null;
	languages: LanguagesConfig;
	isLibraryLookupAvailable: boolean;
	lookupInLibrary: PathLookupFn;
	parseLibraryBasename: LibraryBasenameParser;
	promptRunner: PromptRunner;
	vam: VaultActionManager;
};

export function createInitialTextfresserState(params: {
	apiService: ApiService;
	languages: LanguagesConfig;
	lexicalGenerationSettings: LexicalGenerationSettings;
	vam: VaultActionManager;
}): TextfresserState {
	const { apiService, languages, lexicalGenerationSettings, vam } = params;
	const fetchStructured: StructuredFetchFn = async ({
		requestLabel,
		schema,
		systemPrompt,
		userInput,
		withCache = true,
	}) => {
		const result = await apiService.generate({
			requestLabel,
			// biome-ignore lint/suspicious/noExplicitAny: cross-zod transport boundary
			schema: schema as any,
			systemPrompt,
			userInput,
			withCache,
		});

		return result.mapErr((error) =>
			lexicalGenerationError(
				LexicalGenerationFailureKind.FetchFailed,
				error.reason,
				{ requestLabel },
			),
		);
	};
	const lexicalGenerationResult = createLexicalGenerationModule({
		fetchStructured,
		knownLang: languages.known,
		settings: lexicalGenerationSettings,
		targetLang: languages.target,
	});

	return {
		attestationForLatestNavigated: null,
		inFlightGenerate: null,
		isLibraryLookupAvailable: false,
		languages,
		latestFailedSections: [],
		latestLemmaInvocationCache: null,
		latestLemmaResult: null,
		latestLemmaTargetOwnedByInvocation: false,
		lexicalGeneration: lexicalGenerationResult.isOk()
			? lexicalGenerationResult.value
			: null,
		lexicalGenerationInitError: lexicalGenerationResult.isErr()
			? lexicalGenerationResult.error
			: undefined,
		lookupInLibrary: () => [],
		parseLibraryBasename: () => null,
		pendingGenerate: null,
		promptRunner: new PromptRunner(languages, apiService),
		vam,
	};
}

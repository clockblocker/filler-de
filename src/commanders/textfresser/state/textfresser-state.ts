import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { ApiService } from "../../../stateless-helpers/api-service";
import type { LanguagesConfig } from "../../../types";
import type { LemmaResult } from "../commands/lemma/types";
import type { Attestation } from "../common/attestation/types";
import type { PathLookupFn } from "../common/target-path-resolver";
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
	targetBlockId?: string;
	inFlightGenerate: InFlightGenerate | null;
	pendingGenerate: PendingGenerate | null;
	languages: LanguagesConfig;
	isLibraryLookupAvailable: boolean;
	lookupInLibrary: PathLookupFn;
	promptRunner: PromptRunner;
	vam: VaultActionManager;
};

export function createInitialTextfresserState(params: {
	apiService: ApiService;
	languages: LanguagesConfig;
	vam: VaultActionManager;
}): TextfresserState {
	const { apiService, languages, vam } = params;

	return {
		attestationForLatestNavigated: null,
		inFlightGenerate: null,
		isLibraryLookupAvailable: false,
		languages,
		latestFailedSections: [],
		latestLemmaInvocationCache: null,
		latestLemmaResult: null,
		latestLemmaTargetOwnedByInvocation: false,
		lookupInLibrary: () => [],
		pendingGenerate: null,
		promptRunner: new PromptRunner(languages, apiService),
		vam,
	};
}

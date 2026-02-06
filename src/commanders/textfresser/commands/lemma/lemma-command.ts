import { errAsync, ok, type ResultAsync } from "neverthrow";
import {
	type VaultAction,
	VaultActionKind,
} from "../../../../managers/obsidian/vault-action-manager";
import { PromptKind } from "../../../../prompt-smith/codegen/consts";
import { buildAttestationFromSelection } from "../../common/attestation/builders/build-from-selection";
import type { Attestation } from "../../common/attestation/types";
import {
	type CommandError,
	CommandErrorKind,
	type CommandInput,
} from "../types";
import { disambiguateSense } from "./steps/disambiguate-sense";

/**
 * Resolve attestation: prefer wikilink click context, fall back to text selection.
 */
function resolveAttestation(input: CommandInput): Attestation | null {
	const { textfresserState, commandContext } = input;

	if (textfresserState.attestationForLatestNavigated) {
		return textfresserState.attestationForLatestNavigated;
	}

	const selection = commandContext.selection;
	if (selection?.text) {
		return buildAttestationFromSelection(
			selection as typeof selection & { text: string },
		);
	}

	return null;
}

/**
 * Build a wikilink from surface and lemma.
 * If lemma differs from surface: [[lemma|surface]], else [[surface]].
 */
function buildWikilink(surface: string, lemma: string): string {
	return lemma !== surface ? `[[${lemma}|${surface}]]` : `[[${surface}]]`;
}

/**
 * Lemma command: classify a word, store result in state, and wrap the
 * surface text in a wikilink inside the source block.
 */
export function lemmaCommand(
	input: CommandInput,
): ResultAsync<VaultAction[], CommandError> {
	const { textfresserState } = input;
	const attestation = resolveAttestation(input);

	if (!attestation) {
		return errAsync({
			kind: CommandErrorKind.NotEligible,
			reason: "No attestation context available — select a word or click a wikilink first",
		});
	}

	const surface = attestation.target.surface;
	const context = attestation.source.textWithOnlyTargetMarked;

	return textfresserState.promptRunner
		.generate(PromptKind.Lemma, {
			context,
			surface,
		})
		.mapErr(
			(e): CommandError => ({
				kind: CommandErrorKind.ApiError,
				reason: e.reason,
			}),
		)
		.andThen((apiResult) =>
			disambiguateSense(
				textfresserState.vam,
				textfresserState.promptRunner,
				apiResult,
				context,
			).map((disambiguationResult) => ({
				...apiResult,
				disambiguationResult,
			})),
		)
		.andThen((result) => {
			textfresserState.latestLemmaResult = {
				attestation,
				disambiguationResult: result.disambiguationResult,
				lemma: result.lemma,
				linguisticUnit: result.linguisticUnit,
				pos: result.pos ?? undefined,
				surfaceKind: result.surfaceKind,
			};

			const wikilink = buildWikilink(surface, result.lemma);
			const rawBlock = attestation.source.textRaw;

			const offset = attestation.target.offsetInBlock;
			const updatedBlock =
				offset !== undefined
					? rawBlock.slice(0, offset) +
						wikilink +
						rawBlock.slice(offset + surface.length)
					: rawBlock.replace(surface, wikilink);

			const actions: VaultAction[] = [
				{
					kind: VaultActionKind.ProcessMdFile,
					payload: {
						after: updatedBlock,
						before: rawBlock,
						splitPath: attestation.source.path,
					},
				},
			];

			return ok(actions);
		});
}

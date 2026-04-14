import { err, ok, type Result } from "neverthrow";
import {
	type LexicalGenerationError,
	LexicalGenerationFailureKind,
	lexicalGenerationError,
} from "./errors";
import type {
	LexicalIdentity,
	LexicalMeta,
	ResolvedSelection,
} from "./public-types";
import {
	getLemmaKind,
	getSelectionDiscriminator,
	getSurfaceKind,
	isKnownSelection,
} from "./selection-helpers";

export function createLexicalIdentityFromSelection(
	selection: ResolvedSelection,
	options?: { normalizeToLemma?: boolean },
): LexicalIdentity | null {
	if (!isKnownSelection(selection)) {
		return null;
	}

	const normalizeToLemma = options?.normalizeToLemma ?? true;
	const lemmaKind = getLemmaKind(selection);
	const discriminator = getSelectionDiscriminator(selection);
	const surfaceKind = normalizeToLemma ? "Lemma" : getSurfaceKind(selection);
	if (!lemmaKind || !discriminator || !surfaceKind) {
		return null;
	}

	return {
		discriminator,
		lemmaKind,
		surfaceKind,
	};
}

export function createLexicalMeta(params: {
	senseEmojis: string[];
	selection: ResolvedSelection;
	options?: { normalizeToLemma?: boolean };
}): Result<LexicalMeta, LexicalGenerationError> {
	const identity = createLexicalIdentityFromSelection(
		params.selection,
		params.options,
	);
	if (!identity) {
		return err(
			lexicalGenerationError(
				LexicalGenerationFailureKind.InvalidSelection,
				"Cannot create LexicalMeta from an unknown selection",
			),
		);
	}

	return ok({
		senseEmojis: params.senseEmojis,
		identity,
	});
}

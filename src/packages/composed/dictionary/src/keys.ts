import type {
	PendingSemanticRelationLocator,
	PendingSemanticRelationRecord,
} from "dumdict";
import {
	canonicalFormKey,
	lemmaIdentityKey,
	readingIdentityKey,
} from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";

/**
 * The index's keys. Lemma and Reading keys are dumling's identity keys, so
 * two spellings dumling calls one Lemma share one key.
 */
export const lemmaKeyOf = (lemma: Dumling.Lemma): string =>
	lemmaIdentityKey(lemma);

export const readingKeyOf = (reading: Dumling.Reading): string =>
	readingIdentityKey(reading);

/** A pending relation's locator as one string, as dumdict compares them. */
export const locatorKeyOf = (
	locator: PendingSemanticRelationLocator<Dumling.Language>,
): string =>
	JSON.stringify([
		locator.sourceReadingKey,
		locator.relation,
		locator.targetPendingId,
	]);

/**
 * A Unit Shadow's key: language, Family, Kind and the case-folded Canonical
 * Form, the fields dumdict matches a Shadow to a Lemma by.
 */
export const shadowKeyOf = (shadow: {
	readonly language: Dumling.Language;
	readonly family: string;
	readonly kind: string;
	readonly canonicalForm: string;
}): string =>
	JSON.stringify([
		shadow.language,
		shadow.family,
		shadow.kind,
		canonicalFormKey(shadow.canonicalForm, shadow.language),
	]);

export const pendingShadowKeyOf = (
	record: PendingSemanticRelationRecord<Dumling.Language>,
): string => shadowKeyOf(record.pending.target as Dumrel.UnitShadow);

/** The key a text is looked up by among Lemma forms and Surfaces. */
export const formKeyOf = (text: string, language: Dumling.Language): string =>
	canonicalFormKey(text, language);

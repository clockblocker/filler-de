import { shadowNotePath } from "@textfresser/lemma-note-codec";
import { canonicalJson } from "common-utils";
import type { PendingSemanticRelationRecord } from "dumdict";

type ShadowTarget = PendingSemanticRelationRecord<"de">["pending"]["target"];

const MARKER = /^%%tf:shadow (\{[^\n]*\})%%\n/;

/**
 * The content the store writes into a Shadow note (ADR 0012): a marker
 * naming the Shadow, then one line for the reader. The store treats a
 * Shadow note as its own, and so may remove it, only while the file holds
 * exactly this content for the Shadow its path spells; any other content
 * is the user's and stays.
 */
export function shadowBody(target: ShadowTarget): string {
	const { canonicalForm, family, kind, language } = target;
	const marker = canonicalJson({ canonicalForm, family, kind, language });
	return `%%tf:shadow ${marker.replaceAll("%", "\\u0025")}%%\n${canonicalForm}\n\nA Shadow note: a Semantic Relation names this ${family} ${kind}, which has no Lemma note yet.\n`;
}

/** The path of the Shadow note a target gets, or undefined if none can be spelled. */
export function shadowPathOfTarget(target: ShadowTarget): string | undefined {
	try {
		return shadowNotePath(target).path;
	} catch {
		return undefined;
	}
}

/** Whether a file at `path` holds exactly the store's own Shadow body for that path. */
export function isStoreShadow(path: string, content: string): boolean {
	const marker = MARKER.exec(content);
	if (!marker?.[1]) return false;
	let target: ShadowTarget;
	try {
		target = JSON.parse(marker[1]) as ShadowTarget;
	} catch {
		return false;
	}
	try {
		return (
			shadowPathOfTarget(target) === path &&
			shadowBody(target) === content
		);
	} catch {
		return false;
	}
}

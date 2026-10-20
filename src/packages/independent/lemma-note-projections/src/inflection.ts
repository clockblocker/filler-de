import type * as Dumling from "dumling/types";
import { coreOf, type ProjectionInput } from "./context";
import type { Gender } from "./de/articles";
import { closedParadigm } from "./de/closed-paradigms";
import { compareGerman } from "./de/comparison";
import { declineGermanNoun, nounTable } from "./de/noun-declension";
import { conjugateGermanVerb } from "./de/verb-conjugation";
import { type InflectionTable, renderTable } from "./table";

const GENDERS: ReadonlySet<string> = new Set(["Fem", "Masc", "Neut"]);

function gendersOf(value: unknown): Gender[] {
	if (typeof value === "string")
		return GENDERS.has(value) ? [value as Gender] : [];
	const members = (value as { mixed?: unknown } | null)?.mixed;
	return Array.isArray(members)
		? members.filter((member): member is Gender => GENDERS.has(member))
		: [];
}

function storedComparatives(input: ProjectionInput): string[] {
	return input.ownedSurfaces
		.map(({ surface }) => surface)
		.filter((surface) => {
			const features = (surface as { inflectionalFeatures?: unknown })
				.inflectionalFeatures as Readonly<
				Record<string, unknown>
			> | null;
			return (
				features?.degree === "Cmp" &&
				(features.case === undefined || features.case === null)
			);
		})
		.map((surface) => surface.normalizedSurface);
}

function germanTable(input: ProjectionInput): InflectionTable | undefined {
	const lemma = input.lemma as Dumling.Lemma<"de">;
	const closed = closedParadigm(lemma);
	if (closed !== undefined) return closed;
	if (lemma.family !== "Lexeme") return undefined;
	const core = coreOf(lemma);
	const knowledge = input.entry.knowledge;
	switch (lemma.kind) {
		case "NOUN": {
			if (knowledge?.plural === undefined) return undefined;
			const declension = declineGermanNoun({
				canonicalForm: lemma.canonicalForm,
				genders: gendersOf(core.gender),
				plural: knowledge.plural,
			});
			return declension === undefined ? undefined : nounTable(declension);
		}
		case "VERB":
			return conjugateGermanVerb({
				canonicalForm: lemma.canonicalForm,
				conjugationClasses: knowledge?.conjugationClass,
				preterite: knowledge?.preterite,
				reflexive:
					core.lexicallyReflexive === "Acc" ||
					core.lexicallyReflexive === "Dat"
						? core.lexicallyReflexive
						: null,
				separablePrefix:
					typeof core.hasSepPrefix === "string"
						? core.hasSepPrefix
						: null,
			});
		case "ADJ":
		case "ADV":
			return core.comparable === "Yes"
				? compareGerman({
						canonicalForm: lemma.canonicalForm,
						storedComparatives: storedComparatives(input),
					})
				: undefined;
		default:
			return undefined;
	}
}

/**
 * A Reading's inflection table as Markdown, derived without a model from
 * its Lemma, its stored Knowledge and dumcorpus. Undefined, so the codec
 * leaves the Block out, for a language other than German or a Reading the
 * data cannot fill a table for.
 */
export function deriveInflection(input: ProjectionInput): string | undefined {
	if (input.lemma.language !== "de") return undefined;
	return renderTable(germanTable(input));
}

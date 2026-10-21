import type * as Dumling from "dumling/types";
import { coreOf, type ProjectionInput } from "./context";
import { CASES, type Case, type Gender } from "./de/articles";
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

function featuresOf(
	surface: Dumling.Surface,
): Readonly<Record<string, unknown>> | null | undefined {
	return (surface as { inflectionalFeatures?: unknown })
		.inflectionalFeatures as Readonly<Record<string, unknown>> | null;
}

function storedComparatives(input: ProjectionInput): string[] {
	return input.ownedSurfaces
		.map(({ surface }) => surface)
		.filter((surface) => {
			const features = featuresOf(surface);
			return (
				features?.degree === "Cmp" &&
				(features.case === undefined || features.case === null)
			);
		})
		.map((surface) => surface.normalizedSurface);
}

/**
 * The singular forms a noun's owned Surfaces attest in their canonical
 * spelling, by case: the data that establishes a cell derivation leaves in
 * doubt, such as a weak noun's `Menschen`.
 */
function attestedSingular(
	input: ProjectionInput,
): Partial<Record<Case, string[]>> {
	const byCase: Partial<Record<Case, string[]>> = {};
	for (const { surface } of input.ownedSurfaces) {
		const features = featuresOf(surface);
		const grammaticalCase = features?.case;
		if (
			surface.spelling.kind !== "Canonical" ||
			features?.number !== "Sing" ||
			typeof grammaticalCase !== "string" ||
			!(CASES as readonly string[]).includes(grammaticalCase)
		)
			continue;
		const forms = byCase[grammaticalCase as Case] ?? [];
		forms.push(surface.normalizedSurface);
		byCase[grammaticalCase as Case] = forms;
	}
	return byCase;
}

function germanTable(input: ProjectionInput): InflectionTable | undefined {
	const lemma = input.lemma as Dumling.Lemma<"de">;
	const closed = closedParadigm(lemma);
	if (closed !== undefined) return closed;
	if (lemma.family !== "Lexeme") return undefined;
	const core = coreOf(lemma);
	const knowledge = input.principalParts;
	switch (lemma.kind) {
		case "NOUN": {
			if (knowledge?.plural === undefined) return undefined;
			const declension = declineGermanNoun({
				attestedSingular: attestedSingular(input),
				canonicalForm: lemma.canonicalForm,
				genders: gendersOf(core.gender),
				plural: knowledge.plural,
			});
			return declension === undefined ? undefined : nounTable(declension);
		}
		case "VERB":
			if (knowledge === undefined) return undefined;
			return conjugateGermanVerb({
				canonicalForm: lemma.canonicalForm,
				conjugationClasses: knowledge.conjugationClass,
				pastParticiple: knowledge.pastParticiple,
				presentSingular: knowledge.presentSingular,
				preterite: knowledge.preterite,
				reflexive:
					core.lexicallyReflexive === "Acc" ||
					core.lexicallyReflexive === "Dat"
						? core.lexicallyReflexive
						: null,
				separablePrefix:
					typeof core.hasSepPrefix === "string"
						? core.hasSepPrefix
						: null,
				subjunctivePast: knowledge.subjunctivePast,
			});
		case "ADJ":
		case "ADV":
			return core.comparable === "Yes"
				? compareGerman({
						canonicalForm: lemma.canonicalForm,
						derive: lemma.kind === "ADJ",
						storedComparatives: storedComparatives(input),
					})
				: undefined;
		default:
			return undefined;
	}
}

/**
 * A Reading's inflection table as Markdown, derived without a model from
 * its Lemma, its principal parts and dumcorpus. Undefined, so the codec
 * leaves the Block out, for a language other than German or a Reading the
 * data cannot fill a table for. Its forms are plain text, since no note
 * holds an inflected form, except that a form spelled as the Lemma links
 * to the Lemma's note through `input.links`.
 */
export function deriveInflection(input: ProjectionInput): string | undefined {
	if (input.lemma.language !== "de") return undefined;
	const { canonicalForm } = input.lemma;
	const link = input.links?.lemma(input.lemma);
	return renderTable(germanTable(input), (word) =>
		link !== undefined && word === canonicalForm ? link : word,
	);
}

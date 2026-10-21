/**
 * TODO(#120): the Lemma note codec's `inflection` and `tags` hooks until
 * the German Inflection Pack (texteater#1229) renders tables through
 * `dumdict/inflection`. They wrap this package's German projections: one
 * table per Licence Group, from the Paradigm Variants the group licenses,
 * and tags from what a Reading's Licences give it.
 *
 * The types below are the structural subset of the codec's hook types, so
 * this package does not depend on the codec.
 */

import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { germanConjugationClass, licenceGroups, licensed } from "dumrel";
import type * as Dumrel from "dumrel/types";
import type { PrincipalParts } from "./context";
import { deriveInflection } from "./inflection";
import { deriveTags } from "./tags";

type Records<
	R extends Dumling.Reading = Dumling.Reading,
	I extends string = string,
> = {
	readonly lemmaRecord: {
		readonly lemma: Dumling.Lemma;
		readonly paradigm?: Dumrel.LemmaParadigm;
	};
	readonly readingEntries: readonly { readonly reading: R }[];
	readonly ownedSurfaceEntries: readonly {
		readonly id: I;
		readonly surface: Dumling.Surface;
	}[];
};

type Dimension = Dumrel.DimensionId;
type Selection = Readonly<
	Partial<Record<Dimension, readonly Dumrel.VariantId[]>>
>;

const PLURAL_MARKERS: ReadonlySet<string> = new Set(["NoPlural", "PluralOnly"]);

/** The principal parts one Licence Group's or one Reading's variants give. */
export function principalPartsOf(
	lemma: Dumling.Lemma,
	paradigm: Dumrel.LemmaParadigm | undefined,
	selection: Selection,
): PrincipalParts | undefined {
	const values = (dimension: Dimension): string[] | undefined => {
		const taken = new Set(selection[dimension] ?? []);
		const variants = paradigm?.dimensions[dimension]?.variants ?? [];
		const chosen = variants
			.filter((variant) => taken.has(variant.id))
			.map((variant) => variant.value);
		return chosen.length === 0 ? undefined : chosen;
	};
	const plural = values("plural");
	const preterite = values("preterite");
	const [first, second, third] = [
		values("present1"),
		values("present2"),
		values("present3"),
	];
	const marker = plural?.find((value) => PLURAL_MARKERS.has(value));
	const parts: PrincipalParts = {
		conjugationClass:
			preterite === undefined
				? undefined
				: [
						...new Set(
							preterite.map((form) =>
								germanConjugationClass(
									lemma.canonicalForm,
									form,
								),
							),
						),
					],
		pastParticiple: values("pastParticiple"),
		plural:
			marker === "NoPlural" || marker === "PluralOnly"
				? marker
				: plural?.filter((value) => !PLURAL_MARKERS.has(value)),
		presentSingular:
			first && second && third ? { first, second, third } : undefined,
		preterite,
		subjunctivePast: values("subjunctivePast"),
	};
	return Object.values(parts).some((part) => part !== undefined)
		? parts
		: undefined;
}

const SHORT_VALUES: Readonly<Record<string, string>> = {
	Plur: "Pl",
	Sing: "Sg",
};

/** A Surface's own inflectional features as a Surface Axes label: `Dat.Pl`. */
export function interimSurfaceAxes(surface: Dumling.Surface): string {
	const features = (surface as { inflectionalFeatures?: unknown })
		.inflectionalFeatures as Readonly<Record<string, unknown>> | null;
	return Object.values(features ?? {})
		.filter((value): value is string => typeof value === "string")
		.map((value) => SHORT_VALUES[value] ?? value)
		.join(".");
}

/** The codec's `inflection` hook: one German table per Licence Group. */
export function interimInflection<
	R extends Dumling.Reading,
	I extends string,
>(input: {
	readonly records: Records<R, I>;
}): {
	readonly tables: readonly {
		readonly selectionKey: string;
		readonly readings: readonly R[];
		readonly lines: readonly string[];
	}[];
	readonly surfaces: readonly {
		readonly surfaceId: I;
		readonly axes: string;
	}[];
} {
	const { lemmaRecord, ownedSurfaceEntries, readingEntries } = input.records;
	const { lemma, paradigm } = lemmaRecord;
	const byKey = new Map(
		readingEntries.map(({ reading }) => [
			readingIdentityKey(reading),
			reading,
		]),
	);
	const groups = licenceGroups(paradigm ?? { dimensions: {} }, [
		...byKey.keys(),
	]);
	return {
		surfaces: ownedSurfaceEntries.map(({ id, surface }) => ({
			axes: interimSurfaceAxes(surface),
			surfaceId: id,
		})),
		tables: groups.map((group) => {
			const table = deriveInflection({
				lemma,
				ownedSurfaces: ownedSurfaceEntries,
				principalParts: principalPartsOf(
					lemma,
					paradigm,
					group.selection,
				),
			});
			return {
				lines: table === undefined ? [] : table.split("\n"),
				readings: group.readings.flatMap((key) => byKey.get(key) ?? []),
				selectionKey: group.key,
			};
		}),
	};
}

/** The codec's `tags` hook: the tags of one Reading, from its own Licences. */
export function interimTags(context: {
	readonly records: Records;
	readonly entry: { readonly reading: Dumling.Reading };
}): readonly string[] {
	const { lemma, paradigm } = context.records.lemmaRecord;
	const key = readingIdentityKey(context.entry.reading);
	const selection: Partial<Record<Dimension, readonly Dumrel.VariantId[]>> =
		{};
	for (const dimension of Object.keys(
		paradigm?.dimensions ?? {},
	) as Dimension[])
		selection[dimension] = paradigm
			? licensed(paradigm, dimension, key)
			: [];
	return deriveTags({
		lemma,
		ownedSurfaces: context.records.ownedSurfaceEntries,
		principalParts: principalPartsOf(lemma, paradigm, selection),
	});
}

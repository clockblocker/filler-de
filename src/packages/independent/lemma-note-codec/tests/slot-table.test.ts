import { describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";
import path from "node:path";
import { GERMAN_SLOT_TABLE, type SlotEncoding } from "../src";

const SCHEMA_DIR = path.resolve(
	import.meta.dir,
	"../../../../../.texteater/battery/dumling/src/generated/schemas/de",
);

type ZodLike = {
	readonly def: { readonly type: string; readonly options?: ZodLike[] };
	readonly options?: readonly string[];
	readonly shape?: Record<string, ZodLike>;
	readonly value?: string;
	unwrap?: () => ZodLike;
};

/** The slot encoding a Core Feature's dumling schema calls for (ADR 0013). */
/** Closed values are written verbatim, so they must stay plain words. */
const spellable = (options: readonly string[] | undefined) =>
	(options ?? []).every((option) => /^[A-Za-z0-9]+$/u.test(option));

/**
 * The slot encoding a Core Feature's dumling schema calls for (ADR 0013), or
 * "unsupported" when no encoding spells all of its values.
 */
function encodingOf(schema: ZodLike): SlotEncoding | "unsupported" {
	const inner = schema.unwrap?.() ?? schema;
	if (inner.def.type === "string") return "text";
	if (inner.def.type === "enum") {
		const options = inner.options ?? [];
		if (!spellable(options)) return "unsupported";
		return options.length === 1 && options[0] === "Yes" ? "flag" : "value";
	}
	if (inner.def.type === "union") {
		const variants = inner.def.options ?? [];
		const kinds = variants.map((option) => option.def.type);
		const values = variants.find((option) => option.def.type === "enum");
		if (
			kinds.length === 2 &&
			kinds.includes("object") &&
			values !== undefined &&
			spellable(values.options)
		)
			return "valueSet";
	}
	return "unsupported";
}

async function germanRoutes() {
	const routes: {
		family: string;
		kind: string;
		core: Record<string, SlotEncoding | "unsupported">;
	}[] = [];
	for (const familyDir of readdirSync(SCHEMA_DIR)) {
		for (const file of readdirSync(path.join(SCHEMA_DIR, familyDir))) {
			const module = (await import(
				path.join(SCHEMA_DIR, familyDir, file)
			)) as {
				lemmaSchema: { shape: Record<string, ZodLike> };
			};
			const { shape } = module.lemmaSchema;
			const core = shape.coreFeatures?.shape ?? {};
			routes.push({
				core: Object.fromEntries(
					Object.entries(core).map(([name, schema]) => [
						name,
						encodingOf(schema),
					]),
				),
				family: shape.family?.value ?? "",
				kind: shape.kind?.value ?? "",
			});
		}
	}
	return routes;
}

describe("the German slot table", () => {
	it("gives every dumling route a slot for each Core Feature, spelled as its schema allows", async () => {
		const routes = await germanRoutes();
		expect(routes.length).toBeGreaterThan(30);
		const table: Readonly<
			Record<
				string,
				Readonly<
					Record<
						string,
						readonly { feature: string; encoding: string }[]
					>
				>
			>
		> = GERMAN_SLOT_TABLE;
		for (const { family, kind, core } of routes) {
			const slots = table[family]?.[kind];
			expect({ family, kind, known: slots !== undefined }).toEqual({
				family,
				kind,
				known: true,
			});
			const spelled = Object.fromEntries(
				(slots ?? []).map(({ feature, encoding }) => [
					feature,
					encoding,
				]),
			);
			expect({ family, kind, slots: spelled }).toEqual({
				family,
				kind,
				slots: core,
			});
		}
	});

	it("has no route that dumling lacks", async () => {
		const routes = new Set(
			(await germanRoutes()).map(
				({ family, kind }) => `${family}/${kind}`,
			),
		);
		const tabled = Object.entries(GERMAN_SLOT_TABLE).flatMap(
			([family, kinds]) =>
				Object.keys(kinds).map((kind) => `${family}/${kind}`),
		);
		expect(tabled.filter((route) => !routes.has(route))).toEqual([]);
	});

	it("keeps the slot order ADR 0013 fixes", () => {
		const order = (family: string, kind: string) => {
			const table: Readonly<
				Record<
					string,
					Readonly<Record<string, readonly { feature: string }[]>>
				>
			> = GERMAN_SLOT_TABLE;
			return (table[family]?.[kind] ?? []).map(({ feature }) => feature);
		};
		const pronominal = [
			"pronType",
			"person",
			"gender",
			"number",
			"case",
			"poss",
			"polite",
		];
		expect(order("Lexeme", "PRON")).toEqual(pronominal);
		expect(order("Lexeme", "DET")).toEqual(pronominal);
		expect(order("Lexeme", "NOUN")).toEqual(["gender"]);
		expect(order("Lexeme", "VERB")).toEqual([
			"hasSepPrefix",
			"lexicallyReflexive",
		]);
		expect(order("Lexeme", "PROPN")).toEqual(["article", "gender"]);
		expect(order("Foreign", "Foreign")).toEqual(["sourceLang"]);
		expect(order("Morpheme", "Prefix")).toEqual(["hasSepPrefix"]);
	});
});

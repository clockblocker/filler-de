import { describe, expect, it } from "bun:test";
import {
	buildGermanVerbEntryIdentity,
	GermanVerbFullFeaturesSchema,
} from "../../../src/linguistics/de/lexem/verb/features";

describe("German verb features", () => {
	it("parses full verb features", () => {
		const result = GermanVerbFullFeaturesSchema.safeParse({
			conjugation: "Regular",
			pos: "Verb",
			valency: {
				governedPreposition: "um",
				reflexivity: "ReflexiveOnly",
				separability: "None",
			},
		});

		expect(result.success).toBe(true);
	});

	it("builds stable entry identity and normalizes preposition", () => {
		const identityA = buildGermanVerbEntryIdentity({
			conjugation: "Irregular",
			valency: {
				governedPreposition: " an ",
				reflexivity: "NonReflexive",
				separability: "Separable",
			},
		});
		const identityB = buildGermanVerbEntryIdentity({
			conjugation: "Irregular",
			valency: {
				governedPreposition: "AN",
				reflexivity: "NonReflexive",
				separability: "Separable",
			},
		});

		expect(identityA).toBe(identityB);
	});
});

import z from "zod/v3";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { GermanFeature } from "./german-common-enums";

export const GermanVerbalInflectionalFeaturesSchema = featureSchema({
	gender: GermanFeature.Gender.optional(),
	mood: GermanFeature.Mood.optional(),
	number: GermanFeature.Number.optional(),
	person: GermanFeature.Person.optional(),
	tense: GermanFeature.Tense.optional(),
	verbForm: GermanFeature.VerbForm.optional(),
}).superRefine((features, ctx) => {
	if (features.gender !== undefined && features.verbForm !== "Part") {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "German verbal gender is only valid on participles",
			path: ["gender"],
		});
	}

	if (features.mood !== undefined && features.verbForm !== "Fin") {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "German verbal mood is only valid on finite forms",
			path: ["mood"],
		});
	}

	if (features.person !== undefined && features.verbForm !== "Fin") {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "German verbal person is only valid on finite forms",
			path: ["person"],
		});
	}

	if (features.verbForm === "Inf" && features.tense !== undefined) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "German infinitives do not inflect for tense",
			path: ["tense"],
		});
	}

	if (features.mood === "Imp" && features.tense !== undefined) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "German imperatives do not inflect for tense",
			path: ["tense"],
		});
	}
});

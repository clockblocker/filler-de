import z from "zod/v3";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import {
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanPerson,
	GermanTense,
	GermanVerbForm,
} from "./german-common-enums";

export const GermanVerbalInflectionalFeaturesSchema = featureSchema({
	gender: GermanGender.optional(),
	mood: GermanMood.optional(),
	number: GermanNumber.optional(),
	person: GermanPerson.optional(),
	tense: GermanTense.optional(),
	verbForm: GermanVerbForm.optional(),
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

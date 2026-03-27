import type { z } from "zod/v3";
import { makeSurfaceSchema } from "../../../common/dto/surface-factory";
import {
	GermanNounFullFeaturesSchema,
	GermanNounRefFeaturesSchema,
} from "./features";

export const GermanNounSurfaceSchema = makeSurfaceSchema(
	GermanNounFullFeaturesSchema,
	GermanNounRefFeaturesSchema,
);
export type GermanNounSurface = z.infer<typeof GermanNounSurfaceSchema>;

export type GermanNounLemma = Extract<
	GermanNounSurface,
	{ surfaceKind: "Lemma" }
>;
export type GermanNounInflection = Extract<
	GermanNounSurface,
	{ surfaceKind: "Inflected" }
>;
export type GermanNounVariant = Extract<
	GermanNounSurface,
	{ surfaceKind: "Variant" }
>;

export * from "./features";

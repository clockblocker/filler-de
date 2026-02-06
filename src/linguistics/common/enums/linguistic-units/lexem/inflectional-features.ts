import z from "zod/v3";

const inflectionalFeatures = [
	"Number",
	"Gender",
	"Case",
	"Degree",
	"Person",
	"Tense",
	"Mood",
	"Voice",
	"Aspect",
	"Aspect",
] as const;

export const InflectionalFeatureSchema = z.enum(inflectionalFeatures);
export type InflectionalFeature = z.infer<typeof InflectionalFeatureSchema>;
export const InflectionalFeature = InflectionalFeatureSchema.enum;
export const INFLECTIONAL_FEATURES = InflectionalFeatureSchema.options;

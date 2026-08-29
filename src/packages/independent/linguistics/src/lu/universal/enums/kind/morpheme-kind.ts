import z from "zod/v3";

const morphemeKinds = [
	"Root",
	"Prefix",
	"Suffix",
	"Suffixoid", //cat*like*
	"Infix",
	"Circumfix",
	"Interfix",
	"Transfix",
	"Clitic",
	"ToneMarking",
	"Duplifix", // 	money~shmoney
] as const;

const MorphemeKindSchema = z.enum(morphemeKinds);

export type MorphemeKind = z.infer<typeof MorphemeKindSchema>;

export const MorphemeKind = MorphemeKindSchema.enum;

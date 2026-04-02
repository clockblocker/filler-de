import { z } from "zod/v3";

const voiceValues = [
	"Act",
	"Antip",
	"Bfoc",
	"Cau",
	"Dir",
	"Inv",
	"Lfoc",
	"Mid",
	"Pass",
	"Rcp",
] as const;

// Source: https://universaldependencies.org/u/feat/Voice.html
export const Voice = z.enum(voiceValues);
export type Voice = z.infer<typeof Voice>;

const voiceRepr = {
	Act: "active or actor-focus voice",
	Antip: "antipassive voice",
	Bfoc: "beneficiary-focus voice",
	Cau: "causative voice",
	Dir: "direct voice",
	Inv: "inverse voice",
	Lfoc: "location-focus voice",
	Mid: "middle voice",
	Pass: "passive or patient-focus voice",
	Rcp: "reciprocal voice",
} satisfies Record<Voice, string>;

export function reprForVoice(voice: Voice) {
	return voiceRepr[voice];
}

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
export const VOICE_KEY = "voice";

const reprForVoice = {
	Act: "active", // actor-focus
	Antip: "antipassive",
	Bfoc: "beneficiary-focus",
	Cau: "causative",
	Dir: "direct",
	Inv: "inverse",
	Lfoc: "location-focus",
	Mid: "middle",
	Pass: "passive", // patient-focus
	Rcp: "reciprocal",
} satisfies Record<Voice, string>;

export function getReprForVoice(voice: Voice) {
	return reprForVoice[voice];
}

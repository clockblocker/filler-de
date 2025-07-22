import z from 'zod/v4';

const COLLOCATION_STRENGTH_STR = [
	'Free', // fully compositional and flexible combinations (e.g. "red car")
	'Bound', // statistically preferred, semi-fixed phrases (e.g. "make a decision")
	'Frozen', // lexically fixed expressions with limited or no variation (e.g. "kick the bucket")
] as const;

export const CollocationStrengthSchema = z.enum(COLLOCATION_STRENGTH_STR);

export type CollocationStrength = z.infer<typeof CollocationStrengthSchema>;
export const CollocationStrength = CollocationStrengthSchema.enum;
export const COLLOCATION_STRENGTHS = CollocationStrengthSchema.options;

export const weightFromCollocationStrength = {
	[CollocationStrength.Free]: 0,
	[CollocationStrength.Bound]: 1,
	[CollocationStrength.Frozen]: 3,
} as const;

import z from "zod/v3";

export const EmojiDescriptionSchema = z
	.array(z.string().min(1).max(4))
	.min(1)
	.max(3);

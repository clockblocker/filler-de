import z from "zod/v3";

const emojiClusterRegex =
	/\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0F|(?:\u200D\p{Extended_Pictographic}\uFE0F?))*)/gu;

export const MeaningInEmojisSchema = z.string().refine((value) => {
	const normalized = value.normalize("NFC");
	const clusters = normalized.match(emojiClusterRegex);

	return (
		clusters !== null &&
		clusters.join("") === normalized &&
		clusters.length >= 1 &&
		clusters.length <= 3
	);
});

import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { decodeLingId, decodeLingIdAs } from "./internal/codec/decode";
import { encodeLingId } from "./internal/codec/encode";
import type { LingIdCodecFor } from "./types";

export type {
	ConcreteLingIdKind,
	KnownSelection,
	LingId,
	LingIdCodecFor,
	LingIdDecodeError,
	LingIdDecodeErrorCode,
	LingIdValueFor,
} from "./types";

function forLanguage<L extends TargetLanguage>(language: L): LingIdCodecFor<L> {
	return {
		makeLingIdFor: ((value) =>
			encodeLingId(
				language,
				value,
			)) as LingIdCodecFor<L>["makeLingIdFor"],
		tryToDecode: (id: string) => decodeLingId(language, id),
		tryToDecodeAs: ((kind, id: string) =>
			decodeLingIdAs(
				language,
				kind,
				id,
			)) as LingIdCodecFor<L>["tryToDecodeAs"],
	};
}

export const LingIdCodec = {
	English: forLanguage("English"),
	forLanguage,
	German: forLanguage("German"),
	Hebrew: forLanguage("Hebrew"),
} satisfies {
	forLanguage<L extends TargetLanguage>(language: L): LingIdCodecFor<L>;
} & {
	[L in TargetLanguage]: LingIdCodecFor<L>;
};

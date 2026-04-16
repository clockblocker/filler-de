import type { TargetLanguage } from "../lu/universal/enums/core/language";
import { decodeLingId, decodeLingIdAs } from "./internal/codec/decode";
import { encodeLingId } from "./internal/codec/encode";
import type { LingIdApiFor } from "./types";

export type {
	ConcreteLingIdKind,
	KnownSelection,
	LingId,
	LingIdDecodeError,
	LingIdDecodeErrorCode,
	LingIdValueFor,
} from "./types";

export function lingIdApiForLanguage<L extends TargetLanguage>(
	language: L,
): LingIdApiFor<L> {
	return {
		makeLingIdFor: ((value) =>
			encodeLingId(language, value)) as LingIdApiFor<L>["makeLingIdFor"],
		tryToDecode: (id: string) => decodeLingId(language, id),
		tryToDecodeAs: ((kind, id: string) =>
			decodeLingIdAs(
				language,
				kind,
				id,
			)) as LingIdApiFor<L>["tryToDecodeAs"],
	};
}

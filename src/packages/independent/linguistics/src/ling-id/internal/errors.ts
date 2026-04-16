import type { LingIdDecodeError, LingIdDecodeErrorCode } from "../types";

export function lingIdDecodeError(
	code: LingIdDecodeErrorCode,
	input: string,
	message: string,
	cause?: unknown,
): LingIdDecodeError {
	return {
		code,
		...(cause === undefined ? {} : { cause }),
		input,
		message,
	};
}

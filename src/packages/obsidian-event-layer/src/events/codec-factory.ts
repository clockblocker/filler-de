/**
 * Generic factory for event codecs.
 * Provides a typed encode function and optional codec-specific helpers.
 */

type EncodeFn<TPayload, TArgs extends unknown[]> = (...args: TArgs) => TPayload;

type EventCodec<TPayload, TArgs extends unknown[]> = {
	encode: EncodeFn<TPayload, TArgs>;
};

export function createEventCodec<TPayload, TArgs extends unknown[]>(
	encode: EncodeFn<TPayload, TArgs>,
): EventCodec<TPayload, TArgs>;
export function createEventCodec<
	TPayload,
	TArgs extends unknown[],
	TExtras extends Record<string, unknown>,
>(
	encode: EncodeFn<TPayload, TArgs>,
	extras: TExtras,
): EventCodec<TPayload, TArgs> & TExtras;
export function createEventCodec<
	TPayload,
	TArgs extends unknown[],
	TExtras extends Record<string, unknown>,
>(encode: EncodeFn<TPayload, TArgs>, extras?: TExtras) {
	return extras ? { encode, ...extras } : { encode };
}

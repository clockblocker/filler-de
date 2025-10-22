export type Maybe<T> =
	| { error: true; description?: string }
	| { error: false; data: T };

export function unwrapMaybe<T>(maybe: Maybe<T>, whoCalled?: string): T {
	if (maybe.error) {
		console.error(`${whoCalled ?? ""} ${maybe.description}`);
		throw new Error(maybe.description);
	}

	return maybe.data;
}

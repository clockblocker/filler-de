export type Maybe<T> =
	| { error: true; errorText?: string }
	| { error: false; data: T };

export type PathParts = string[];

export function unwrapMaybe<T>(maybe: Maybe<T>, whoCalled?: string): T {
	if (maybe.error) {
		console.error(`${whoCalled ?? ''} ${maybe.errorText}`);
		throw new Error(maybe.errorText);
	}
	return maybe.data;
}

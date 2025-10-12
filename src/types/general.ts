export type Maybe<T> =
	| { error: true; description?: string }
	| { error: false; data: T };

export type PathParts = string[];

// PathParts.join('/')/title.md
export type PrettyPath = { pathParts: PathParts; title: string };

export function unwrapMaybe<T>(maybe: Maybe<T>, whoCalled?: string): T {
	if (maybe.error) {
		console.error(`${whoCalled ?? ''} ${maybe.description}`);
		throw new Error(maybe.description);
	} else if ('data' in maybe) {
		return maybe.data;
	}
}

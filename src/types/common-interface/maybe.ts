export type Maybe<T> =
	| { error: true; description?: string }
	| { error: false; data: T };

export function unwrapMaybeByThrowing<T>(
	maybe: Maybe<T>,
	whoCalled?: string,
	additionalInfo?: string,
): T {
	if (maybe.error) {
		const description = [additionalInfo ?? "", maybe.description ?? ""]
			.filter(Boolean)
			.join(": ");

		console.error(`${whoCalled ?? ""} ${description}`);
		throw new Error(description);
	}

	return maybe.data;
}

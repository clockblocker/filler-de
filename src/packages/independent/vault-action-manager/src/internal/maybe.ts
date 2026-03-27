export type MaybeLegacy<T> =
	| { error: true; description?: string }
	| { error: false; data: T };

export function unwrapMaybeLegacyByThrowing<T>(
	maybe: MaybeLegacy<T>,
	additionalInfo?: string,
): T {
	if (maybe.error) {
		const description = [additionalInfo ?? "", maybe.description ?? ""]
			.filter(Boolean)
			.join(": ");
		throw new Error(description);
	}

	return maybe.data;
}

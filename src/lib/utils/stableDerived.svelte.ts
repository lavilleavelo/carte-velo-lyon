export function stableDerived<T>(read: () => T): { readonly current: T } {
	let lastKey: string | undefined;
	let lastValue: T;

	const value = $derived.by(() => {
		const next = read();
		const key = JSON.stringify(next);
		if (key !== lastKey) {
			lastKey = key;
			lastValue = next;
		}
		return lastValue;
	});

	return {
		get current() {
			return value;
		},
	};
}

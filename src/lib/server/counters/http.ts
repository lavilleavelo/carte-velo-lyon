export type FetchOptions = { timeoutMs?: number; attempts?: number };

export async function fetchJson<T>(
	url: string,
	{ timeoutMs = 60_000, attempts = 3 }: FetchOptions = {},
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} ${response.statusText}`);
			}
			return (await response.json()) as T;
		} catch (error) {
			lastError = error;
			if (attempt < attempts) {
				await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
			}
		}
	}
	throw new Error(`[counters] ${url} failed after ${attempts} attempts`, {
		cause: lastError,
	});
}

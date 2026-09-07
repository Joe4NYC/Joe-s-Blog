/**
 * Small helpers shared by every admin API route.
 */

export const JSON_HEADERS = {
	'Content-Type': 'application/json; charset=utf-8',
	'Cache-Control': 'no-store',
	'X-Robots-Tag': 'noindex, nofollow',
} as const;

export function json(data: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(data), {
		...init,
		headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
	});
}

export function fail(status: number, message: string, extra: Record<string, unknown> = {}): Response {
	return json({ ok: false, error: message, ...extra }, { status });
}

export function ok(data: Record<string, unknown> = {}): Response {
	return json({ ok: true, ...data });
}

export function readCookie(request: Request, name: string): string | null {
	const header = request.headers.get('Cookie');
	if (!header) return null;

	for (const part of header.split(';')) {
		const index = part.indexOf('=');
		if (index === -1) continue;
		if (part.slice(0, index).trim() !== name) continue;
		return decodeURIComponent(part.slice(index + 1).trim());
	}

	return null;
}

/**
 * Blocks cross-site form posts: the session cookie is SameSite=Strict, and every
 * mutating call must additionally come from this Worker's own origin.
 */
export function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	if (!origin) return true;

	try {
		return new URL(origin).host === new URL(request.url).host;
	} catch {
		return false;
	}
}

export async function readJson<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T;
	} catch {
		throw new HttpError(400, '請求內容不是合法的 JSON。');
	}
}

export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

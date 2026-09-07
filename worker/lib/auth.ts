import type { Env } from './env';
import { requireEnv } from './env';
import { readCookie } from './http';

export const SESSION_COOKIE = 'ulbo_admin_session';

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
	const padded = value.replaceAll('-', '+').replaceAll('_', '/');
	const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
	]);
}

async function sign(secret: string, payload: string): Promise<string> {
	const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
	return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Compares two strings through their HMACs so the comparison time does not
 * depend on how many leading characters match.
 */
async function safeEqual(secret: string, a: string, b: string): Promise<boolean> {
	const [left, right] = await Promise.all([sign(secret, a), sign(secret, b)]);
	if (left.length !== right.length) return false;

	let diff = 0;
	for (let index = 0; index < left.length; index += 1) {
		diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
	}
	return diff === 0;
}

export interface SessionPayload {
	sub: string;
	iat: number;
	exp: number;
}

export async function createSessionToken(env: Env, username: string): Promise<{ token: string; maxAge: number }> {
	const secret = requireEnv(env, 'SESSION_SECRET');
	const ttlHours = Number.parseInt(env.SESSION_TTL_HOURS ?? '', 10);
	const maxAge = (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 12) * 3600;
	const now = Math.floor(Date.now() / 1000);
	const payload: SessionPayload = { sub: username, iat: now, exp: now + maxAge };
	const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

	return { token: `${body}.${await sign(secret, body)}`, maxAge };
}

export async function verifySessionToken(env: Env, token: string | null): Promise<SessionPayload | null> {
	if (!token) return null;

	const separator = token.lastIndexOf('.');
	if (separator <= 0) return null;

	const body = token.slice(0, separator);
	const signature = token.slice(separator + 1);
	const secret = requireEnv(env, 'SESSION_SECRET');

	if (!(await safeEqual(secret, signature, await sign(secret, body)))) return null;

	try {
		const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload;
		if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
		return payload;
	} catch {
		return null;
	}
}

export function getSessionCookie(request: Request): string | null {
	return readCookie(request, SESSION_COOKIE);
}

export function sessionCookieHeader(token: string, maxAge: number): string {
	return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearedCookieHeader(): string {
	return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function checkPassword(env: Env, password: string): Promise<boolean> {
	const expected = requireEnv(env, 'ADMIN_PASSWORD');
	return safeEqual(requireEnv(env, 'SESSION_SECRET'), password, expected);
}

/**
 * Per-isolate throttle for failed logins. Cloudflare may run several isolates,
 * so this slows brute force down rather than making it impossible — the real
 * protection is a long ADMIN_PASSWORD.
 */
const failures = new Map<string, { count: number; until: number }>();

export function loginBlockedFor(key: string): number {
	const entry = failures.get(key);
	if (!entry) return 0;
	if (entry.until <= Date.now()) {
		failures.delete(key);
		return 0;
	}
	return Math.ceil((entry.until - Date.now()) / 1000);
}

export function recordLoginFailure(key: string): void {
	const entry = failures.get(key) ?? { count: 0, until: 0 };
	entry.count += 1;
	if (entry.count >= 5) entry.until = Date.now() + Math.min(15 * 60_000, 2 ** (entry.count - 5) * 30_000);
	failures.set(key, entry);
}

export function clearLoginFailures(key: string): void {
	failures.delete(key);
}

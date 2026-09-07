/**
 * Base64 helpers that survive non-ASCII content and large binary uploads.
 */

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let index = 0; index < bytes.length; index += CHUNK) {
		binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
	}
	return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value.replace(/\s+/g, ''));
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}

export function utf8ToBase64(text: string): string {
	return bytesToBase64(new TextEncoder().encode(text));
}

export function base64ToUtf8(value: string): string {
	return new TextDecoder().decode(base64ToBytes(value));
}

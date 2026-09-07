import { base64ToBytes } from '../lib/base64';
import type { Env } from '../lib/env';
import { deleteFile, getFile, getFileBytes, getTree, putFile, repoRef } from '../lib/github';
import { HttpError, ok, readJson } from '../lib/http';

export const MEDIA_DIR = 'public/image';

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const MAX_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	avif: 'image/avif',
};

function extensionOf(path: string): string {
	return path.split('.').pop()?.toLowerCase() ?? '';
}

export async function handleListMedia(env: Env): Promise<Response> {
	const ref = repoRef(env);
	const tree = await getTree(ref);

	const items = tree
		.filter((entry) => entry.type === 'blob' && entry.path.startsWith(`${MEDIA_DIR}/`) && ALLOWED_EXTENSIONS.has(extensionOf(entry.path)))
		.map((entry) => {
			const relative = entry.path.slice(MEDIA_DIR.length + 1);
			const folder = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : '';
			return {
				path: entry.path,
				name: relative.split('/').pop() ?? relative,
				folder,
				size: entry.size ?? 0,
				/** Path as written inside a post body. */
				markdownPath: `/image/${relative}`,
				sitePath: `/image/${relative}`,
			};
		})
		.sort((a, b) => a.path.localeCompare(b.path));

	const folders = [...new Set(items.map((item) => item.folder).filter(Boolean))].sort();

	return ok({ items, folders });
}

interface UploadPayload {
	name?: string;
	folder?: string;
	dataBase64?: string;
}

function sanitizeSegment(value: string): string {
	return value
		.trim()
		.replace(/[\\/:*?"<>|#%{}[\]$'`^~,;!@&=+\s]/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '');
}

export async function handleUploadMedia(request: Request, env: Env): Promise<Response> {
	const ref = repoRef(env);
	const payload = await readJson<UploadPayload>(request);

	const rawName = payload.name?.trim();
	if (!rawName) throw new HttpError(400, '缺少檔名。');
	if (!payload.dataBase64) throw new HttpError(400, '缺少檔案內容。');

	const extension = extensionOf(rawName);
	if (!ALLOWED_EXTENSIONS.has(extension)) {
		throw new HttpError(400, `不支援的圖片格式 .${extension}，可用格式：${[...ALLOWED_EXTENSIONS].join('、')}`);
	}

	const stem = sanitizeSegment(rawName.slice(0, rawName.length - extension.length - 1)) || 'image';
	const folder = payload.folder ? sanitizeSegment(payload.folder) : '';
	const name = `${stem}.${extension}`;
	const path = folder ? `${MEDIA_DIR}/${folder}/${name}` : `${MEDIA_DIR}/${name}`;

	const bytes = base64ToBytes(payload.dataBase64);
	if (bytes.byteLength > MAX_BYTES) {
		throw new HttpError(413, `圖片超過 ${Math.round(MAX_BYTES / 1024 / 1024)}MB 上限，請先壓縮再上傳。`);
	}

	const existing = await getFile(ref, path);
	const result = await putFile(ref, path, bytes, `media: 上傳 ${name}`, existing?.sha);
	const relative = path.slice(MEDIA_DIR.length + 1);

	return ok({
		path,
		name,
		folder,
		size: bytes.byteLength,
		markdownPath: `/image/${relative}`,
		sha: result.sha,
		replaced: Boolean(existing),
	});
}

export async function handleDeleteMedia(env: Env, path: string): Promise<Response> {
	if (!path.startsWith(`${MEDIA_DIR}/`)) throw new HttpError(400, '只能刪除 public/image 底下的檔案。');

	const ref = repoRef(env);
	const file = await getTree(ref).then((tree) => tree.find((entry) => entry.path === path && entry.type === 'blob'));

	if (!file) throw new HttpError(404, `找不到檔案 ${path}`);

	await deleteFile(ref, path, file.sha, `media: 刪除 ${path.split('/').pop()}`);
	return ok({ path });
}

/**
 * Serves an image straight from the repository so newly uploaded files preview
 * before the site has been rebuilt.
 */
export async function handleRawMedia(env: Env, path: string): Promise<Response> {
	if (!path.startsWith(`${MEDIA_DIR}/`)) throw new HttpError(400, '只能讀取 public/image 底下的檔案。');

	const file = await getFileBytes(repoRef(env), path);
	if (!file) throw new HttpError(404, `找不到檔案 ${path}`);

	return new Response(file.bytes, {
		headers: {
			'Content-Type': MIME_BY_EXTENSION[extensionOf(path)] ?? file.type,
			'Cache-Control': 'private, max-age=60',
			'X-Robots-Tag': 'noindex, nofollow',
		},
	});
}

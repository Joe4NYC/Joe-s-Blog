import type { Env } from '../lib/env';
import {
	deleteFile,
	getBlobTexts,
	getFile,
	getTree,
	putFile,
	repoRef,
	type RepoRef,
} from '../lib/github';
import { HttpError, ok, readJson } from '../lib/http';
import {
	excerpt,
	normalizeDate,
	normalizeTag,
	nowInShanghai,
	parsePost,
	serializePost,
	validateFrontmatter,
	type PostFrontmatter,
} from '../lib/frontmatter';

export const BLOG_DIR = 'src/content/blog';

const REST_FALLBACK_LIMIT = 30;

export interface PostSummary {
	filename: string;
	path: string;
	slug: string;
	title: string;
	date: string;
	updated?: string;
	description?: string;
	draft: boolean;
	categories: string[];
	tags: string[];
	excerpt: string;
	url: string;
	error?: string;
}

function isPostFile(path: string): boolean {
	return path.startsWith(`${BLOG_DIR}/`) && /\.(md|mdx)$/i.test(path) && !path.includes('/image/');
}

function toSlug(filename: string): string {
	return filename.replace(/\.(md|mdx)$/i, '');
}

/**
 * Lists every post with its frontmatter. Contents come from one GraphQL round
 * trip; the REST fallback keeps the panel usable if GraphQL is unavailable, at
 * the cost of only showing the newest posts.
 */
export async function listPosts(ref: RepoRef): Promise<PostSummary[]> {
	const tree = await getTree(ref);
	const paths = tree.filter((entry) => entry.type === 'blob' && isPostFile(entry.path)).map((entry) => entry.path);

	let texts = await getBlobTexts(ref, paths);

	if (!texts) {
		texts = new Map<string, string>();
		const limited = paths.slice(0, REST_FALLBACK_LIMIT);
		const files = await Promise.all(limited.map((path) => getFile(ref, path)));
		for (const file of files) {
			if (file) texts.set(file.path, file.text);
		}
	}

	const posts: PostSummary[] = [];

	for (const path of paths) {
		const filename = path.slice(BLOG_DIR.length + 1);
		const slug = toSlug(filename);
		const source = texts.get(path);

		if (source === undefined) {
			posts.push(emptySummary(filename, slug, '內容尚未載入'));
			continue;
		}

		try {
			const { frontmatter, body } = parsePost(source);
			posts.push({
				filename,
				path,
				slug,
				title: frontmatter.title,
				date: frontmatter.date,
				updated: frontmatter.updated,
				description: frontmatter.description,
				draft: frontmatter.draft,
				categories: frontmatter.categories,
				tags: frontmatter.tags,
				excerpt: excerpt(body),
				url: `/blog/${encodeURIComponent(slug)}/`,
			});
		} catch (error) {
			posts.push(emptySummary(filename, slug, error instanceof Error ? error.message : '無法解析 frontmatter'));
		}
	}

	return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.filename.localeCompare(b.filename)));
}

function emptySummary(filename: string, slug: string, message: string): PostSummary {
	return {
		filename,
		path: `${BLOG_DIR}/${filename}`,
		slug,
		title: filename,
		date: '',
		draft: true,
		categories: [],
		tags: [],
		excerpt: '',
		url: `/blog/${encodeURIComponent(slug)}/`,
		error: message,
	};
}

export function buildFilename(title: string, date: string, extension = 'md'): string {
	const base = title
		.trim()
		.replace(/[\\/:*?"<>|#%{}[\]$'`^~,;!@&=+]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-.]+|[-.]+$/g, '')
		.slice(0, 60);

	const stamp = normalizeDate(date).slice(0, 10).replaceAll('-', '');
	return `${base || 'post'}_${stamp}.${extension}`;
}

interface PostPayload {
	title?: string;
	date?: string;
	updated?: string;
	description?: string;
	draft?: boolean;
	categories?: string[];
	tags?: string[];
	body?: string;
	sha?: string;
	filename?: string;
	touchUpdated?: boolean;
}

function buildFrontmatter(payload: PostPayload, previous?: PostFrontmatter): PostFrontmatter {
	const title = (payload.title ?? previous?.title ?? '').trim();
	const date = (payload.date ?? previous?.date ?? nowInShanghai()).trim();
	const draft = payload.draft ?? previous?.draft ?? true;
	const description = (payload.description ?? previous?.description ?? '').trim();

	const categories = (payload.categories ?? previous?.categories ?? [])
		.map((item) => item.trim())
		.filter(Boolean);

	const tags = [...new Set((payload.tags ?? previous?.tags ?? []).map(normalizeTag).filter(Boolean))];

	const updatedSource = payload.touchUpdated === false ? (payload.updated ?? previous?.updated) : nowInShanghai();

	return {
		title,
		date: normalizeDate(date),
		...(updatedSource ? { updated: normalizeDate(updatedSource) } : {}),
		...(description ? { description } : {}),
		draft,
		categories: categories.slice(0, 1),
		tags,
	};
}

function assertValid(frontmatter: PostFrontmatter): void {
	const errors = validateFrontmatter(frontmatter);
	if (errors.length > 0) throw new HttpError(400, errors.join('；'));
}

export async function handleCreatePost(request: Request, env: Env): Promise<Response> {
	const ref = repoRef(env);
	const payload = await readJson<PostPayload>(request);

	if (!payload.title?.trim()) throw new HttpError(400, '請先填寫文章標題。');

	const frontmatter = buildFrontmatter({ ...payload, touchUpdated: false });
	frontmatter.updated = undefined;
	assertValid(frontmatter);

	const filename = payload.filename?.trim() || buildFilename(frontmatter.title, frontmatter.date);
	const path = `${BLOG_DIR}/${filename}`;

	if (await getFile(ref, path)) throw new HttpError(409, `已存在同名檔案 ${filename}，請改一個標題或自訂檔名。`);

	const source = serializePost(frontmatter, payload.body ?? '');
	const result = await putFile(ref, path, source, `post: 新增〈${frontmatter.title}〉`);

	return ok({ filename, path, sha: result.sha, commit: result.commit });
}

export async function handleReadPost(env: Env, filename: string): Promise<Response> {
	const ref = repoRef(env);
	const path = `${BLOG_DIR}/${filename}`;
	const file = await getFile(ref, path);

	if (!file) throw new HttpError(404, `找不到文章 ${filename}`);

	const { frontmatter, body } = parsePost(file.text);

	return ok({
		post: {
			filename,
			path,
			slug: toSlug(filename),
			sha: file.sha,
			url: `/blog/${encodeURIComponent(toSlug(filename))}/`,
			...frontmatter,
			body,
		},
	});
}

export async function handleUpdatePost(request: Request, env: Env, filename: string): Promise<Response> {
	const ref = repoRef(env);
	const payload = await readJson<PostPayload>(request);
	const path = `${BLOG_DIR}/${filename}`;
	const current = await getFile(ref, path);

	if (!current) throw new HttpError(404, `找不到文章 ${filename}`);
	if (payload.sha && payload.sha !== current.sha) {
		throw new HttpError(409, '這篇文章在別處被改過了，請重新載入後再儲存，以免覆蓋別人的修改。');
	}

	const previous = parsePost(current.text);
	const frontmatter = buildFrontmatter(payload, previous.frontmatter);
	assertValid(frontmatter);

	const body = payload.body ?? previous.body;
	const source = serializePost(frontmatter, body, previous.eol);
	const targetName = payload.filename?.trim() || filename;

	if (targetName !== filename) {
		const targetPath = `${BLOG_DIR}/${targetName}`;
		if (await getFile(ref, targetPath)) throw new HttpError(409, `已存在同名檔案 ${targetName}。`);

		const created = await putFile(ref, targetPath, source, `post: 重新命名〈${frontmatter.title}〉`);
		await deleteFile(ref, path, current.sha, `post: 移除舊檔 ${filename}`);

		return ok({ filename: targetName, path: targetPath, sha: created.sha, renamed: true });
	}

	const result = await putFile(ref, path, source, `post: 更新〈${frontmatter.title}〉`, current.sha);
	return ok({ filename, path, sha: result.sha, commit: result.commit });
}

export async function handleDeletePost(env: Env, filename: string): Promise<Response> {
	const ref = repoRef(env);
	const path = `${BLOG_DIR}/${filename}`;
	const file = await getFile(ref, path);

	if (!file) throw new HttpError(404, `找不到文章 ${filename}`);

	await deleteFile(ref, path, file.sha, `post: 刪除 ${filename}`);
	return ok({ filename });
}

import {
	checkPassword,
	clearLoginFailures,
	clearedCookieHeader,
	createSessionToken,
	getSessionCookie,
	loginBlockedFor,
	recordLoginFailure,
	sessionCookieHeader,
	verifySessionToken,
} from './lib/auth';
import { ConfigError, type Env } from './lib/env';
import { repoRef } from './lib/github';
import { fail, HttpError, isSameOrigin, json, ok, readJson } from './lib/http';
import { handleDeploy, handleDeployStatus, latestDeployRun } from './routes/deploy';
import { handleDeleteMedia, handleListMedia, handleRawMedia, handleUploadMedia } from './routes/media';
import {
	handleCreatePost,
	handleDeletePost,
	handleReadPost,
	handleUpdatePost,
	listPosts,
} from './routes/posts';
import { handleReadSettings, handleWriteSettings } from './routes/settings';
import { handleGetViews, handleIncrementViews } from './routes/views';

const API_PREFIX = '/api/admin';
const VIEWS_PATH = '/api/views';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (!url.pathname.startsWith('/api/')) {
			return env.ASSETS.fetch(request);
		}

		try {
			// 公開端點：文章瀏覽計數。讀者沒有登入，所以要擋在 admin 檢查之前。
			if (url.pathname === VIEWS_PATH) {
				return await routeViews(request, env, url);
			}

			if (!url.pathname.startsWith(API_PREFIX)) {
				return fail(404, '沒有這個 API。');
			}

			return await route(request, env, url);
		} catch (error) {
			return toErrorResponse(error);
		} finally {
			void ctx;
		}
	},
} satisfies ExportedHandler<Env>;

function toErrorResponse(error: unknown): Response {
	if (error instanceof HttpError) return fail(error.status, error.message);
	if (error instanceof ConfigError) return fail(500, error.message);

	console.error('admin api error', error);
	return fail(500, error instanceof Error ? error.message : '伺服器發生未預期的錯誤。');
}

async function routeViews(request: Request, env: Env, url: URL): Promise<Response> {
	const slug = url.searchParams.get('slug') ?? '';

	if (request.method === 'GET') return handleGetViews(env, slug);

	if (request.method === 'POST') {
		// Origin 不存在時 isSameOrigin() 回 true，所以同源的 fetch 不會被誤擋，
		// 但別的網站用瀏覽器灌數字會被擋下來。
		if (!isSameOrigin(request)) throw new HttpError(403, '跨站請求被拒絕。');
		return handleIncrementViews(env, slug);
	}

	throw new HttpError(405, '不支援這個方法。');
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
	const path = url.pathname.slice(API_PREFIX.length) || '/';
	const method = request.method.toUpperCase();

	if (!SAFE_METHODS.has(method) && !isSameOrigin(request)) {
		return fail(403, '請求來源不正確。');
	}

	if (path === '/login' && method === 'POST') return login(request, env);
	if (path === '/logout' && method === 'POST') return logout();

	const session = await verifySessionToken(env, getSessionCookie(request));

	if (path === '/session' && method === 'GET') {
		return ok({ authenticated: Boolean(session), user: session?.sub ?? null, expiresAt: session?.exp ?? null });
	}

	if (!session) return fail(401, '尚未登入或登入已過期。');

	if (path === '/overview' && method === 'GET') return overview(env);

	if (path === '/posts') {
		if (method === 'GET') return ok({ posts: await listPosts(repoRef(env)) });
		if (method === 'POST') return handleCreatePost(request, env);
	}

	const postMatch = path.match(/^\/posts\/(.+)$/);
	if (postMatch) {
		const filename = safeFilename(decodeURIComponent(postMatch[1]));
		if (method === 'GET') return handleReadPost(env, filename);
		if (method === 'PUT') return handleUpdatePost(request, env, filename);
		if (method === 'DELETE') return handleDeletePost(env, filename);
	}

	if (path === '/media/raw' && method === 'GET') {
		return handleRawMedia(env, requireParam(url, 'path'));
	}

	if (path === '/media') {
		if (method === 'GET') return handleListMedia(env);
		if (method === 'POST') return handleUploadMedia(request, env);
		if (method === 'DELETE') return handleDeleteMedia(env, requireParam(url, 'path'));
	}

	if (path === '/settings') {
		if (method === 'GET') return handleReadSettings(env);
		if (method === 'PUT') return handleWriteSettings(request, env);
	}

	if (path === '/deploy') {
		if (method === 'GET') return handleDeployStatus(env);
		if (method === 'POST') return handleDeploy(env);
	}

	return fail(404, `沒有這個 API：${method} ${url.pathname}`);
}

function requireParam(url: URL, name: string): string {
	const value = url.searchParams.get(name);
	if (!value) throw new HttpError(400, `缺少參數 ${name}。`);
	return value;
}

/** Blocks path traversal before a name ever reaches the GitHub Contents API. */
function safeFilename(filename: string): string {
	const value = filename.trim();

	if (!value || value.includes('/') || value.includes('\\') || value.includes('..')) {
		throw new HttpError(400, '檔名不合法。');
	}
	if (!/\.(md|mdx)$/i.test(value)) throw new HttpError(400, '文章檔名必須以 .md 或 .mdx 結尾。');

	return value;
}

async function login(request: Request, env: Env): Promise<Response> {
	const clientKey = request.headers.get('CF-Connecting-IP') ?? 'unknown';
	const blockedFor = loginBlockedFor(clientKey);

	if (blockedFor > 0) {
		return fail(429, `嘗試次數過多，請等 ${blockedFor} 秒後再試。`);
	}

	const payload = await readJson<{ password?: string }>(request);
	const password = typeof payload.password === 'string' ? payload.password : '';

	if (!password || !(await checkPassword(env, password))) {
		recordLoginFailure(clientKey);
		return fail(401, '密碼不正確。');
	}

	clearLoginFailures(clientKey);

	const username = env.ADMIN_USERNAME?.trim() || 'admin';
	const { token, maxAge } = await createSessionToken(env, username);

	return json(
		{ ok: true, user: username },
		{ headers: { 'Set-Cookie': sessionCookieHeader(token, maxAge) } },
	);
}

function logout(): Response {
	return json({ ok: true }, { headers: { 'Set-Cookie': clearedCookieHeader() } });
}

async function overview(env: Env): Promise<Response> {
	const ref = repoRef(env);
	const posts = await listPosts(ref);

	const published = posts.filter((post) => !post.draft && !post.error);
	const drafts = posts.filter((post) => post.draft && !post.error);
	const broken = posts.filter((post) => Boolean(post.error));

	const tags = new Set<string>();
	const categories = new Set<string>();
	for (const post of published) {
		for (const tag of post.tags) tags.add(tag);
		for (const category of post.categories) categories.add(category);
	}

	// 部署狀態拿不到不該讓整個儀表板掛掉，所以這裡單獨吞掉錯誤。
	let deploy: unknown = null;
	try {
		const run = await latestDeployRun(env);
		deploy = run
			? {
					id: run.id,
					name: run.name,
					status: run.status,
					conclusion: run.conclusion,
					url: run.html_url,
					event: run.event,
					createdAt: run.created_at,
					updatedAt: run.updated_at,
				}
			: null;
	} catch {
		deploy = null;
	}

	return ok({
		counts: {
			total: posts.length,
			published: published.length,
			drafts: drafts.length,
			broken: broken.length,
			tags: tags.size,
			categories: categories.size,
		},
		recent: posts.slice(0, 6),
		broken,
		latestDeploy: deploy,
		repo: { owner: ref.owner, name: ref.repo, branch: ref.branch },
	});
}

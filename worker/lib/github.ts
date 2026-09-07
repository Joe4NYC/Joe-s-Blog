import { base64ToUtf8, bytesToBase64, utf8ToBase64 } from './base64';
import type { Env } from './env';
import { requireEnv } from './env';
import { HttpError } from './http';

const API = 'https://api.github.com';
const USER_AGENT = 'ulbo-admin-worker';

export interface RepoRef {
	owner: string;
	repo: string;
	branch: string;
	token: string;
}

export function repoRef(env: Env): RepoRef {
	return {
		owner: requireEnv(env, 'GITHUB_OWNER'),
		repo: requireEnv(env, 'GITHUB_REPO'),
		branch: requireEnv(env, 'GITHUB_BRANCH'),
		token: requireEnv(env, 'GITHUB_TOKEN'),
	};
}

async function call(ref: RepoRef, path: string, init: RequestInit = {}): Promise<Response> {
	const response = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${ref.token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': USER_AGENT,
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...(init.headers ?? {}),
		},
	});

	if (response.status === 401 || response.status === 403) {
		throw new HttpError(502, 'GitHub 拒絕存取，請檢查 GITHUB_TOKEN 的權限（需要 Contents 讀寫與 Actions 讀寫）。');
	}

	return response;
}

async function callJson<T>(ref: RepoRef, path: string, init: RequestInit = {}): Promise<T> {
	const response = await call(ref, path, init);

	if (!response.ok) {
		const detail = await response.text();
		throw new HttpError(response.status === 404 ? 404 : 502, `GitHub API ${response.status}：${detail.slice(0, 400)}`);
	}

	return (await response.json()) as T;
}

export interface RepoFile {
	path: string;
	sha: string;
	text: string;
}

export async function getFile(ref: RepoRef, path: string): Promise<RepoFile | null> {
	const response = await call(
		ref,
		`/repos/${ref.owner}/${ref.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref.branch)}`,
	);

	if (response.status === 404) return null;
	if (!response.ok) throw new HttpError(502, `GitHub API ${response.status}：${(await response.text()).slice(0, 400)}`);

	const payload = (await response.json()) as { content?: string; sha: string; encoding?: string; type: string };
	if (payload.type !== 'file' || typeof payload.content !== 'string') return null;

	return { path, sha: payload.sha, text: base64ToUtf8(payload.content) };
}

export async function getFileBytes(ref: RepoRef, path: string): Promise<{ bytes: ArrayBuffer; type: string } | null> {
	const response = await call(
		ref,
		`/repos/${ref.owner}/${ref.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref.branch)}`,
		{ headers: { Accept: 'application/vnd.github.raw' } },
	);

	if (response.status === 404) return null;
	if (!response.ok) throw new HttpError(502, `GitHub API ${response.status}`);

	return {
		bytes: await response.arrayBuffer(),
		type: response.headers.get('Content-Type') ?? 'application/octet-stream',
	};
}

export interface CommitResult {
	sha: string;
	commit: string;
}

export async function putFile(
	ref: RepoRef,
	path: string,
	content: string | Uint8Array,
	message: string,
	sha?: string,
): Promise<CommitResult> {
	const payload = await callJson<{ content: { sha: string }; commit: { sha: string } }>(
		ref,
		`/repos/${ref.owner}/${ref.repo}/contents/${encodePath(path)}`,
		{
			method: 'PUT',
			body: JSON.stringify({
				message,
				content: typeof content === 'string' ? utf8ToBase64(content) : bytesToBase64(content),
				branch: ref.branch,
				...(sha ? { sha } : {}),
			}),
		},
	);

	return { sha: payload.content.sha, commit: payload.commit.sha };
}

export async function deleteFile(ref: RepoRef, path: string, sha: string, message: string): Promise<void> {
	await callJson(ref, `/repos/${ref.owner}/${ref.repo}/contents/${encodePath(path)}`, {
		method: 'DELETE',
		body: JSON.stringify({ message, sha, branch: ref.branch }),
	});
}

export interface TreeEntry {
	path: string;
	type: 'blob' | 'tree';
	sha: string;
	size?: number;
}

/**
 * One request returns every path in the repository, which keeps the Worker well
 * under Cloudflare's subrequest budget no matter how many posts exist.
 */
export async function getTree(ref: RepoRef): Promise<TreeEntry[]> {
	const payload = await callJson<{ tree: TreeEntry[]; truncated: boolean }>(
		ref,
		`/repos/${ref.owner}/${ref.repo}/git/trees/${encodeURIComponent(ref.branch)}?recursive=1`,
	);

	return payload.tree ?? [];
}

/**
 * Fetches many blobs in a single GraphQL round trip. Returns null when GraphQL
 * is unavailable so callers can fall back to per-file REST reads.
 */
export async function getBlobTexts(ref: RepoRef, paths: string[]): Promise<Map<string, string> | null> {
	if (paths.length === 0) return new Map();

	const fields = paths
		.map((path, index) => `f${index}: object(expression: ${JSON.stringify(`${ref.branch}:${path}`)}) { ... on Blob { text } }`)
		.join('\n');

	const response = await fetch(`${API}/graphql`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${ref.token}`,
			'Content-Type': 'application/json',
			'User-Agent': USER_AGENT,
		},
		body: JSON.stringify({
			query: `query { repository(owner: ${JSON.stringify(ref.owner)}, name: ${JSON.stringify(ref.repo)}) { ${fields} } }`,
		}),
	});

	if (!response.ok) return null;

	const payload = (await response.json()) as {
		data?: { repository?: Record<string, { text?: string } | null> };
		errors?: unknown[];
	};

	if (!payload.data?.repository || (payload.errors && payload.errors.length > 0)) return null;

	const result = new Map<string, string>();
	paths.forEach((path, index) => {
		const text = payload.data?.repository?.[`f${index}`]?.text;
		if (typeof text === 'string') result.set(path, text);
	});

	return result;
}

export interface WorkflowRun {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	html_url: string;
	created_at: string;
	updated_at: string;
	head_sha: string;
	event: string;
}

export async function listWorkflowRuns(ref: RepoRef, perPage = 5): Promise<WorkflowRun[]> {
	const payload = await callJson<{ workflow_runs: WorkflowRun[] }>(
		ref,
		`/repos/${ref.owner}/${ref.repo}/actions/runs?branch=${encodeURIComponent(ref.branch)}&per_page=${perPage}`,
	);

	return payload.workflow_runs ?? [];
}

export async function dispatchWorkflow(ref: RepoRef, workflow: string): Promise<void> {
	const response = await call(
		ref,
		`/repos/${ref.owner}/${ref.repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
		{ method: 'POST', body: JSON.stringify({ ref: ref.branch }) },
	);

	if (response.status === 204) return;

	const detail = await response.text();
	if (response.status === 404) {
		throw new HttpError(404, `找不到工作流程 ${workflow}，請確認 .github/workflows/${workflow} 已推送到 ${ref.branch} 分支。`);
	}
	throw new HttpError(502, `觸發部署失敗（${response.status}）：${detail.slice(0, 300)}`);
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

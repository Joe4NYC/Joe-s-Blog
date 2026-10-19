import type { BlogPost } from './blog';

/**
 * 相關文章：build 時算一次，結果直接寫進靜態頁，讀者看文章不會呼叫任何 AI。
 *
 * 有 CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN（token 要有 Workers AI 權限）就用
 * bge-m3 embedding 算語意相似度；沒有或呼叫失敗就退回標籤／分類重疊，build 不會因此失敗。
 */
export const EMBEDDING_MODEL = '@cf/baai/bge-m3';
const RELATED_COUNT = 3;
// ponytail: 每篇只取前 2000 字做 embedding，主題通常在開頭就講清楚了。
const MAX_TEXT_CHARS = 2000;
const BATCH_SIZE = 50;

interface PostLike {
	id: string;
	body?: string;
	data: { title: string; description?: string; tags: string[]; categories: string[] };
}

let cache: Promise<Map<string, string[]>> | null = null;

/** 同一次 build 只算一次（每個語言版本的每篇文章都會呼叫）。 */
export function getRelatedMap(posts: BlogPost[]): Promise<Map<string, string[]>> {
	cache ??= buildRelatedMap(posts);
	return cache;
}

async function buildRelatedMap(posts: PostLike[]): Promise<Map<string, string[]>> {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const token = process.env.CLOUDFLARE_API_TOKEN;

	if (accountId && token && posts.length > 1) {
		try {
			const vectors = await embed(posts.map(postText), accountId, token);
			console.info(`[related] 用 ${EMBEDDING_MODEL} 算出 ${posts.length} 篇文章的相關文章`);
			return rankBy(posts, (a, b) => cosine(vectors[a], vectors[b]));
		} catch (error) {
			console.warn(`[related] Workers AI 失敗，改用標籤重疊：${error instanceof Error ? error.message : error}`);
		}
	} else if (posts.length > 1) {
		console.info('[related] 沒有 Cloudflare 憑證，用標籤重疊排相關文章');
	}

	return rankBy(posts, (a, b) => tagOverlap(posts[a], posts[b]));
}

export function postText(post: PostLike): string {
	const { title, description, tags, categories } = post.data;
	return [title, description, [...categories, ...tags].join(' '), (post.body ?? '').slice(0, MAX_TEXT_CHARS)]
		.filter(Boolean)
		.join('\n');
}

async function embed(texts: string[], accountId: string, token: string): Promise<number[][]> {
	const vectors: number[][] = [];

	for (let start = 0; start < texts.length; start += BATCH_SIZE) {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBEDDING_MODEL}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: texts.slice(start, start + BATCH_SIZE), truncate_inputs: true }),
			},
		);
		const payload = (await response.json().catch(() => null)) as {
			success?: boolean;
			errors?: Array<{ message?: string }>;
			result?: { data?: number[][]; response?: number[][] };
		} | null;

		const batch = payload?.result?.data ?? payload?.result?.response;
		if (!response.ok || !payload?.success || !Array.isArray(batch)) {
			const reason = payload?.errors?.map((item) => item.message).join('; ') || `HTTP ${response.status}`;
			throw new Error(reason);
		}
		vectors.push(...batch);
	}

	if (vectors.length !== texts.length) throw new Error(`embedding 數量不符：${vectors.length}/${texts.length}`);
	return vectors;
}

/** 依相似度挑出每篇的前幾名；分數 ≤ 0 的不算相關。 */
export function rankBy(posts: PostLike[], score: (a: number, b: number) => number): Map<string, string[]> {
	const map = new Map<string, string[]>();

	posts.forEach((post, index) => {
		const ranked = posts
			.map((_, other) => ({ other, value: other === index ? -Infinity : score(index, other) }))
			.filter((item) => item.value > 0)
			.sort((a, b) => b.value - a.value)
			.slice(0, RELATED_COUNT)
			.map((item) => posts[item.other].id);
		map.set(post.id, ranked);
	});

	return map;
}

export function cosine(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i += 1) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

/** 共同標籤一個 1 分、同分類 2 分。 */
export function tagOverlap(a: PostLike, b: PostLike): number {
	const tags = new Set(a.data.tags);
	const shared = b.data.tags.filter((tag) => tags.has(tag)).length;
	const sameCategory = a.data.categories[0] && a.data.categories[0] === b.data.categories[0] ? 2 : 0;
	return shared + sameCategory;
}

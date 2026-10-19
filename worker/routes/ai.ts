import type { Env } from '../lib/env';
import { normalizeTag } from '../lib/frontmatter';
import { HttpError, ok, readJson } from '../lib/http';

/** 中文表現好、支援 json_schema；換模型只改這一行。 */
export const SUGGEST_MODEL = '@cf/qwen/qwen3.8-27b';

// ponytail: 只送前 6000 字，夠模型抓重點，也讓每次呼叫的 neurons 固定在小數目。
const MAX_BODY_CHARS = 6000;

interface SuggestPayload {
	title?: string;
	body?: string;
	knownTags?: string[];
}

export interface Suggestion {
	description: string;
	tags: string[];
	slug: string;
}

const SCHEMA = {
	type: 'object',
	properties: {
		description: { type: 'string' },
		tags: { type: 'array', items: { type: 'string' } },
		slug: { type: 'string' },
	},
	required: ['description', 'tags', 'slug'],
};

export async function handleSuggest(request: Request, env: Env): Promise<Response> {
	const payload = await readJson<SuggestPayload>(request);
	const title = typeof payload.title === 'string' ? payload.title.trim() : '';
	const body = typeof payload.body === 'string' ? payload.body.trim() : '';
	if (!title && !body) throw new HttpError(400, '先寫標題或內文，AI 才有東西可以看。');

	const knownTags = Array.isArray(payload.knownTags)
		? payload.knownTags.filter((tag): tag is string => typeof tag === 'string').slice(0, 200)
		: [];

	const result = await env.AI.run(SUGGEST_MODEL as keyof AiModels, {
		messages: [
			{ role: 'system', content: buildSystemPrompt(knownTags) },
			{ role: 'user', content: `標題：${title || '（未定）'}\n\n內文：\n${body.slice(0, MAX_BODY_CHARS)}` },
		],
		response_format: { type: 'json_schema', json_schema: { name: 'suggestion', schema: SCHEMA } },
		chat_template_kwargs: { enable_thinking: false },
		max_tokens: 600,
		temperature: 0.3,
	} as never);

	return ok({ suggestion: parseSuggestion(result), model: SUGGEST_MODEL });
}

function buildSystemPrompt(knownTags: string[]): string {
	return [
		'你是個人部落格的編輯助手。讀完文章後只回 JSON，欄位：',
		'- description：繁體中文，60 到 120 字，給搜尋結果和文章列表用。直接講文章內容與讀者能得到什麼，不要用「本文」「這篇文章」開頭，不要誇張行銷語氣。',
		'- tags：3 到 5 個標籤。優先沿用已有標籤；真的沒有合適的才新增。英文標籤用小寫。',
		'- slug：英文小寫、單字用連字號、3 到 6 個字，概括主題，例如 cloudflare-worker-dashboard。',
		knownTags.length ? `已有標籤：${knownTags.join('、')}` : '目前還沒有任何標籤。',
	].join('\n');
}

/**
 * 模型回傳格式依模型而異（OpenAI 相容的 choices，或舊式的 response），
 * 而且 response 可能已經被解析成物件。三種都吃，最後一律清洗過再回前端。
 */
export function parseSuggestion(result: unknown): Suggestion {
	const raw = extractContent(result);
	let data: Partial<Record<keyof Suggestion, unknown>>;

	try {
		data = typeof raw === 'string' ? JSON.parse(stripFence(raw)) : (raw as typeof data);
	} catch {
		throw new HttpError(502, 'AI 回傳的格式看不懂，再按一次試試。');
	}
	if (!data || typeof data !== 'object') throw new HttpError(502, 'AI 沒有回傳內容。');

	const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [];

	return {
		description: typeof data.description === 'string' ? data.description.trim() : '',
		tags: [...new Set(tags.map(normalizeTag).filter(Boolean))].slice(0, 5),
		slug: typeof data.slug === 'string' ? toSlug(data.slug) : '',
	};
}

function extractContent(result: unknown): unknown {
	const value = result as { choices?: Array<{ message?: { content?: unknown } }>; response?: unknown };
	return value?.choices?.[0]?.message?.content ?? value?.response ?? null;
}

function stripFence(text: string): string {
	return text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/, '');
}

/**
 * 公開的文章瀏覽計數。
 *
 * 這是整個 Worker 唯一不需要管理員 session 的 API，因為它要給每一個讀者呼叫。
 * 也因為公開，slug 是信任邊界：它會直接變成 KV 的 key，必須先驗形狀再用。
 */
import type { Env } from '../lib/env';
import { HttpError, json } from '../lib/http';

/** 只允許實際 slug 會出現的字元：英數、底線、連字號、中日韓文字。 */
const SLUG_PATTERN = /^[\w㐀-䶿一-鿿-]{1,120}$/u;

function keyFor(slug: string): string {
	if (!SLUG_PATTERN.test(slug)) throw new HttpError(400, 'slug 格式不合法。');
	return `views:${slug}`;
}

async function readCount(env: Env, key: string): Promise<number> {
	const raw = await env.VIEWS.get(key);
	const value = Number(raw);
	return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export async function handleGetViews(env: Env, slug: string): Promise<Response> {
	const count = await readCount(env, keyFor(slug));
	return json({ ok: true, slug, count });
}

/**
 * ponytail: 讀出來加一再寫回去，沒有原子遞增——KV 本來就沒有這種操作。
 * 天花板有兩個：同時進來的兩個請求會讀到同一個數字，各自寫回同一個值，
 * 於是少算一次；而 KV 免費方案每天一千次寫入，等於每天一千次瀏覽封頂。
 * 對個人部落格這兩件事都無所謂。真的需要精確或更高流量時，換成
 * Durable Object 做原子計數，這個檔案的介面不用改。
 */
export async function handleIncrementViews(env: Env, slug: string): Promise<Response> {
	const key = keyFor(slug);
	const count = (await readCount(env, key)) + 1;
	await env.VIEWS.put(key, String(count));
	return json({ ok: true, slug, count });
}

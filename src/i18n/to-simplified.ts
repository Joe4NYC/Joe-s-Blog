import * as OpenCC from 'opencc-js';

/**
 * 繁體（台灣用語）→ 簡體（大陸用語）。
 *
 * 用 `twp` 而不是 `tw`：前者帶詞彙表，會把「軟體→软件」「資料庫→数据库」
 * 「部落格→博客」一起換掉。只用 `tw` 的話是逐字轉換，會輸出「软体」「资料库」
 * 這種一眼就看得出是機器轉的結果。
 */
const convert = OpenCC.Converter({ from: 'twp', to: 'cn' });

export function toSimplifiedText(input: string): string {
	return convert(input);
}

/** 這些元素裡面的內容一律原樣保留。 */
const VERBATIM_TAGS = new Set(['pre', 'code', 'script', 'style', 'kbd', 'samp']);

/**
 * 轉換 HTML，但只動文字節點。
 *
 * 兩件事一定要跳過：
 *
 * 1. **標籤內部**（屬性）。文章 slug 含中文，例如
 *    `/blog/googlesheet當理財app後端_20260908/`。把 href 一起轉成簡體會直接 404，
 *    因為實際產生的檔案路徑用的是繁體檔名。所以標籤原封不動，只轉標籤之間的文字。
 * 2. **程式碼**（pre/code/script/style/kbd/samp）。程式碼是程式碼，不是文章；
 *    把裡面的識別字或檔名轉掉會讓引用的程式碼不再對應真實原始碼。
 */
export function toSimplifiedHtml(html: string): string {
	let out = '';
	let index = 0;
	let skipDepth = 0;
	let skipTag = '';

	const TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>|<!--[\s\S]*?-->/g;
	let match: RegExpExecArray | null;

	while ((match = TAG.exec(html)) !== null) {
		const text = html.slice(index, match.index);
		out += skipDepth > 0 ? text : convert(text);
		out += match[0];
		index = match.index + match[0].length;

		const tag = match[1]?.toLowerCase();
		if (!tag) continue; // 註解，不影響巢狀深度

		const isClosing = match[0].startsWith('</');
		const isSelfClosing = match[0].endsWith('/>');

		if (skipDepth > 0) {
			// 已經在跳過區塊裡，只追蹤同名標籤的巢狀進出。
			if (tag === skipTag && !isSelfClosing) skipDepth += isClosing ? -1 : 1;
		} else if (VERBATIM_TAGS.has(tag) && !isClosing && !isSelfClosing) {
			skipTag = tag;
			skipDepth = 1;
		}
	}

	const tail = html.slice(index);
	return out + (skipDepth > 0 ? tail : convert(tail));
}

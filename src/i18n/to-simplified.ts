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

/** 這些屬性裝的是給人看的文字，要跟著轉。其餘屬性（href、src、class…）一律不動。 */
const TEXT_ATTRIBUTES = new Set(['alt', 'aria-label', 'title', 'placeholder', 'data-text']);

// data-text 是 Typewriter 元件的原文。它的 JS 會把這個值打字進元素裡，
// 蓋掉伺服器已經轉好的內容——漏掉它的話，簡體頁的大標題會在載入後變回繁體。
// 刻意不碰 data-tag：那是標籤篩選的比對鍵，對應繁體的標籤網址，轉了會失效。

/** meta 的 content 多半是機器值，只有這幾個 key 裝的是給人看的句子。 */
const TEXT_META_KEYS = /^(title|description|og:title|og:description|twitter:title|twitter:description)$/i;

/**
 * 轉換標籤上少數裝人類文字的屬性。
 * meta description 這種東西是屬性不是文字節點，不特別處理的話簡體頁的 SEO
 * 描述會留在繁體。但 og:url、og:image 的 content 是網址，絕對不能碰。
 */
function convertTagAttributes(tag: string): string {
	const isMeta = /^<meta\b/i.test(tag);
	const metaKey = isMeta ? (/\b(?:name|property)\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '') : '';
	const metaHoldsText = isMeta && TEXT_META_KEYS.test(metaKey);

	return tag.replace(/\b([a-zA-Z-]+)\s*=\s*"([^"]*)"/g, (whole, name: string, value: string) => {
		const lower = name.toLowerCase();
		const isText = TEXT_ATTRIBUTES.has(lower) || (metaHoldsText && lower === 'content');
		return isText ? `${name}="${convert(value)}"` : whole;
	});
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
/**
 * 從原樣區塊的內容起點，找到對應閉合標籤的位置。
 *
 * 只搜尋這個標籤自己的開關，不用通用的標籤掃描——壓縮過的 JS 裡 `i<n` 這種
 * 比較運算會被當成標籤開頭，而它的 `[^>]*>` 可能一路吃掉真正的 </script>，
 * 結果整份文件剩下的部分都被當成程式碼而不轉換。
 */
function findVerbatimEnd(html: string, from: number, tagName: string): number {
	const pattern = new RegExp(`<(/?)${tagName}\\b[^>]*>`, 'gi');
	pattern.lastIndex = from;
	let depth = 1;
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(html)) !== null) {
		depth += match[1] ? -1 : 1;
		if (depth === 0) return match.index; // 停在閉合標籤之前，交給外層迴圈處理
	}

	return html.length; // 沒有閉合標籤，剩下的全部當原樣內容
}

export function toSimplifiedHtml(html: string): string {
	let out = '';
	let index = 0;

	const TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>|<!--[\s\S]*?-->/g;
	let match: RegExpExecArray | null;

	while ((match = TAG.exec(html)) !== null) {
		out += convert(html.slice(index, match.index));
		const tagName = match[1]?.toLowerCase();
		out += tagName ? convertTagAttributes(match[0]) : match[0];
		index = match.index + match[0].length;

		if (!tagName) continue;
		if (match[0].startsWith('</') || match[0].endsWith('/>')) continue;
		// data-no-convert 給的是「這段本來就該保持原樣」，例如語言切換選單裡的
		//「繁體中文」——在簡體頁上被轉成「繁体中文」的話，整個切換器就沒意義了。
		if (!VERBATIM_TAGS.has(tagName) && !/\bdata-no-convert\b/.test(match[0])) continue;

		const end = findVerbatimEnd(html, index, tagName);
		out += html.slice(index, end);
		index = end;
		TAG.lastIndex = index;
	}

	return out + convert(html.slice(index));
}

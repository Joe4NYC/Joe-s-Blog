import type { MiddlewareHandler } from 'astro';
import { toSimplifiedHtml } from './i18n/to-simplified';

/**
 * 簡體版在建置時由繁體原稿轉出來，不是另外維護一份。
 *
 * 放在 middleware 而不是各頁面裡，是因為這樣「轉換」只發生在一個地方：
 * 版面、元件、文章內容、meta 標籤全都涵蓋到，日後新增頁面也不用記得補。
 */
export const onRequest: MiddlewareHandler = async (context, next) => {
	const response = await next();

	if (!context.url.pathname.startsWith('/zh-cn/')) return response;
	if (!response.headers.get('content-type')?.includes('text/html')) return response;

	return new Response(toSimplifiedHtml(await response.text()), {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
};

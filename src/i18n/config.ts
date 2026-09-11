/**
 * 三個語言版本的定義。
 *
 * zh-tw 是原稿語言，不加網址前綴——現有的 /blog/... 網址一個都不會變，
 * 已經送進 Search Console 的收錄進度也就不受影響。
 * zh-cn 由 zh-tw 在建置時自動轉換；en 只翻介面，文章維持中文。
 */
export const DEFAULT_LOCALE = 'zh-tw' as const;

export const LOCALES = ['zh-tw', 'zh-cn', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** 語言切換選單上顯示的名稱，一律用該語言自己的寫法。 */
export const LOCALE_LABELS: Record<Locale, string> = {
	'zh-tw': '繁體中文',
	'zh-cn': '简体中文',
	en: 'English',
};

/** `<html lang>` 與 hreflang 用的 BCP-47 標籤。 */
export const LOCALE_TAGS: Record<Locale, string> = {
	'zh-tw': 'zh-Hant-TW',
	'zh-cn': 'zh-Hans-CN',
	en: 'en',
};

export function isLocale(value: unknown): value is Locale {
	return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * 路由參數 ↔ 語言的對應。預設語言在網址上不出現，所以它的參數是 undefined，
 * Astro 會把 `{ lang: undefined }` 產生成不帶前綴的路徑。
 */
export function localeParam(locale: Locale): string | undefined {
	return locale === DEFAULT_LOCALE ? undefined : locale;
}

export function localeFromParam(param: string | undefined): Locale {
	return isLocale(param) ? param : DEFAULT_LOCALE;
}

/** 把站內絕對路徑加上語言前綴；預設語言原樣返回。 */
export function localePath(path: string, locale: Locale): string {
	const normalized = path.startsWith('/') ? path : `/${path}`;
	if (locale === DEFAULT_LOCALE) return normalized;
	return `/${locale}${normalized === '/' ? '/' : normalized}`;
}

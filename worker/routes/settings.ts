import type { Env } from '../lib/env';
import { getFile, putFile, repoRef } from '../lib/github';
import { HttpError, ok, readJson } from '../lib/http';

export const SETTINGS_PATH = 'src/config/settings.json';

const SOCIAL_KEYS = ['github', 'linkedin', 'x', 'email', 'website'] as const;
const HERO_SECTIONS = ['home', 'blog', 'tags', 'about'] as const;

interface SiteSettings {
	siteUrl: string;
	siteTitle: string;
	siteTitleSuffix: string;
	siteDescription: string;
	locale: string;
	headerGithubRepoUrl: string;
	faviconIco: string;
}

interface SocialLink {
	key: (typeof SOCIAL_KEYS)[number];
	label: string;
	url: string;
}

interface ProfileSettings {
	name: string;
	title: string;
	bio: string;
	location: string;
	email: string;
	githubProfileUrl: string;
	socials: SocialLink[];
}

type HeroSettings = Record<(typeof HERO_SECTIONS)[number], { text: string; subtitle: string }>;

export interface Settings {
	site: SiteSettings;
	profile: ProfileSettings;
	hero: HeroSettings;
}

function text(input: unknown, field: string, { required = true, max = 500 } = {}): string {
	if (typeof input !== 'string') throw new HttpError(400, `${field} 必須是文字。`);

	const value = input.trim();
	if (required && !value) throw new HttpError(400, `${field} 不能留空。`);
	if (value.length > max) throw new HttpError(400, `${field} 太長了（上限 ${max} 字）。`);

	return value;
}

function url(input: unknown, field: string, { required = true } = {}): string {
	const value = text(input, field, { required, max: 300 });
	if (!value) return value;
	if (!/^https?:\/\//i.test(value)) throw new HttpError(400, `${field} 必須是 http:// 或 https:// 開頭的網址。`);

	try {
		new URL(value);
	} catch {
		throw new HttpError(400, `${field} 不是合法網址。`);
	}

	return value.replace(/\/+$/, '');
}

/**
 * Rejects anything the Astro config would choke on, so a bad save can never take
 * the public site down at the next build.
 */
export function validateSettings(input: unknown): Settings {
	if (!input || typeof input !== 'object') throw new HttpError(400, '設定格式錯誤。');

	const raw = input as Record<string, Record<string, unknown>>;
	const site = raw.site ?? {};
	const profile = raw.profile ?? {};
	const hero = raw.hero ?? {};

	const socialsInput = Array.isArray(profile.socials) ? profile.socials : [];
	const socials: SocialLink[] = socialsInput.slice(0, 10).map((entry, index) => {
		const item = (entry ?? {}) as Record<string, unknown>;
		const key = String(item.key ?? '');

		if (!(SOCIAL_KEYS as readonly string[]).includes(key)) {
			throw new HttpError(400, `第 ${index + 1} 個社群連結的類型無效，可用類型：${SOCIAL_KEYS.join('、')}`);
		}

		const isEmail = key === 'email';
		const rawUrl = String(item.url ?? '').trim();

		if (isEmail && rawUrl && !/^(mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawUrl)) {
			throw new HttpError(400, `第 ${index + 1} 個社群連結需要一個有效的 Email。`);
		}

		return {
			key: key as SocialLink['key'],
			label: text(item.label, `第 ${index + 1} 個社群連結的名稱`, { max: 40 }),
			url: isEmail ? rawUrl : url(item.url, `第 ${index + 1} 個社群連結的網址`),
		};
	});

	const heroResult = {} as HeroSettings;
	for (const section of HERO_SECTIONS) {
		const value = (hero[section] ?? {}) as Record<string, unknown>;
		heroResult[section] = {
			text: text(value.text, `${section} 頁的主標題`, { max: 80 }),
			subtitle: text(value.subtitle, `${section} 頁的副標題`, { required: false, max: 160 }),
		};
	}

	return {
		site: {
			siteUrl: url(site.siteUrl, '網站網址'),
			siteTitle: text(site.siteTitle, '網站標題', { max: 80 }),
			siteTitleSuffix: text(site.siteTitleSuffix, '標題後綴', { required: false, max: 80 }),
			siteDescription: text(site.siteDescription, '網站描述', { max: 300 }),
			locale: text(site.locale, '語言代碼', { max: 20 }),
			headerGithubRepoUrl: url(site.headerGithubRepoUrl, '頁首 GitHub 連結'),
			faviconIco: text(site.faviconIco, 'Favicon 路徑', { max: 200 }),
		},
		profile: {
			name: text(profile.name, '姓名', { max: 60 }),
			title: text(profile.title, '個人頭銜', { max: 120 }),
			bio: text(profile.bio, '自我介紹', { max: 1000 }),
			location: text(profile.location, '所在地', { required: false, max: 60 }),
			email: text(profile.email, 'Email', { required: false, max: 120 }),
			githubProfileUrl: url(profile.githubProfileUrl, 'GitHub 個人頁'),
			socials,
		},
		hero: heroResult,
	};
}

export async function handleReadSettings(env: Env): Promise<Response> {
	const file = await getFile(repoRef(env), SETTINGS_PATH);
	if (!file) throw new HttpError(404, `找不到 ${SETTINGS_PATH}`);

	return ok({ settings: JSON.parse(file.text) as Settings, sha: file.sha });
}

export async function handleWriteSettings(request: Request, env: Env): Promise<Response> {
	const ref = repoRef(env);
	const payload = await readJson<{ settings?: unknown; sha?: string }>(request);
	const settings = validateSettings(payload.settings);
	const current = await getFile(ref, SETTINGS_PATH);

	if (!current) throw new HttpError(404, `找不到 ${SETTINGS_PATH}`);
	if (payload.sha && payload.sha !== current.sha) {
		throw new HttpError(409, '網站設定在別處被改過了，請重新載入後再儲存。');
	}

	const result = await putFile(ref, SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`, 'chore: 更新網站設定', current.sha);
	return ok({ settings, sha: result.sha });
}

/**
 * Frontmatter read/write for `src/content/blog/*.md`.
 *
 * The serialized output intentionally matches `scripts/normalize-frontmatter.mjs`
 * byte for byte, so posts written from the admin keep `npm run frontmatter:check`
 * green and never show up as spurious diffs.
 */

export interface PostFrontmatter {
	title: string;
	date: string;
	updated?: string;
	description?: string;
	draft: boolean;
	categories: string[];
	tags: string[];
}

export interface ParsedPost {
	frontmatter: PostFrontmatter;
	body: string;
	eol: '\n' | '\r\n';
}

const DELIMITER = /^---[ \t]*(?:\r?\n|$)/gm;

export class FrontmatterError extends Error {}

export function splitDocument(source: string): { yaml: string; body: string; eol: '\n' | '\r\n' } {
	const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
	DELIMITER.lastIndex = 0;
	const opening = DELIMITER.exec(text);

	if (!opening || text.slice(0, opening.index).trim() !== '') {
		throw new FrontmatterError('檔案開頭缺少 --- 分隔線');
	}

	const closing = DELIMITER.exec(text);
	if (!closing) throw new FrontmatterError('缺少結尾的 --- 分隔線');

	return {
		yaml: text.slice(opening.index + opening[0].length, closing.index),
		body: text.slice(closing.index + closing[0].length).replace(/^(?:\r?\n)*/, ''),
		eol: text.includes('\r\n') ? '\r\n' : '\n',
	};
}

type YamlValue = string | boolean | string[];

/**
 * A deliberately small YAML reader: it understands the flat scalar/list shape
 * this collection allows and rejects anything else instead of guessing.
 */
function parseYaml(yaml: string): Record<string, YamlValue> {
	const result: Record<string, YamlValue> = {};
	const lines = yaml.split(/\r?\n/);
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		index += 1;

		if (!line || !line.trim() || line.trimStart().startsWith('#')) continue;

		const match = line.match(/^([^\s:][^:]*?)\s*:\s*(.*)$/);
		if (!match) continue;

		const key = unquote(match[1].trim());
		const rest = match[2].trim();

		if (rest === '' || rest === '|' || rest === '>') {
			const items: string[] = [];
			while (index < lines.length && /^\s*-\s+/.test(lines[index])) {
				items.push(unquote(lines[index].replace(/^\s*-\s+/, '').trim()));
				index += 1;
			}
			result[key] = items;
			continue;
		}

		if (rest.startsWith('[') && rest.endsWith(']')) {
			const inner = rest.slice(1, -1).trim();
			result[key] = inner === '' ? [] : splitInline(inner).map(unquote);
			continue;
		}

		if (rest === 'true' || rest === 'false') {
			result[key] = rest === 'true';
			continue;
		}

		result[key] = unquote(rest);
	}

	return result;
}

function splitInline(value: string): string[] {
	const parts: string[] = [];
	let current = '';
	let quote: string | null = null;

	for (const char of value) {
		if (quote) {
			if (char === quote) quote = null;
			current += char;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}
		if (char === ',') {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}

	if (current.trim()) parts.push(current.trim());
	return parts;
}

function unquote(value: string): string {
	const trimmed = value.trim();
	if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
		try {
			return JSON.parse(trimmed) as string;
		} catch {
			return trimmed.slice(1, -1);
		}
	}
	if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
		return trimmed.slice(1, -1).replaceAll("''", "'");
	}
	return trimmed;
}

function asList(value: YamlValue | undefined): string[] {
	if (value === undefined) return [];
	if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
	if (typeof value === 'boolean') return [];
	const text = value.trim();
	return text ? [text] : [];
}

export function parsePost(source: string): ParsedPost {
	const { yaml, body, eol } = splitDocument(source);
	const data = parseYaml(yaml);

	const title = typeof data.title === 'string' ? data.title.trim() : '';
	if (!title) throw new FrontmatterError('frontmatter 缺少 title');

	const rawDate = typeof data.date === 'string' && data.date ? data.date : (data as Record<string, YamlValue>).pubDate;
	if (typeof rawDate !== 'string' || !rawDate.trim()) throw new FrontmatterError('frontmatter 缺少 date');

	const rawUpdated = typeof data.updated === 'string' ? data.updated : undefined;
	const description = typeof data.description === 'string' && data.description.trim() ? data.description.trim() : undefined;

	return {
		frontmatter: {
			title,
			date: normalizeDate(rawDate),
			...(rawUpdated ? { updated: normalizeDate(rawUpdated) } : {}),
			...(description ? { description } : {}),
			draft: data.draft === true,
			categories: asList(data.categories),
			tags: asList(data.tags),
		},
		body,
		eol,
	};
}

/**
 * Mirrors `normalizeDate()` in scripts/normalize-frontmatter.mjs: every stored
 * date is rendered in UTC+8 with an explicit offset.
 */
export function normalizeDate(value: string): string {
	const raw = String(value).trim();
	const match = raw.match(
		/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?(?:\.\d+)?([+-]\d{2}:?\d{2}|Z)?$/,
	);

	if (!match) throw new FrontmatterError(`日期格式無效："${raw}"`);

	const [, year, month, day, hour = '0', minute = '0', second = '0', zone] = match;
	const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));

	if (Number.isNaN(utc)) throw new FrontmatterError(`日期格式無效："${raw}"`);

	let offsetMinutes = 8 * 60;
	if (zone === 'Z') offsetMinutes = 0;
	else if (zone) {
		const normalizedZone = zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
		const sign = normalizedZone.startsWith('-') ? -1 : 1;
		const [zoneHour, zoneMinute] = normalizedZone.slice(1).split(':').map(Number);
		offsetMinutes = sign * (zoneHour * 60 + zoneMinute);
	}

	const shanghai = new Date(utc - offsetMinutes * 60_000 + 8 * 60 * 60_000);
	const pad = (input: number) => String(input).padStart(2, '0');

	return (
		`${shanghai.getUTCFullYear()}-${pad(shanghai.getUTCMonth() + 1)}-${pad(shanghai.getUTCDate())}` +
		`T${pad(shanghai.getUTCHours())}:${pad(shanghai.getUTCMinutes())}:${pad(shanghai.getUTCSeconds())}+08:00`
	);
}

export function nowInShanghai(): string {
	return normalizeDate(new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
}

/**
 * Mirrors `normalizeTag()` in scripts/normalize-frontmatter.mjs.
 */
export function normalizeTag(tag: string): string {
	const lowered = tag.trim().replace(/[A-Z]/g, (character) => character.toLowerCase());
	return /^[\x00-\x7F]+$/.test(lowered) ? lowered.replace(/\s+/g, '-') : lowered.replace(/\s+/g, ' ');
}

function quote(value: string): string {
	return JSON.stringify(String(value));
}

export function serializePost(frontmatter: PostFrontmatter, body: string, eol: '\n' | '\r\n' = '\n'): string {
	const lines = ['---', `title: ${quote(frontmatter.title)}`, `date: ${quote(frontmatter.date)}`];

	if (frontmatter.updated) lines.push(`updated: ${quote(frontmatter.updated)}`);
	if (frontmatter.description) lines.push(`description: ${quote(frontmatter.description)}`);
	lines.push(`draft: ${frontmatter.draft}`);

	lines.push('categories:');
	for (const category of frontmatter.categories) lines.push(`  - ${quote(category)}`);

	lines.push('tags:');
	for (const tag of frontmatter.tags) lines.push(`  - ${quote(tag)}`);

	lines.push('---', '');

	const normalizedBody = body.replace(/\r\n/g, '\n').replace(/^\n+/, '');
	return lines.join(eol) + eol + (eol === '\r\n' ? normalizedBody.replace(/\n/g, '\r\n') : normalizedBody);
}

/**
 * Validation mirroring `blogFrontmatterSchema`, so a bad post is rejected in the
 * admin instead of breaking the next production build.
 */
export function validateFrontmatter(frontmatter: PostFrontmatter): string[] {
	const errors: string[] = [];

	if (!frontmatter.title.trim()) errors.push('標題不能是空的');
	if (frontmatter.categories.length > 1) errors.push('文章最多只能有一個分類');
	if (!frontmatter.draft && frontmatter.categories.length !== 1) errors.push('正式發佈的文章必須且只能有一個分類');
	if (!frontmatter.draft && frontmatter.tags.length === 0) errors.push('正式發佈的文章至少需要一個標籤');
	if (new Set(frontmatter.tags).size !== frontmatter.tags.length) errors.push('標籤不能重複');

	try {
		normalizeDate(frontmatter.date);
	} catch {
		errors.push('發佈日期格式無效');
	}

	return errors;
}

/**
 * Plain-text excerpt used by the post list, taken from the part above `<!-- more -->`.
 */
export function excerpt(body: string, length = 90): string {
	const visible = body.split(/<!--\s*more\s*-->/)[0] ?? body;
	const text = visible
		.replace(/^---[\s\S]*?---/, '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/[#>*`~_|-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	return text.length > length ? `${text.slice(0, length)}…` : text;
}

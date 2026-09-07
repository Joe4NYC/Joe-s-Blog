import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	excerpt,
	normalizeDate,
	normalizeTag,
	parsePost,
	serializePost,
	validateFrontmatter,
	type PostFrontmatter,
} from './frontmatter';

const CONTENT_ROOT = path.resolve(import.meta.dirname, '../../src/content/blog');

const sample: PostFrontmatter = {
	title: '交換學生第一週',
	date: '2026-09-01T09:30:00+08:00',
	updated: '2026-09-02T10:00:00+08:00',
	description: '抵達後的行政流程與住宿安排。',
	draft: false,
	categories: ['交換'],
	tags: ['exchange', '生活'],
};

describe('serializePost', () => {
	it('照 normalize-frontmatter 的欄位順序與引號規則輸出', () => {
		expect(serializePost(sample, '正文第一段。')).toBe(
			[
				'---',
				'title: "交換學生第一週"',
				'date: "2026-09-01T09:30:00+08:00"',
				'updated: "2026-09-02T10:00:00+08:00"',
				'description: "抵達後的行政流程與住宿安排。"',
				'draft: false',
				'categories:',
				'  - "交換"',
				'tags:',
				'  - "exchange"',
				'  - "生活"',
				'---',
				'',
				'正文第一段。',
			].join('\n'),
		);
	});

	it('省略沒有值的 updated 與 description', () => {
		const output = serializePost({ ...sample, updated: undefined, description: undefined }, 'body');
		expect(output).not.toContain('updated:');
		expect(output).not.toContain('description:');
		expect(output).toContain('draft: false');
	});
});

describe('parsePost', () => {
	it('讀得回自己寫出去的內容', () => {
		const body = '第一段。\n\n## 小節\n\n- 項目';
		const parsed = parsePost(serializePost(sample, body));

		expect(parsed.frontmatter).toEqual(sample);
		expect(parsed.body).toBe(body);
	});

	it('容忍未加引號、行內陣列與缺少 draft 的手寫 frontmatter', () => {
		const parsed = parsePost(
			['---', 'title: 手寫標題', 'date: 2026-01-02', 'tags: [astro, 筆記]', 'categories:', '  - 記錄', '---', '', '內文'].join(
				'\n',
			),
		);

		expect(parsed.frontmatter.title).toBe('手寫標題');
		expect(parsed.frontmatter.date).toBe('2026-01-02T00:00:00+08:00');
		expect(parsed.frontmatter.tags).toEqual(['astro', '筆記']);
		expect(parsed.frontmatter.categories).toEqual(['記錄']);
		expect(parsed.frontmatter.draft).toBe(false);
	});

	it('缺少分隔線或必填欄位時丟出錯誤', () => {
		expect(() => parsePost('沒有 frontmatter')).toThrow();
		expect(() => parsePost('---\ntitle: "x"\n---\n\nbody')).toThrow();
	});
});

describe('normalizeDate', () => {
	it('把各種輸入統一成 UTC+8 並帶上位移', () => {
		expect(normalizeDate('2026-07-14T20:00:00+08:00')).toBe('2026-07-14T20:00:00+08:00');
		expect(normalizeDate('2026-07-14T12:00:00Z')).toBe('2026-07-14T20:00:00+08:00');
		expect(normalizeDate('2026-07-14')).toBe('2026-07-14T00:00:00+08:00');
		expect(normalizeDate('2026-07-14T08:00:00-04:00')).toBe('2026-07-14T20:00:00+08:00');
	});

	it('拒絕無法解析的日期', () => {
		expect(() => normalizeDate('去年夏天')).toThrow();
	});
});

describe('normalizeTag', () => {
	it('英文轉小寫並用連字號取代空白，中文只收斂空白', () => {
		expect(normalizeTag('Astro Blog')).toBe('astro-blog');
		expect(normalizeTag('交換  學生')).toBe('交換 學生');
	});
});

describe('validateFrontmatter', () => {
	it('接受合法的正式文章', () => {
		expect(validateFrontmatter(sample)).toEqual([]);
	});

	it('擋下會讓建置失敗的組合', () => {
		expect(validateFrontmatter({ ...sample, categories: [] })).toContain('正式發佈的文章必須且只能有一個分類');
		expect(validateFrontmatter({ ...sample, tags: [] })).toContain('正式發佈的文章至少需要一個標籤');
		expect(validateFrontmatter({ ...sample, tags: ['a', 'a'] })).toContain('標籤不能重複');
		expect(validateFrontmatter({ ...sample, categories: ['a', 'b'] })).toContain('文章最多只能有一個分類');
	});

	it('草稿可以先不填分類與標籤', () => {
		expect(validateFrontmatter({ ...sample, draft: true, categories: [], tags: [] })).toEqual([]);
	});
});

describe('excerpt', () => {
	it('只取 <!-- more --> 以上的純文字', () => {
		expect(excerpt('前言**重點**\n\n<!-- more -->\n\n後面不要')).toBe('前言 重點');
	});
});

describe('與現有文章的相容性', () => {
	it('解析再序列化不會改動 repo 內已正規化的文章', async () => {
		const files = (await readdir(CONTENT_ROOT)).filter((name) => /\.(md|mdx)$/i.test(name));
		expect(files.length).toBeGreaterThan(0);

		for (const name of files) {
			const source = await readFile(path.join(CONTENT_ROOT, name), 'utf8');
			const parsed = parsePost(source);
			expect(serializePost(parsed.frontmatter, parsed.body, parsed.eol), name).toBe(source);
		}
	});
});

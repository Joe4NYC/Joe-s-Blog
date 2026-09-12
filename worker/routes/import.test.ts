import { describe, expect, it } from 'vitest';
import type { Env } from '../lib/env';
import { HttpError } from '../lib/http';
import { handleImportMarkdown } from './import';

const env = {} as Env;

function upload(source: string, filename?: string) {
	return handleImportMarkdown(
		new Request('https://example.test/api/admin/import', {
			method: 'POST',
			body: JSON.stringify({ source, filename }),
		}),
		env,
	);
}

/** handler 走的是「拋 HttpError，由路由統一轉成回應」的慣例。 */
async function statusOf(promise: Promise<Response>): Promise<number> {
	try {
		await promise;
		return 200;
	} catch (error) {
		if (error instanceof HttpError) return error.status;
		throw error;
	}
}

async function body(response: Response) {
	return (await response.json()) as {
		post: Record<string, unknown>;
		filename?: string;
		warnings: string[];
	};
}

const WELL_FORMED = `---
title: "匯入測試"
date: "2026-09-12T10:00:00+08:00"
description: "一段描述"
draft: false
categories:
  - "開發"
tags:
  - "Astro"
  - "Side Project"
  - "astro"
---

第一段內文。

\`\`\`js
if (a < b) run();
\`\`\`
`;

describe('handleImportMarkdown', () => {
	it('把 frontmatter 與內文拆出來', async () => {
		const data = await body(await upload(WELL_FORMED, '匯入測試_20260912.md'));

		expect(data.post.title).toBe('匯入測試');
		expect(data.post.description).toBe('一段描述');
		expect(data.post.categories).toEqual(['開發']);
		expect(data.post.body).toContain('第一段內文。');
		// 內文裡的程式碼圍籬不能被當成 frontmatter 的一部分吃掉
		expect(data.post.body).toContain('if (a < b) run();');
	});

	it('標籤照 normalizeTag 轉小寫、空白轉連字號並去重', async () => {
		const data = await body(await upload(WELL_FORMED));
		expect(data.post.tags).toEqual(['astro', 'side-project']);
	});

	it('即使檔案寫 draft:false 也一律當草稿匯入', async () => {
		// 匯入只填表單，不該讓使用者一按儲存就直接把文章發佈出去。
		const data = await body(await upload(WELL_FORMED));
		expect(data.post.draft).toBe(true);
	});

	it('沿用上傳的檔名，並剝掉路徑', async () => {
		expect((await body(await upload(WELL_FORMED, 'notes/我的文章_20260912.md'))).filename).toBe(
			'我的文章_20260912.md',
		);
		// 沒有副檔名時補上 .md
		expect((await body(await upload(WELL_FORMED, '我的文章'))).filename).toBe('我的文章.md');
		expect((await body(await upload(WELL_FORMED))).filename).toBeUndefined();
	});

	it('沒有 frontmatter 時仍匯入內文並給出提示', async () => {
		const data = await body(await upload('# 只有內文\n\n沒有 frontmatter。', 'plain.md'));

		expect(data.post.title).toBe('');
		expect(data.post.body).toContain('只有內文');
		expect(data.warnings.join()).toContain('沒有 frontmatter');
	});

	it('有分隔線但欄位壞掉時回 400，不會靜默匯入半套', async () => {
		const broken = '---\ndescription: "缺了 title 和 date"\n---\n\n內文\n';
		await expect(statusOf(upload(broken, 'broken.md'))).resolves.toBe(400);
	});

	it('缺少分類或標籤會回報，但仍然匯入', async () => {
		const bare = '---\ntitle: "只有標題"\ndate: "2026-09-12T10:00:00+08:00"\n---\n\n內文\n';
		const data = await body(await upload(bare, 'bare.md'));

		expect(data.post.title).toBe('只有標題');
		expect(data.warnings.join()).toContain('沒有分類');
		expect(data.warnings.join()).toContain('沒有標籤');
	});

	it('超過上限的檔案回 413', async () => {
		const huge = `---\ntitle: "大"\ndate: "2026-09-12T10:00:00+08:00"\n---\n\n${'字'.repeat(200_000)}`;
		await expect(statusOf(upload(huge, 'huge.md'))).resolves.toBe(413);
	});

	it('空內容回 400', async () => {
		await expect(statusOf(upload('   ', 'empty.md'))).resolves.toBe(400);
	});
});

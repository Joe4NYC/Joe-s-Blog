/**
 * 把上傳的 Markdown 檔解析成後台編輯器的欄位。
 *
 * 這裡刻意重用 `parsePost()` 而不是在前端另寫一份 YAML 解析：那份解析器與
 * `scripts/normalize-frontmatter.mjs` 是逐位元組相容的，所以「匯入後看到的
 * 欄位」跟「存檔後寫進 repo 的內容」保證一致。
 */
import type { Env } from '../lib/env';
import { FrontmatterError, normalizeTag, parsePost, splitDocument } from '../lib/frontmatter';
import { HttpError, ok, readJson } from '../lib/http';

/** 單篇文章的合理上限；再大多半是誤選了檔案。 */
const MAX_SOURCE_BYTES = 512 * 1024;

interface ImportPayload {
	source?: string;
	filename?: string;
}

/**
 * 沿用上傳檔案的檔名，而不是讓伺服器從標題重新產生。
 * buildFilename() 會把標題截到 60 字，對長標題會產生又長又難讀的網址；
 * 使用者自己取的檔名通常才是他想要的網址。
 */
function suggestFilename(raw: string | undefined): string | undefined {
	if (!raw) return undefined;

	// 瀏覽器有時會給完整路徑，只取最後一段。
	const base = raw.split(/[\\/]/).pop()?.trim();
	if (!base) return undefined;

	const cleaned = base
		.replace(/\.\.+/g, '.')
		.replace(/[\\/:*?"<>|]/g, '')
		.replace(/^[-.\s]+|[\s]+$/g, '');

	if (!cleaned) return undefined;
	return /\.(md|mdx)$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
}

export async function handleImportMarkdown(request: Request, env: Env): Promise<Response> {
	void env;
	const payload = await readJson<ImportPayload>(request);
	const source = payload.source;

	if (typeof source !== 'string' || !source.trim()) {
		throw new HttpError(400, '請提供 Markdown 檔案的內容。');
	}
	if (new TextEncoder().encode(source).length > MAX_SOURCE_BYTES) {
		throw new HttpError(413, `檔案太大了（上限 ${Math.round(MAX_SOURCE_BYTES / 1024)} KB）。`);
	}

	const warnings: string[] = [];
	let parsed;

	try {
		parsed = parsePost(source);
	} catch (error) {
		if (!(error instanceof FrontmatterError)) throw error;

		// 沒有 frontmatter 的純 Markdown 仍然值得匯入：把整份當內文，
		// 其餘欄位留空讓使用者自己補，比直接退回一個錯誤有用。
		let hasDelimiters = true;
		try {
			splitDocument(source);
		} catch {
			hasDelimiters = false;
		}

		if (hasDelimiters) throw new HttpError(400, `frontmatter 解析失敗：${error.message}`);

		warnings.push('檔案沒有 frontmatter，只匯入了內文，其餘欄位請自行填寫。');
		return ok({
			post: {
				title: '',
				date: undefined,
				description: '',
				draft: true,
				categories: [],
				tags: [],
				body: source.replace(/^﻿/, ''),
			},
			filename: suggestFilename(payload.filename),
			warnings,
		});
	}

	const { frontmatter, body } = parsed;
	const categories = frontmatter.categories.map((item) => item.trim()).filter(Boolean);
	const tags = [...new Set(frontmatter.tags.map(normalizeTag).filter(Boolean))];

	if (categories.length > 1) warnings.push('檔案有多個分類，只能保留一個，請自行刪掉多餘的。');
	if (categories.length === 0) warnings.push('檔案沒有分類，正式發佈前必須補一個。');
	if (tags.length === 0) warnings.push('檔案沒有標籤，正式發佈前至少要補一個。');
	if (!frontmatter.description) warnings.push('檔案沒有 description，留空會自動從內文擷取。');

	return ok({
		post: {
			title: frontmatter.title,
			date: frontmatter.date,
			description: frontmatter.description ?? '',
			// 匯入只填表單，不會寫進 repo；一律先當草稿，避免一按儲存就直接發佈。
			draft: true,
			categories,
			tags,
			body,
		},
		filename: suggestFilename(payload.filename),
		warnings,
	});
}

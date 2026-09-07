import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../public/admin/markdown.js';

describe('後台預覽的 Markdown 轉換', () => {
	it('轉出常用的區塊語法', () => {
		const html = renderMarkdown(
			['## 申請流程', '', '重點是 **提早準備**，還有 `GPA`。', '', '- 校內甄選', '- 語言證明', '', '> 別拖到最後一週。'].join('\n'),
		);

		expect(html).toContain('<h2>申請流程</h2>');
		expect(html).toContain('<strong>提早準備</strong>');
		expect(html).toContain('<code>GPA</code>');
		expect(html).toContain('<ul><li>校內甄選</li>');
		expect(html).toContain('<blockquote>');
	});

	it('轉出表格', () => {
		const html = renderMarkdown(['| 欄位 A | 欄位 B |', '| --- | --- |', '| 內容 | 內容 |'].join('\n'));

		expect(html).toContain('<th>欄位 A</th>');
		expect(html).toContain('<td>內容</td>');
	});

	it('把 Hexo 風格的相對圖片路徑補成絕對路徑', () => {
		expect(renderMarkdown('![圖](image/trip/a.webp)')).toContain('src="/image/trip/a.webp"');
		expect(renderMarkdown('![圖](/image/trip/a.webp)')).toContain('src="/image/trip/a.webp"');
	});

	it('跳脫 HTML，不讓文章內容注入標記', () => {
		expect(renderMarkdown('<img src=x onerror=alert(1)>')).not.toContain('<img src=x');
		expect(renderMarkdown('<script>bad()</script>')).toContain('&lt;script&gt;');
	});

	it('行內程式碼裡的星號不會被當成強調語法', () => {
		expect(renderMarkdown('`a * b * c`')).toContain('<code>a * b * c</code>');
	});

	// 曾經的當機來源：少了分隔列的表格會讓解析器停在原地。
	it('遇到不完整的表格語法仍會結束', () => {
		const started = Date.now();
		const html = renderMarkdown(['| 欄位 A | 欄位 B |', '| 內容 | 內容 |'].join('\n'));

		expect(Date.now() - started).toBeLessThan(1000);
		expect(html).toContain('欄位 A');
	});

	it('空輸入不會爆掉', () => {
		expect(renderMarkdown('')).toBe('');
		expect(renderMarkdown(undefined)).toBe('');
	});
});

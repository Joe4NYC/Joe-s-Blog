import { describe, expect, it } from 'vitest';
import { toSimplifiedHtml, toSimplifiedText } from './to-simplified';

describe('toSimplifiedText', () => {
	it('轉換詞彙而不只是字元', () => {
		// 只做字元轉換的話這裡會變成「软体／资料库／部落格」。
		expect(toSimplifiedText('軟體、資料庫、部落格、伺服器')).toBe('软件、数据库、博客、服务器');
	});
});

describe('toSimplifiedHtml', () => {
	it('轉換文字但不動屬性裡的網址', () => {
		// 文章 slug 是繁體檔名，href 被轉掉就會 404。
		const html = '<a href="/blog/當理財app後端_20260908/">資料庫文章</a>';
		expect(toSimplifiedHtml(html)).toBe('<a href="/blog/當理財app後端_20260908/">数据库文章</a>');
	});

	it('不動 code 與 pre 的內容', () => {
		expect(toSimplifiedHtml('<p>資料庫</p><code>資料庫</code>')).toBe(
			'<p>数据库</p><code>資料庫</code>',
		);
		expect(toSimplifiedHtml('<pre><span>軟體</span></pre>')).toBe('<pre><span>軟體</span></pre>');
	});

	it('巢狀的同名標籤不會提早結束跳過區塊', () => {
		const html = '<pre><pre>軟體</pre>程式碼</pre><p>軟體</p>';
		expect(toSimplifiedHtml(html)).toBe('<pre><pre>軟體</pre>程式碼</pre><p>软件</p>');
	});

	it('跳過區塊結束後恢復轉換', () => {
		expect(toSimplifiedHtml('<code>軟體</code><p>軟體</p>')).toBe(
			'<code>軟體</code><p>软件</p>',
		);
	});

	it('處理註解與自閉合標籤而不打亂狀態', () => {
		expect(toSimplifiedHtml('<!-- 軟體 --><img src="軟體.png" /><p>軟體</p>')).toBe(
			'<!-- 軟體 --><img src="軟體.png" /><p>软件</p>',
		);
	});

	it('標籤之外的前後文字也會轉換', () => {
		expect(toSimplifiedHtml('軟體<p>資料庫</p>網路')).toBe('软件<p>数据库</p>网络');
	});
});

import { describe, expect, it } from 'vitest';
import { localeFromPath, localePath, stripLocale } from './config';
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

describe('語言前綴的路徑處理', () => {
	it('從路徑判斷語言', () => {
		expect(localeFromPath('/')).toBe('zh-tw');
		expect(localeFromPath('/blog/foo/')).toBe('zh-tw');
		expect(localeFromPath('/zh-cn/blog/foo/')).toBe('zh-cn');
		expect(localeFromPath('/en/')).toBe('en');
		// slug 剛好叫 en 開頭的文章不能被誤判成語言前綴
		expect(localeFromPath('/blog/english筆記_20260101/')).toBe('zh-tw');
	});

	it('剝掉語言前綴後三個語言得到同一條路徑', () => {
		expect(stripLocale('/blog/foo/')).toBe('/blog/foo/');
		expect(stripLocale('/zh-cn/blog/foo/')).toBe('/blog/foo/');
		expect(stripLocale('/en/blog/foo/')).toBe('/blog/foo/');
		expect(stripLocale('/en/')).toBe('/');
	});

	it('localePath 與 stripLocale 互為反向', () => {
		for (const loc of ['zh-tw', 'zh-cn', 'en'] as const) {
			expect(stripLocale(localePath('/blog/foo/', loc))).toBe('/blog/foo/');
		}
	});
});

describe('屬性轉換', () => {
	it('轉換裝人類文字的屬性', () => {
		expect(toSimplifiedHtml('<img alt="軟體截圖" src="/軟體.png" />')).toBe(
			'<img alt="软件截屏" src="/軟體.png" />',
		);
		expect(toSimplifiedHtml('<button aria-label="關閉軟體">x</button>')).toBe(
			'<button aria-label="关闭软件">x</button>',
		);
	});

	it('轉換 meta description 但不碰網址類 content', () => {
		expect(toSimplifiedHtml('<meta name="description" content="我的部落格" />')).toBe(
			'<meta name="description" content="我的博客" />',
		);
		// og:url 的 content 是網址，轉了就指向不存在的頁面
		expect(toSimplifiedHtml('<meta property="og:url" content="https://x/當理財_2026/" />')).toBe(
			'<meta property="og:url" content="https://x/當理財_2026/" />',
		);
	});

	it('href 與 class 永遠不轉', () => {
		const html = '<a href="/blog/軟體_2026/" class="軟體">軟體</a>';
		expect(toSimplifiedHtml(html)).toBe('<a href="/blog/軟體_2026/" class="軟體">软件</a>');
	});
});

describe('原樣區塊的邊界', () => {
	it('壓縮 JS 裡的 < 比較不會吃掉 </script>', () => {
		// 這是真的發生過的 bug：script 沒被正確關閉，整份文件後半段都停止轉換。
		const html = '<script>for(let i=0;i<n;i++){a(i)}</script><p>軟體</p>';
		expect(toSimplifiedHtml(html)).toBe('<script>for(let i=0;i<n;i++){a(i)}</script><p>软件</p>');
	});

	it('script 內含箭頭函式也能正確關閉', () => {
		const html = '<script>x.map(o=>o.t<5)</script><p>資料庫</p>';
		expect(toSimplifiedHtml(html)).toBe('<script>x.map(o=>o.t<5)</script><p>数据库</p>');
	});

	it('沒有閉合標籤時剩下的全部當原樣內容', () => {
		expect(toSimplifiedHtml('<p>軟體</p><script>a<b')).toBe('<p>软件</p><script>a<b');
	});
});

describe('data-no-convert', () => {
	it('標記的元素內容保持原樣', () => {
		// 語言切換選單上的「繁體中文」在簡體頁也必須是繁體，否則切換器沒意義。
		expect(toSimplifiedHtml('<a data-no-convert>繁體中文</a><p>軟體</p>')).toBe(
			'<a data-no-convert>繁體中文</a><p>软件</p>',
		);
	});
});

describe('JS 會讀回去渲染的屬性', () => {
	it('轉換 data-text，否則 Typewriter 會把繁體打字回畫面上', () => {
		expect(toSimplifiedHtml('<h1 class="typewriter" data-text="寫一個外掛">x</h1>')).toBe(
			'<h1 class="typewriter" data-text="写一个插件">x</h1>',
		);
	});

	it('不轉 data-tag：那是對應繁體標籤網址的比對鍵', () => {
		expect(toSimplifiedHtml('<button data-tag="外掛開發">外掛開發</button>')).toBe(
			'<button data-tag="外掛開發">插件开发</button>',
		);
	});
});

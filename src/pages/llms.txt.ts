import { getBlogPosts } from '../lib/content/blog';
import { profileConfig, siteDescription, siteTitle, siteUrl } from '../config';
import { buildSameAsLinks } from '../lib/profile/social';

export const prerender = true;

/**
 * `/llms.txt`：給 AI 系統的一份純文字導覽。
 *
 * Google 的 AI optimization guide 明說這個檔案對 Google 搜尋沒有作用，不會
 * 幫助也不會傷害排名，所以別把它當成 Google 的槓桿。留著是因為其他 AI 系統
 * 可能會讀，而且它是從文章集合產生的，不需要另外維護。
 */
function absolute(path: string): string {
	return new URL(path, siteUrl).toString();
}

export async function GET() {
	const posts = (await getBlogPosts()).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);

	const lines = [
		`# ${siteTitle}`,
		`> ${siteDescription}`,
		'',
		`作者：${profileConfig.name}（${profileConfig.title}）`,
		...buildSameAsLinks(profileConfig).map((url) => `- ${url}`),
		'',
		'## 文章',
	];

	for (const post of posts) {
		const date = post.data.pubDate.toISOString().slice(0, 10);
		const summary = (post.data.description ?? '').replace(/\s+/g, ' ').trim();
		lines.push(`- [${post.data.title}](${absolute(`/blog/${post.id}/`)})（${date}）${summary ? `：${summary}` : ''}`);
	}

	lines.push(
		'',
		'## 其他',
		`- [關於作者](${absolute('/about/')})`,
		`- [標籤索引](${absolute('/tags/')})`,
		`- [RSS](${absolute('/rss.xml')})`,
		'',
		'## 說明',
		'- 內容以繁體中文撰寫，簡體版在同一路徑加上 /zh-cn/ 前綴。',
		'- 全站為靜態輸出，不需要執行 JavaScript 即可取得完整內容。',
		'',
	);

	return new Response(lines.join('\n'), {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}

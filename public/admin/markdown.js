/**
 * 後台預覽用的輕量 Markdown 轉換器。
 *
 * 只求「寫的時候看得出結構」，正式渲染仍由 Astro 的 remark/rehype 管線負責，
 * 所以這裡刻意不處理 KaTeX、Mermaid 與自訂外掛語法。
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const CODE_TOKEN = '@@ULBOCODE';

function escapeHtml(text) {
	return String(text).replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

function inline(text) {
	let html = escapeHtml(text);

	// 先把行內程式碼抽走，避免其中的 * 或 _ 被當成強調語法。
	const codes = [];
	html = html.replace(/`([^`]+)`/g, (_match, code) => {
		codes.push(code);
		return CODE_TOKEN + (codes.length - 1) + '@@';
	});

	html = html
		.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_match, alt, src) => {
			// 與 remark-hexo-images 一致：相對的 image/ 路徑補上開頭斜線。
			const url = src.startsWith('image/') ? '/' + src : src;
			return `<img src="${url}" alt="${alt}" loading="lazy" />`;
		})
		.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
		.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
		.replace(/~~([^~]+)~~/g, '<del>$1</del>');

	return html.replace(
		new RegExp(CODE_TOKEN + '(\\d+)@@', 'g'),
		(_match, index) => `<code>${escapeHtml(codes[Number(index)])}</code>`,
	);
}

function tableRow(line) {
	return line
		.trim()
		.replace(/^\||\|$/g, '')
		.split('|')
		.map((cell) => cell.trim());
}

export function renderMarkdown(source) {
	const lines = String(source ?? '')
		.replace(/\r\n/g, '\n')
		.split('\n');
	const out = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];

		if (/^```/.test(line)) {
			const language = line.slice(3).trim();
			const buffer = [];
			index += 1;
			while (index < lines.length && !/^```/.test(lines[index])) {
				buffer.push(lines[index]);
				index += 1;
			}
			index += 1;
			out.push(`<pre><code data-lang="${escapeHtml(language)}">${escapeHtml(buffer.join('\n'))}</code></pre>`);
			continue;
		}

		if (/^<!--\s*more\s*-->/.test(line.trim())) {
			out.push('<hr /><p class="muted" style="font-size:12px">↑ 以上是列表頁的摘要範圍</p>');
			index += 1;
			continue;
		}

		if (!line.trim()) {
			index += 1;
			continue;
		}

		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			const level = heading[1].length;
			out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
			index += 1;
			continue;
		}

		if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			out.push('<hr />');
			index += 1;
			continue;
		}

		if (/^\s*>/.test(line)) {
			const buffer = [];
			while (index < lines.length && /^\s*>/.test(lines[index])) {
				buffer.push(lines[index].replace(/^\s*>\s?/, ''));
				index += 1;
			}
			out.push(`<blockquote>${renderMarkdown(buffer.join('\n'))}</blockquote>`);
			continue;
		}

		if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[index + 1] ?? '')) {
			const header = tableRow(line);
			index += 2;
			const body = [];
			while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
				body.push(tableRow(lines[index]));
				index += 1;
			}
			out.push(
				`<table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>` +
					body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('') +
					'</tbody></table>',
			);
			continue;
		}

		const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+/);
		if (listMatch) {
			const ordered = /\d/.test(listMatch[1]);
			const items = [];
			while (index < lines.length && lines[index].match(/^\s*([-*+]|\d+\.)\s+/)) {
				const text = lines[index].replace(/^\s*([-*+]|\d+\.)\s+/, '');
				const checkbox = text.match(/^\[([ xX])\]\s+(.*)$/);
				items.push(
					checkbox
						? `<li><input type="checkbox" disabled ${checkbox[1] === ' ' ? '' : 'checked'} /> ${inline(checkbox[2])}</li>`
						: `<li>${inline(text)}</li>`,
				);
				index += 1;
			}
			out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
			continue;
		}

		const paragraph = [];
		while (
			index < lines.length &&
			lines[index].trim() &&
			!/^(#{1,6}\s|```|\s*>|\s*([-*+]|\d+\.)\s)/.test(lines[index]) &&
			!/^\s*\|.*\|\s*$/.test(lines[index])
		) {
			paragraph.push(lines[index]);
			index += 1;
		}

		// 沒收到任何一行代表這行既不是段落也不符合前面所有規則（例如少了分隔列的表格）。
		// 這時要硬吃一行再往前走，否則整個 while 會卡在原地無窮迴圈。
		if (paragraph.length === 0) {
			paragraph.push(lines[index]);
			index += 1;
		}

		out.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br />')}</p>`);
	}

	return out.join('\n');
}

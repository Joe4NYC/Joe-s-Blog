import { describe, expect, it } from 'vitest';
import {
	createSearchBlockId,
	createSearchResultHref,
	createSearchSnippet,
	mergeSearchRanges,
	normalizeSearchText,
} from './text';

describe('search text domain helpers', () => {
	it('normalizes unicode and whitespace consistently', () => {
		expect(normalizeSearchText('  Ａstro\n\t全文  ')).toBe('Astro 全文');
	});

	it('merges overlapping and adjacent ranges', () => {
		expect(mergeSearchRanges([[8, 10], [1, 2], [3, 4], [9, 12]])).toEqual([[1, 4], [8, 12]]);
	});

	it('creates a bounded snippet with adjusted highlight ranges', () => {
		const text = '前'.repeat(100) + '數學公式' + '後'.repeat(150);
		const snippet = createSearchSnippet(text, [[100, 103]], 80);
		expect(snippet.text.length).toBeLessThanOrEqual(82);
		expect(snippet.text.slice(snippet.ranges[0]?.[0], (snippet.ranges[0]?.[1] ?? -1) + 1)).toBe('數學公式');
	});

	it('keeps stable IDs and distinguishes duplicate blocks', () => {
		expect(createSearchBlockId('paragraph:相同內容', 0)).toBe(createSearchBlockId('paragraph:相同內容', 0));
		expect(createSearchBlockId('paragraph:相同內容', 1)).not.toBe(createSearchBlockId('paragraph:相同內容', 0));
	});

	it('encodes search targets exactly once', () => {
		const href = createSearchResultHref('/blog/中文文章/', '數學公式', {
			blockId: 'search-demo',
			text: '數學公式',
		});
		expect(href).toContain('search=%E6%95%B8%E5%AD%B8%E5%85%AC%E5%BC%8F');
		expect(href).not.toContain('%25E6');
		expect(new URL(href, 'https://example.com').searchParams.get('match')).toBe('數學公式');
	});
});

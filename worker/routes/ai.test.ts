import { describe, expect, it } from 'vitest';
import { parseSuggestion, toSlug } from './ai';

describe('parseSuggestion', () => {
	const expected = { description: '摘要', tags: ['cloudflare', 'workers ai'], slug: 'cf-ai-blog' };

	it('reads OpenAI-style choices with a fenced JSON string', () => {
		const content = '```json\n{"description":" 摘要 ","tags":["Cloudflare","Workers AI","cloudflare"],"slug":"CF AI Blog!"}\n```';
		expect(parseSuggestion({ choices: [{ message: { content } }] })).toEqual({
			...expected,
			tags: ['cloudflare', 'workers-ai'],
		});
	});

	it('reads legacy response that is already an object', () => {
		expect(parseSuggestion({ response: { description: '摘要', tags: ['工具'], slug: 'a-b' } })).toEqual({
			description: '摘要',
			tags: ['工具'],
			slug: 'a-b',
		});
	});

	it('rejects unreadable output', () => {
		expect(() => parseSuggestion({ response: 'not json' })).toThrow();
	});
});

describe('toSlug', () => {
	it('keeps only lowercase ascii words joined by hyphens', () => {
		expect(toSlug('  Hello, 世界 World__2026 ')).toBe('hello-world-2026');
	});
});

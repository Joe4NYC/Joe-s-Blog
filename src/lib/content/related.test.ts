import { describe, expect, it } from 'vitest';
import { cosine, rankBy, tagOverlap } from './related';

const post = (id: string, tags: string[], category = 'dev') => ({
	id,
	data: { title: id, tags, categories: [category] },
});

describe('related posts', () => {
	it('cosine handles identical, orthogonal and zero vectors', () => {
		expect(cosine([1, 2], [2, 4])).toBeCloseTo(1);
		expect(cosine([1, 0], [0, 1])).toBe(0);
		expect(cosine([0, 0], [1, 1])).toBe(0);
	});

	it('ranks by tag overlap, skips self and unrelated posts', () => {
		const posts = [
			post('a', ['cloudflare', 'ai']),
			post('b', ['cloudflare', 'ai', 'worker']),
			post('c', ['cloudflare']),
			post('d', ['finance'], 'life'),
		];
		const map = rankBy(posts, (x, y) => tagOverlap(posts[x], posts[y]));

		expect(map.get('a')).toEqual(['b', 'c']);
		expect(map.get('d')).toEqual([]);
	});

	it('caps the list at three', () => {
		const posts = ['a', 'b', 'c', 'd', 'e'].map((id) => post(id, ['x']));
		expect(rankBy(posts, () => 1).get('a')).toHaveLength(3);
	});
});

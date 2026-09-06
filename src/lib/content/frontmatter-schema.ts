import { z } from 'astro/zod';

const nonEmptyText = z.string().trim().min(1, '不能是空字串');

export const blogFrontmatterSchema = z
	.object({
		title: nonEmptyText,
		date: z.coerce.date(),
		updated: z.coerce.date().optional(),
		description: nonEmptyText.optional(),
		draft: z.boolean().optional().default(false),
		categories: z.array(nonEmptyText),
		tags: z.array(nonEmptyText),
	})
	.strict()
	.superRefine((data, context) => {
		if (data.categories.length > 1) {
			context.addIssue({
				code: 'custom',
				path: ['categories'],
				message: '文章最多只能有一個分類',
			});
		}

		if (!data.draft && data.categories.length !== 1) {
			context.addIssue({
				code: 'custom',
				path: ['categories'],
				message: '正式文章必須且只能有一個分類',
			});
		}

		if (!data.draft && data.tags.length === 0) {
			context.addIssue({
				code: 'custom',
				path: ['tags'],
				message: '正式文章至少需要一個標籤',
			});
		}

		if (new Set(data.tags).size !== data.tags.length) {
			context.addIssue({
				code: 'custom',
				path: ['tags'],
				message: '標籤不能重複',
			});
		}
	})
	.transform((data) => ({
		...data,
		pubDate: data.date,
		updatedDate: data.updated,
	}));

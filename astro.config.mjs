// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkBlockquoteLineBreaks from './src/plugins/remark-blockquote-line-breaks.mjs';
import remarkHexoImages from './src/plugins/remark-hexo-images.mjs';
import remarkSearchBlocks from './src/plugins/remark-search-blocks';
import remarkMath from 'remark-math';
import rehypeImageCaptions from './src/plugins/rehype-image-captions.mjs';
import rehypeKatex from 'rehype-katex';
import rehypeLazyImages from './src/plugins/rehype-lazy-images.mjs';
import rehypeResponsiveTables from './src/plugins/rehype-responsive-tables.mjs';
import { siteUrl } from './src/config/site';

/** @returns {import('vite').Plugin} */
function patchKatexFontDisplayPlugin() {
	return {
		name: 'patch-katex-font-display',
		apply: 'build',
		/** @param {import('rollup').NormalizedOutputOptions} _options @param {Record<string, import('rollup').OutputAsset | import('rollup').OutputChunk>} bundle */
		generateBundle(_options, bundle) {
			let foundKatexCss = false;
			let replacedOccurrences = 0;

			for (const [fileName, output] of Object.entries(bundle)) {
				if (output.type !== 'asset' || !fileName.endsWith('.css')) continue;

				const css =
					typeof output.source === 'string'
						? output.source
						: new TextDecoder().decode(output.source);

				if (!css.includes('font-family:KaTeX_Main')) continue;
				foundKatexCss = true;

				const matches = css.match(/font-display:block/g);
				if (!matches) continue;

				replacedOccurrences += matches.length;
				output.source = css.replaceAll('font-display:block', 'font-display:swap');
			}

			if (foundKatexCss && replacedOccurrences === 0) {
				this.warn(
					'[patch-katex-font-display] Found KaTeX CSS, but no `font-display:block` was replaced. KaTeX upstream CSS format may have changed.',
				);
			}
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: siteUrl,
	integrations: [
		mdx(),
		sitemap({
			filter: (page) => {
				// 先剝掉語言前綴再比對，否則 /zh-cn/tags/ 之類會繞過下面的規則。
				const pathname = new URL(page).pathname.replace(/^\/(?:zh-cn|en)(?=\/)/, '');
				if (pathname === '/tags/' || pathname.startsWith('/tags/')) return false;
				if (/^\/blog\/page\/\d+\/?$/.test(pathname)) return false;
				return true;
			},
		}),
	],
	prefetch: {
		prefetchAll: true,
		defaultStrategy: 'hover',
	},
	markdown: {
		// 支援 Hexo 相對圖片路徑 image/xxx/ 自動轉換為 /image/xxx/
		remarkPlugins: [remarkHexoImages, remarkMath, remarkBlockquoteLineBreaks, remarkSearchBlocks],
		// 使用 KaTeX 渲染數學公式，圖片懶載入
		rehypePlugins: [rehypeKatex, rehypeLazyImages, rehypeImageCaptions, rehypeResponsiveTables],
		// 使用雙主題支援程式碼高亮
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
			wrap: true,
		},
	},
	vite: {
		plugins: [patchKatexFontDisplayPlugin()],
	},
});


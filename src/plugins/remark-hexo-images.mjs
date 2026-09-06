// Remark 外掛：自動將 Hexo 相對圖片路徑轉換為 Astro 絕對路徑
// 支援 image/xxx/ 和 /image/xxx/ 兩種格式

import { visit } from 'unist-util-visit';

export function remarkHexoImages() {
    return (tree) => {
        visit(tree, 'image', (node) => {
            // 如果圖片路徑以 image/ 開頭（不是 /image/），則新增前導斜槓
            if (node.url && node.url.startsWith('image/') && !node.url.startsWith('/image/')) {
                node.url = '/' + node.url;
            }
        });
    };
}

export default remarkHexoImages;

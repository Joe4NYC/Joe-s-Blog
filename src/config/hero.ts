import defaultBackground from '../assets/blog-placeholder-1.webp';

/**
 * Hero copy and background settings for one page.
 */
export interface HeroSectionConfig {
  /**
   * Main hero headline text.
   */
  text: string;
  /**
   * Optional hero subtitle text.
   */
  subtitle?: string;
  /**
   * Hero background image URL.
   */
  backgroundImage: string;
}

/**
 * Centralized hero configuration for all top-level pages and post fallback.
 */
export interface HeroConfig {
  home: HeroSectionConfig;
  blog: HeroSectionConfig;
  tags: HeroSectionConfig;
  about: HeroSectionConfig;
  /**
   * Default hero image shared by all article pages.
   */
  postDefaultBackground: string;
}

export const heroConfig: HeroConfig = {
  home: {
    text: "Joe's Blog",
    subtitle: '寫下想法、筆記與正在做的事。',
    backgroundImage: defaultBackground.src,
  },
  blog: {
    text: '所有文章',
    subtitle: '瀏覽全部的寫作紀錄。',
    backgroundImage: defaultBackground.src,
  },
  tags: {
    text: '標籤',
    subtitle: '依分類與標籤瀏覽主題。',
    backgroundImage: defaultBackground.src,
  },
  about: {
    text: '關於我',
    subtitle: '簡單介紹我自己與我在做的事。',
    backgroundImage: defaultBackground.src,
  },
  postDefaultBackground: defaultBackground.src,
};

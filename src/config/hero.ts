import defaultBackground from '../assets/blog-placeholder-1.webp';
import settings from './settings.json';

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

/**
 * 文案來自 `src/config/settings.json`（後台可編輯），背景圖仍由建置期的資源匯入決定。
 */
function section(copy: { text: string; subtitle?: string }): HeroSectionConfig {
  return {
    text: copy.text,
    subtitle: copy.subtitle,
    backgroundImage: defaultBackground.src,
  };
}

export const heroConfig: HeroConfig = {
  home: section(settings.hero.home),
  blog: section(settings.hero.blog),
  tags: section(settings.hero.tags),
  about: section(settings.hero.about),
  postDefaultBackground: defaultBackground.src,
};

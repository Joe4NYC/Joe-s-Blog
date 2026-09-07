import settings from './settings.json';

/**
 * Site-level settings shared by header, SEO tags, and feed generation.
 *
 * 可編輯的欄位集中放在 `src/config/settings.json`，後台（/admin）直接讀寫該檔案，
 * 這裡只負責型別與具名匯出，避免後台需要解析 TypeScript。
 */
export interface SiteConfig {
  /**
   * Canonical production URL of this site.
   */
  siteUrl: string;
  /**
   * Global site title used in header and metadata.
   */
  siteTitle: string;
  /**
   * Optional suffix appended to browser/SEO page titles.
   */
  siteTitleSuffix: string;
  /**
   * Default site description used by index and RSS metadata.
   */
  siteDescription: string;
  /**
   * BCP-47 locale tag (for example: zh-CN, en-US).
   */
  locale: string;
  /**
   * Repository URL shown in the header action area.
   */
  headerGithubRepoUrl: string;
  /**
   * Global favicon ico path served from the public directory.
   */
  faviconIco: string;
}

export const siteConfig: SiteConfig = settings.site;

export const { siteUrl, siteTitle, siteTitleSuffix, siteDescription, locale, headerGithubRepoUrl, faviconIco } = siteConfig;

import type { ImageMetadata } from 'astro';
import avatarImage from '../assets/avatar.jpg';

/**
 * Allowed social entry keys in profile configuration.
 */
export type ProfileSocialKey = 'github' | 'linkedin' | 'x' | 'email' | 'website';

/**
 * One social link item rendered on `/about`.
 */
export interface ProfileSocialLink {
  key: ProfileSocialKey;
  label: string;
  url: string;
}

/**
 * Personal profile settings used by About page and article author schema.
 */
export interface ProfileConfig {
  /**
   * Optional avatar URL for About page and structured data.
   */
  avatar?: string | ImageMetadata;
  /**
   * Display name used across the site.
   */
  name: string;
  /**
   * Short headline/title shown on About page.
   */
  title: string;
  /**
   * Short bio text shown on About page and in schema.
   */
  bio: string;
  /**
   * Optional location text.
   */
  location?: string;
  /**
   * Optional contact email.
   */
  email?: string;
  /**
   * Personal GitHub profile URL (separate from repo URL).
   */
  githubProfileUrl: string;
  /**
   * Social links displayed in About page social row.
   */
  socials: ProfileSocialLink[];
}

export const profileConfig: ProfileConfig = {
  avatar: avatarImage,
  name: 'Joe NG',
  title: '企業資訊系統學生 · PHP / MySQL / WordPress',
  bio: '香港理工大學企業資訊系統系在讀。日常用 PHP、MySQL 與 WordPress 開發，做過伺服器與資料庫搬遷、自製外掛，也寫過小型網頁應用。這裡放開發筆記與踩過的坑。',
  location: '香港',
  email: 'yikchunjoe@gmail.com',
  githubProfileUrl: 'https://github.com/Joe4NYC',
  socials: [
    { key: 'github', label: 'GitHub', url: 'https://github.com/Joe4NYC' },
    { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/JoeNG80160' },
    { key: 'email', label: 'Email', url: 'yikchunjoe@gmail.com' },
  ],
};

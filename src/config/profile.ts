import type { ImageMetadata } from 'astro';
import avatarImage from '../assets/avatar.jpg';
import settings from './settings.json';

/**
 * Allowed social entry keys in profile configuration.
 */
export type ProfileSocialKey = 'github' | 'linkedin' | 'x' | 'email' | 'website';

const SOCIAL_KEYS: readonly ProfileSocialKey[] = ['github', 'linkedin', 'x', 'email', 'website'];

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

function isSocialKey(value: string): value is ProfileSocialKey {
  return (SOCIAL_KEYS as readonly string[]).includes(value);
}

/**
 * 僅保留主題支援的社群 key，避免後台寫入未知值時整頁渲染失敗。
 */
function toSocialLinks(entries: ReadonlyArray<{ key: string; label: string; url: string }>): ProfileSocialLink[] {
  const links: ProfileSocialLink[] = [];

  for (const entry of entries) {
    if (!isSocialKey(entry.key) || !entry.url.trim()) continue;
    links.push({ key: entry.key, label: entry.label, url: entry.url });
  }

  return links;
}

export const profileConfig: ProfileConfig = {
  avatar: avatarImage,
  name: settings.profile.name,
  title: settings.profile.title,
  bio: settings.profile.bio,
  location: settings.profile.location,
  email: settings.profile.email,
  githubProfileUrl: settings.profile.githubProfileUrl,
  socials: toSocialLinks(settings.profile.socials),
};

/**
 * Bindings available to the admin Worker.
 *
 * 機密值（ADMIN_PASSWORD / SESSION_SECRET / GITHUB_TOKEN）必須用
 * `npx wrangler secret put <NAME>` 設定，不要寫進 wrangler.jsonc。
 */
export interface Env {
	/** Static assets produced by `astro build`. */
	ASSETS: Fetcher;
	/** Login name shown in the admin UI. */
	ADMIN_USERNAME: string;
	/** Login password (secret). */
	ADMIN_PASSWORD: string;
	/** HMAC key used to sign session cookies (secret). */
	SESSION_SECRET: string;
	/** Fine-grained PAT with Contents + Actions write access (secret). */
	GITHUB_TOKEN: string;
	GITHUB_OWNER: string;
	GITHUB_REPO: string;
	GITHUB_BRANCH: string;
	/** Workflow file name used for manual redeploys. */
	DEPLOY_WORKFLOW: string;
	/** Session lifetime in hours. */
	SESSION_TTL_HOURS: string;
}

export class ConfigError extends Error {}

/**
 * Fails fast with a readable message when a required binding is missing,
 * so the admin UI can tell the operator exactly which secret to set.
 */
export function requireEnv(env: Env, key: keyof Env): string {
	const value = env[key];
	if (typeof value !== 'string' || value.trim() === '') {
		throw new ConfigError(`缺少設定：${String(key)}。請執行 npx wrangler secret put ${String(key)} 或在 wrangler.jsonc 的 vars 補上。`);
	}
	return value;
}

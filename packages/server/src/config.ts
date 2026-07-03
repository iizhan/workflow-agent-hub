import { resolve } from 'path'
import { getWebUiPath } from './utils/webui-home'

export function getListenHost(env: Record<string, string | undefined> = process.env): string {
  const host = env.BIND_HOST?.trim()
  return host || '0.0.0.0'
}

export const config = {
  port: parseInt(process.env.PORT || '8648', 10),
  // Default to IPv4 for stable WSL/Windows browser access. Use BIND_HOST=:: explicitly for IPv6.
  host: getListenHost(),
  uploadDir: process.env.UPLOAD_DIR || getWebUiPath('upload'),
  dataDir: resolve(__dirname, '..', 'data'),
  corsOrigins: process.env.CORS_ORIGINS || '*',
  /** Session store: 'local' (self-built SQLite) or 'remote' (Hermes CLI) */
  sessionStore: (process.env.SESSION_STORE || 'local') as 'local' | 'remote',
}

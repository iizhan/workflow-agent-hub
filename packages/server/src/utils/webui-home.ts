import { homedir } from 'os'
import { isAbsolute, join, resolve } from 'path'

function normalizeConfiguredHome(value?: string | null): string | null {
  const text = String(value || '').trim()
  if (!text) return null
  return isAbsolute(text) ? text : resolve(text)
}

export function getConfiguredWebUiHome(env: Record<string, string | undefined> = process.env): string | null {
  return normalizeConfiguredHome(env.HERMES_WEBUI_HOME || env.WEBUI_HOME)
}

export function hasConfiguredWebUiHome(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(getConfiguredWebUiHome(env))
}

export function getWebUiHome(env: Record<string, string | undefined> = process.env): string {
  return getConfiguredWebUiHome(env) || resolve(homedir(), '.hermes-web-ui')
}

export function getWebUiPath(...segments: string[]): string {
  return join(getWebUiHome(), ...segments)
}

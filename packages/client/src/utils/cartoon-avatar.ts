export type CartoonAvatarKind = 'agent' | 'user' | 'system'

type AgentPalette = {
  bg: string
  shell: string
  shellShade: string
  visor: string
  accent: string
  glow: string
  text: string
}

type UserPalette = {
  bg: string
  face: string
  hair: string
  shirt: string
  accent: string
  text: string
}

const AGENT_PALETTES: AgentPalette[] = [
  {
    bg: '#e8f4ff',
    shell: '#67a7ff',
    shellShade: '#4b89e8',
    visor: '#17355f',
    accent: '#ffb84d',
    glow: '#7de2ff',
    text: '#17355f',
  },
  {
    bg: '#f4ecff',
    shell: '#9f7aea',
    shellShade: '#7c5acb',
    visor: '#2d1f5e',
    accent: '#ff9b71',
    glow: '#ffd0f0',
    text: '#2d1f5e',
  },
  {
    bg: '#e9fbf3',
    shell: '#4ec99a',
    shellShade: '#34a67d',
    visor: '#0f4d3b',
    accent: '#ffcf56',
    glow: '#8cf1ce',
    text: '#0f4d3b',
  },
  {
    bg: '#fff2e8',
    shell: '#ff8f6b',
    shellShade: '#ec6f49',
    visor: '#6f2f21',
    accent: '#ffd166',
    glow: '#ffe5a8',
    text: '#6f2f21',
  },
  {
    bg: '#eff2ff',
    shell: '#6d83f2',
    shellShade: '#5469d6',
    visor: '#202b73',
    accent: '#6ee7f2',
    glow: '#b4f6ff',
    text: '#202b73',
  },
]

const USER_PALETTES: UserPalette[] = [
  {
    bg: '#f7efe8',
    face: '#ffd9bd',
    hair: '#40312f',
    shirt: '#5b8def',
    accent: '#ff9f68',
    text: '#40312f',
  },
  {
    bg: '#eef6ff',
    face: '#ffd6b5',
    hair: '#2c3f58',
    shirt: '#5ec7b0',
    accent: '#8b5cf6',
    text: '#2c3f58',
  },
  {
    bg: '#f8f0ff',
    face: '#ffdcc6',
    hair: '#5b425f',
    shirt: '#ff8f6b',
    accent: '#6d83f2',
    text: '#5b425f',
  },
]

export function isImageAvatarSource(value?: string): boolean {
  return !!value && /^(https?:\/\/|data:image\/|\/)/i.test(value.trim())
}

function hashSeed(seed: string): number {
  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pick<T>(items: T[], hash: number, offset = 0): T {
  return items[(hash + offset) % items.length]
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildBadgeLabel(seed: string, label?: string): string {
  const source = (label || seed).trim()
  if (!source) return 'AI'
  const compact = source.replace(/\s+/g, '')
  const latin = compact.replace(/[^A-Za-z0-9]/g, '')
  if (latin.length >= 2) return latin.slice(0, 2).toUpperCase()
  const chars = Array.from(compact)
  return chars.slice(0, Math.min(2, chars.length)).join('').toUpperCase()
}

function buildAgentAvatarSvg(seed: string, label?: string, kind: CartoonAvatarKind = 'agent'): string {
  const hash = hashSeed(`${kind}:${seed}`)
  const palette = pick(AGENT_PALETTES, hash)
  const badge = buildBadgeLabel(seed, label)
  const eyeVariant = hash % 3
  const antennaOffset = (hash % 7) - 3
  const mouthY = 57 + (hash % 3)
  const blushOpacity = kind === 'system' ? 0 : 0.85
  const badgeTextSize = badge.length > 1 ? 10 : 12
  const haloOpacity = kind === 'system' ? 0.32 : 0.18

  const eyeMarkup =
    eyeVariant === 0
      ? `
        <circle cx="40" cy="45" r="4" fill="${palette.glow}" />
        <circle cx="56" cy="45" r="4" fill="${palette.glow}" />
      `
      : eyeVariant === 1
        ? `
          <rect x="35" y="41" width="9" height="8" rx="4" fill="${palette.glow}" />
          <rect x="52" y="41" width="9" height="8" rx="4" fill="${palette.glow}" />
        `
        : `
          <path d="M35 46c2-4 7-4 9 0" stroke="${palette.glow}" stroke-width="3.2" stroke-linecap="round" fill="none" />
          <path d="M52 46c2-4 7-4 9 0" stroke="${palette.glow}" stroke-width="3.2" stroke-linecap="round" fill="none" />
        `

  const antennaMarkup =
    hash % 2 === 0
      ? `
        <path d="M48 20v-7" stroke="${palette.shellShade}" stroke-width="4" stroke-linecap="round" />
        <circle cx="${48 + antennaOffset}" cy="11" r="5" fill="${palette.accent}" />
      `
      : `
        <path d="M44 21c1-7 7-10 12-12" stroke="${palette.shellShade}" stroke-width="4" stroke-linecap="round" fill="none" />
        <circle cx="${58 + antennaOffset}" cy="9" r="5" fill="${palette.accent}" />
      `

  const systemLines = kind === 'system'
    ? `
      <path d="M31 68h34" stroke="${palette.text}" stroke-width="4" stroke-linecap="round" opacity="0.2" />
      <path d="M28 73h40" stroke="${palette.text}" stroke-width="4" stroke-linecap="round" opacity="0.14" />
    `
    : ''

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${escapeXml(label || seed)}">
      <defs>
        <linearGradient id="bg-${hash}" x1="12" y1="10" x2="84" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${palette.bg}" />
          <stop offset="1" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="url(#bg-${hash})" />
      <circle cx="48" cy="48" r="39" fill="${palette.shell}" opacity="${haloOpacity}" />
      ${antennaMarkup}
      <rect x="22" y="24" width="52" height="42" rx="16" fill="${palette.shell}" />
      <rect x="24" y="26" width="48" height="18" rx="14" fill="#ffffff" opacity="0.16" />
      <circle cx="18" cy="45" r="6" fill="${palette.shellShade}" />
      <circle cx="78" cy="45" r="6" fill="${palette.shellShade}" />
      <rect x="30" y="36" width="36" height="18" rx="9" fill="${palette.visor}" />
      ${eyeMarkup}
      <circle cx="35" cy="58" r="3.5" fill="${palette.accent}" opacity="${blushOpacity}" />
      <circle cx="61" cy="58" r="3.5" fill="${palette.accent}" opacity="${blushOpacity}" />
      <path d="M41 ${mouthY}c2.2 2.6 11.8 2.6 14 0" stroke="${palette.text}" stroke-width="3" stroke-linecap="round" fill="none" />
      <rect x="37" y="67" width="22" height="6" rx="3" fill="${palette.shellShade}" opacity="0.75" />
      ${systemLines}
      <circle cx="70" cy="72" r="12" fill="#ffffff" stroke="${palette.accent}" stroke-width="3" />
      <text x="70" y="76" text-anchor="middle" font-size="${badgeTextSize}" font-weight="800" font-family="Arial, sans-serif" fill="${palette.text}">${escapeXml(badge)}</text>
    </svg>
  `.trim()
}

function buildUserAvatarSvg(seed: string, label?: string): string {
  const hash = hashSeed(`user:${seed}`)
  const palette = pick(USER_PALETTES, hash)
  const badge = buildBadgeLabel(seed, label)
  const hairVariant = hash % 3
  const fringe =
    hairVariant === 0
      ? 'M28 40c5-12 17-18 28-16 8 1 15 7 18 16-6-3-13-5-22-5s-17 2-24 5Z'
      : hairVariant === 1
        ? 'M27 42c2-13 15-21 28-21 11 0 20 6 24 17-5-2-12-4-22-4-11 0-20 3-30 8Z'
        : 'M26 41c5-15 18-21 30-19 9 1 16 8 18 18-8-4-16-5-24-5-9 0-17 2-24 6Z'

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="${escapeXml(label || seed)}">
      <defs>
        <linearGradient id="user-bg-${hash}" x1="16" y1="10" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="${palette.bg}" />
          <stop offset="1" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="url(#user-bg-${hash})" />
      <circle cx="48" cy="48" r="40" fill="#ffffff" opacity="0.32" />
      <path d="M24 82c4-14 14-22 24-22s20 8 24 22" fill="${palette.shirt}" />
      <circle cx="48" cy="44" r="20" fill="${palette.face}" />
      <path d="${fringe}" fill="${palette.hair}" />
      <circle cx="41" cy="44" r="2.3" fill="${palette.text}" />
      <circle cx="55" cy="44" r="2.3" fill="${palette.text}" />
      <path d="M42 53c2.5 2.2 9.5 2.2 12 0" stroke="${palette.text}" stroke-width="2.8" stroke-linecap="round" fill="none" />
      <circle cx="33" cy="55" r="2.8" fill="${palette.accent}" opacity="0.6" />
      <circle cx="63" cy="55" r="2.8" fill="${palette.accent}" opacity="0.6" />
      <circle cx="70" cy="72" r="12" fill="#ffffff" stroke="${palette.accent}" stroke-width="3" />
      <text x="70" y="76" text-anchor="middle" font-size="${badge.length > 1 ? 10 : 12}" font-weight="800" font-family="Arial, sans-serif" fill="${palette.text}">${escapeXml(badge)}</text>
    </svg>
  `.trim()
}

export function buildCartoonAvatarSvg(
  seed: string,
  options: { kind?: CartoonAvatarKind; label?: string } = {},
): string {
  const kind = options.kind || 'agent'
  if (kind === 'user') {
    return buildUserAvatarSvg(seed, options.label)
  }
  return buildAgentAvatarSvg(seed, options.label, kind)
}

import {
  ACTIVE_USER_SCOPE_ID,
  getRuntimeMemoryConfig,
  resolveMemoryActorContext,
  upsertMemoryEntry,
  type MemoryActorContext,
  type UpsertMemoryEntryInput,
} from './memory-store'

const MAX_NAME_LENGTH = 20
const CONCISE_PATTERNS = [
  /(?:请|以后|之后|麻烦|希望)?(?:回复|回答|表达)?(?:尽量)?(?:简洁|简短|精炼|精简)(?:一点|一些)?/u,
  /\b(?:be|stay|keep)\s+(?:more\s+)?(?:concise|brief)\b/i,
  /\b(?:short|brief|concise)\s+answers?\b/i,
]
const CONCLUSION_FIRST_PATTERNS = [
  /(?:请|希望|最好)?(?:先|直接)(?:给|说)?(?:结论|重点|答案)/u,
  /开门见山/u,
  /\b(?:start|lead)\s+with\s+(?:the\s+)?(?:answer|conclusion|bottom line)\b/i,
  /\bjust\s+give\s+me\s+(?:the\s+)?(?:answer|conclusion|bottom line)\b/i,
]
const NO_EMOJI_PATTERNS = [
  /(?:不要|别|不需要|不用).{0,4}(?:表情|emoji|颜文字)/iu,
  /\bno\s+emoji\b/i,
  /\b(?:do not|don't)\s+use\s+emoji\b/i,
]
const ROOM_SCOPE_PATTERNS = [
  /(这个房间|本房间|这个群|本群|群里|这个项目|本项目|这个团队|我们团队|团队里|所有人|大家)/u,
]
const ROOM_POLICY_PATTERNS = [
  /(统一|默认|约定|规范|规则|都按|都用|一律|后续|以后|今后)/u,
]
const AGENT_SELF_NOTE_BLOCK_PATTERN = /\[\[SELF_NOTE\]\]([\s\S]*?)\[\[\/SELF_NOTE\]\]/giu
const AGENT_SELF_NOTE_INLINE_PATTERN = /\[\[SELF_NOTE:\s*([\s\S]*?)\]\]/giu
const AGENT_SELF_NOTE_LINE_PATTERN = /(?:^|\n)【自我备忘】\s*(.+?)(?=\n|$)/gu

function pushEntry(
  map: Map<string, UpsertMemoryEntryInput>,
  entry: UpsertMemoryEntryInput,
): void {
  if (!entry.content.trim()) return
  map.set(entry.section, entry)
}

function sanitizePreferredName(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, '')
    .replace(/[,.!?;:，。！？；：]+$/g, '')
    .trim()

  if (!cleaned || cleaned.length > MAX_NAME_LENGTH) return null
  if (!/^[\p{Script=Han}A-Za-z0-9_.\-\s]+$/u.test(cleaned)) return null
  return cleaned
}

function extractPreferredName(input: string): string | null {
  const patterns = [
    /(?:你可以|以后|之后)?(?:直接)?(?:叫我|称呼我|喊我)\s*[`"'“”‘’]?([\p{Script=Han}A-Za-z0-9_.\-\s]{1,20})/u,
    /\b(?:call|address)\s+me\s+([A-Za-z][A-Za-z0-9_.-]{0,19})\b/i,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match?.[1]) {
      const preferredName = sanitizePreferredName(match[1])
      if (preferredName) return preferredName
    }
  }

  return null
}

function hasAnyPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(input))
}

function hasRoomSharedMemoryCue(input: string): boolean {
  return hasAnyPattern(input, ROOM_SCOPE_PATTERNS) && hasAnyPattern(input, ROOM_POLICY_PATTERNS)
}

function normalizeAgentSelfNote(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function buildAgentSelfNoteSection(note: string): string {
  const normalized = normalizeAgentSelfNote(note).toLowerCase()
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `agent.self_note.${Math.abs(hash >>> 0).toString(36)}`
}

function cleanupVisibleContent(input: string): string {
  return input
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

export function extractMemoryEntriesFromUserInput(input: string): UpsertMemoryEntryInput[] {
  const normalized = input.trim()
  if (!normalized) return []

  const entries = new Map<string, UpsertMemoryEntryInput>()

  if (hasAnyPattern(normalized, CONCISE_PATTERNS)) {
    pushEntry(entries, {
      section: 'user.preference.response_style.concise',
      scopeType: 'user',
      scopeId: ACTIVE_USER_SCOPE_ID,
      userId: ACTIVE_USER_SCOPE_ID,
      memoryType: 'preference',
      title: 'Concise response preference',
      content: '用户偏好回复简洁，优先使用精炼表达。',
      tags: ['user', 'preference', 'response_style', 'concise'],
      confidence: 95,
      priority: 88,
      salience: 86,
      sourceType: 'auto_extract',
      sourceRef: 'chat.user_message',
    })
  }

  if (hasAnyPattern(normalized, CONCLUSION_FIRST_PATTERNS)) {
    pushEntry(entries, {
      section: 'user.preference.answer_structure.conclusion_first',
      scopeType: 'user',
      scopeId: ACTIVE_USER_SCOPE_ID,
      userId: ACTIVE_USER_SCOPE_ID,
      memoryType: 'preference',
      title: 'Conclusion-first preference',
      content: '用户偏好先给结论或重点，再补充必要细节。',
      tags: ['user', 'preference', 'answer_structure', 'conclusion_first'],
      confidence: 95,
      priority: 90,
      salience: 88,
      sourceType: 'auto_extract',
      sourceRef: 'chat.user_message',
    })
  }

  if (hasAnyPattern(normalized, NO_EMOJI_PATTERNS)) {
    pushEntry(entries, {
      section: 'user.preference.format.no_emoji',
      scopeType: 'user',
      scopeId: ACTIVE_USER_SCOPE_ID,
      userId: ACTIVE_USER_SCOPE_ID,
      memoryType: 'preference',
      title: 'No emoji preference',
      content: '用户不希望回复中使用表情符号。',
      tags: ['user', 'preference', 'format', 'no_emoji'],
      confidence: 98,
      priority: 92,
      salience: 90,
      sourceType: 'auto_extract',
      sourceRef: 'chat.user_message',
    })
  }

  const preferredName = extractPreferredName(normalized)
  if (preferredName) {
    pushEntry(entries, {
      section: 'user.identity.preferred_name',
      scopeType: 'user',
      scopeId: ACTIVE_USER_SCOPE_ID,
      userId: ACTIVE_USER_SCOPE_ID,
      memoryType: 'fact',
      title: 'Preferred form of address',
      content: `用户希望被称呼为“${preferredName}”。`,
      tags: ['user', 'identity', 'preferred_name'],
      confidence: 98,
      priority: 94,
      salience: 92,
      sourceType: 'auto_extract',
      sourceRef: 'chat.user_message',
    })
  }

  return Array.from(entries.values())
}

export function extractRoomMemoryEntriesFromMessage(input: string, roomId: string): UpsertMemoryEntryInput[] {
  const normalized = input.trim()
  if (!normalized || !roomId.trim() || !hasRoomSharedMemoryCue(normalized)) return []

  const entries = new Map<string, UpsertMemoryEntryInput>()

  if (hasAnyPattern(normalized, CONCISE_PATTERNS)) {
    pushEntry(entries, {
      section: 'room.shared.response_style.concise',
      scopeType: 'room',
      scopeId: roomId,
      roomId,
      memoryType: 'policy',
      title: 'Room concise response convention',
      content: '这个房间约定回复简洁，优先使用精炼表达。',
      tags: ['room', 'shared', 'policy', 'response_style', 'concise'],
      confidence: 96,
      priority: 86,
      salience: 84,
      sourceType: 'auto_extract',
      sourceRef: 'group_chat.user_message',
    })
  }

  if (hasAnyPattern(normalized, CONCLUSION_FIRST_PATTERNS)) {
    pushEntry(entries, {
      section: 'room.shared.answer_structure.conclusion_first',
      scopeType: 'room',
      scopeId: roomId,
      roomId,
      memoryType: 'policy',
      title: 'Room conclusion-first convention',
      content: '这个房间约定先给结论或重点，再补充必要细节。',
      tags: ['room', 'shared', 'policy', 'answer_structure', 'conclusion_first'],
      confidence: 96,
      priority: 88,
      salience: 86,
      sourceType: 'auto_extract',
      sourceRef: 'group_chat.user_message',
    })
  }

  if (hasAnyPattern(normalized, NO_EMOJI_PATTERNS)) {
    pushEntry(entries, {
      section: 'room.shared.format.no_emoji',
      scopeType: 'room',
      scopeId: roomId,
      roomId,
      memoryType: 'policy',
      title: 'Room no-emoji convention',
      content: '这个房间约定回复中不使用表情符号。',
      tags: ['room', 'shared', 'policy', 'format', 'no_emoji'],
      confidence: 98,
      priority: 90,
      salience: 88,
      sourceType: 'auto_extract',
      sourceRef: 'group_chat.user_message',
    })
  }

  return Array.from(entries.values())
}

export function extractAgentSelfMemoryPayload(
  input: string,
  agentId: string,
): { visibleContent: string; entries: UpsertMemoryEntryInput[] } {
  const normalizedAgentId = agentId.trim()
  if (!normalizedAgentId) {
    return { visibleContent: input.trim(), entries: [] }
  }

  const extractedNotes: string[] = []
  let visibleContent = input

  const collectMatches = (pattern: RegExp) => {
    visibleContent = visibleContent.replace(pattern, (_raw, captured: string) => {
      const note = normalizeAgentSelfNote(String(captured || ''))
      if (note) extractedNotes.push(note)
      return ''
    })
  }

  collectMatches(AGENT_SELF_NOTE_BLOCK_PATTERN)
  collectMatches(AGENT_SELF_NOTE_INLINE_PATTERN)
  collectMatches(AGENT_SELF_NOTE_LINE_PATTERN)

  const uniqueNotes = Array.from(new Set(extractedNotes)).slice(0, 3)
  const entries = uniqueNotes.map<UpsertMemoryEntryInput>((note) => ({
    section: buildAgentSelfNoteSection(note),
    scopeType: 'agent',
    scopeId: normalizedAgentId,
    agentId: normalizedAgentId,
    memoryType: 'procedure',
    title: 'Agent self note',
    content: note,
    tags: ['agent', 'self_note', 'procedure'],
    confidence: 96,
    priority: 84,
    salience: 82,
    sourceType: 'auto_extract',
    sourceRef: 'agent.output',
  }))

  return {
    visibleContent: cleanupVisibleContent(visibleContent),
    entries,
  }
}

export async function rememberUserMessageMemories(
  input: string,
  contextInput?: string | MemoryActorContext,
): Promise<number> {
  const context = resolveMemoryActorContext(contextInput)
  const runtimeConfig = await getRuntimeMemoryConfig(context.profileName)
  if (!runtimeConfig.memory_enabled || !runtimeConfig.user_profile_enabled) {
    return 0
  }

  const scopedUserId = context.userId || ACTIVE_USER_SCOPE_ID
  const entries = extractMemoryEntriesFromUserInput(input)
  for (const entry of entries) {
    await upsertMemoryEntry({
      ...entry,
      scopeId: scopedUserId,
      userId: scopedUserId,
    }, context.profileName)
  }
  return entries.length
}

export async function rememberRoomMessageMemories(
  input: string,
  contextInput?: string | MemoryActorContext,
): Promise<number> {
  const context = resolveMemoryActorContext(contextInput)
  const runtimeConfig = await getRuntimeMemoryConfig(context.profileName)
  if (!runtimeConfig.memory_enabled || !context.roomId) {
    return 0
  }

  const entries = extractRoomMemoryEntriesFromMessage(input, context.roomId)
  for (const entry of entries) {
    await upsertMemoryEntry({
      ...entry,
      roomId: context.roomId,
      userId: context.userId,
    }, context.profileName)
  }
  return entries.length
}

export async function rememberAgentResponseMemories(
  input: string,
  contextInput?: string | MemoryActorContext,
): Promise<{ visibleContent: string; saved: number }> {
  const context = resolveMemoryActorContext(contextInput)
  const runtimeConfig = await getRuntimeMemoryConfig(context.profileName)
  if (!runtimeConfig.memory_enabled || !context.agentId) {
    return {
      visibleContent: cleanupVisibleContent(input),
      saved: 0,
    }
  }

  const payload = extractAgentSelfMemoryPayload(input, context.agentId)
  for (const entry of payload.entries) {
    await upsertMemoryEntry({
      ...entry,
      roomId: context.roomId,
    }, context.profileName)
  }

  return {
    visibleContent: payload.visibleContent,
    saved: payload.entries.length,
  }
}

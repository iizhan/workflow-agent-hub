import { mkdir, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, join } from 'path'
import YAML from 'js-yaml'
import { getDb, jsonGet, jsonGetAll, jsonSet } from '../../db'
import {
  MEMORY_ENTRIES_TABLE,
} from '../../db/hermes/schemas'
import { safeReadFile, safeStat } from '../config-helpers'
import { getActiveProfileName, getProfileDir } from './hermes-profile'

export type MemorySection = 'memory' | 'user' | 'soul'
export type MemoryScopeType = 'system' | 'profile' | 'user' | 'room' | 'agent'
export type MemoryType = 'fact' | 'preference' | 'episodic' | 'procedure' | 'relationship' | 'policy'
export const ACTIVE_USER_SCOPE_ID = '__active_user__'
export const SYSTEM_AGENT_SCOPE_ID = '__system_agent__'

export interface MemoryActorContext {
  profileName?: string
  sessionId?: string
  userId?: string
  roomId?: string
  agentId?: string
}

export interface MemoryPolicyConfig {
  fact_ttl_days: number
  preference_ttl_days: number
  episodic_ttl_days: number
  procedure_ttl_days: number
  relationship_ttl_days: number
  policy_ttl_days: number
  search_limit: number
  allow_fuzzy_recall: boolean
  allow_multi_hop: boolean
}

export interface RuntimeMemoryConfig {
  memory_enabled: boolean
  user_profile_enabled: boolean
  memory_char_limit: number
  user_char_limit: number
}

export interface MemoryData {
  memory: string
  user: string
  soul: string
  memory_mtime: number | null
  user_mtime: number | null
  soul_mtime: number | null
}

interface SectionStoreRow {
  content: string
  updated_at: number
}

export interface MemoryEntryRecord {
  id: string
  profile: string
  section: string
  scope_type: MemoryScopeType | string
  scope_id: string
  user_id: string
  room_id: string
  agent_id: string
  memory_type: MemoryType | string
  title: string
  content: string
  tags_json: string
  status: string
  confidence: number
  priority: number
  salience: number
  source_type: string
  source_ref: string
  created_at: number
  updated_at: number
  last_accessed_at: number | null
  expires_at: number | null
  archived_at: number | null
}

export interface MemoryEntrySummary extends Omit<MemoryEntryRecord, 'tags_json'> {
  tags: string[]
}

export interface MemoryEntryQuery {
  section?: string
  scopeType?: string
  scopeId?: string
  memoryType?: string
  status?: string
  q?: string
  limit?: number
}

export interface UpsertMemoryEntryInput {
  section: string
  scopeType: MemoryScopeType
  scopeId: string
  userId?: string
  roomId?: string
  agentId?: string
  memoryType: MemoryType
  title: string
  content: string
  tags?: string[]
  status?: string
  confidence?: number
  priority?: number
  salience?: number
  sourceType?: string
  sourceRef?: string
  expiresAt?: number | null
}

interface SectionDescriptor {
  section: MemorySection
  scopeType: MemoryScopeType
  scopeId: string
  userId: string
  roomId: string
  agentId: string
  memoryType: MemoryType
  title: string
}

const DEFAULT_MEMORY_POLICY: MemoryPolicyConfig = {
  fact_ttl_days: 180,
  preference_ttl_days: 90,
  episodic_ttl_days: 14,
  procedure_ttl_days: 30,
  relationship_ttl_days: 180,
  policy_ttl_days: 0,
  search_limit: 12,
  allow_fuzzy_recall: true,
  allow_multi_hop: false,
}

const DEFAULT_RUNTIME_MEMORY_CONFIG: RuntimeMemoryConfig = {
  memory_enabled: true,
  user_profile_enabled: true,
  memory_char_limit: 4000,
  user_char_limit: 2000,
}

function isMemoryActorContext(value: unknown): value is MemoryActorContext {
  return typeof value === 'object' && value !== null
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson)
    return Array.isArray(parsed) ? parsed.map(tag => String(tag)).filter(Boolean) : []
  } catch {
    return []
  }
}

function stringifyTags(tags: string[] | undefined): string {
  if (!Array.isArray(tags) || tags.length === 0) return '[]'
  return JSON.stringify(Array.from(new Set(tags.map(tag => String(tag).trim()).filter(Boolean))))
}

function getEntryTags(entry: { tags_json?: string; tags?: string[] }): string[] {
  if (Array.isArray(entry.tags)) {
    return entry.tags.map(tag => String(tag)).filter(Boolean)
  }

  return parseTags(typeof entry.tags_json === 'string' ? entry.tags_json : '[]')
}

function getTriggerTags(entry: { tags_json?: string; tags?: string[] }): string[] {
  return getEntryTags(entry)
    .map(tag => tag.trim())
    .filter(tag => tag.toLowerCase().startsWith('trigger:'))
    .map(tag => tag.slice('trigger:'.length).trim())
    .filter(Boolean)
}

function normalizePercent(value: unknown, fallback: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.min(100, Math.round(num)))
}

function trimToLimit(content: string, limit: number): string {
  if (!content) return ''
  if (!Number.isFinite(limit) || limit <= 0) return ''
  if (content.length <= limit) return content.trim()
  return `${content.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function resolveProfileName(profileName?: string | MemoryActorContext): string {
  if (typeof profileName === 'string') {
    return profileName.trim() || getActiveProfileName()
  }
  return profileName?.profileName?.trim() || getActiveProfileName()
}

export function resolveMemoryActorContext(input?: string | MemoryActorContext): Required<Pick<MemoryActorContext, 'profileName'>> & MemoryActorContext {
  if (typeof input === 'string') {
    return { profileName: resolveProfileName(input) }
  }

  if (isMemoryActorContext(input)) {
    return {
      profileName: resolveProfileName(input),
      sessionId: input.sessionId?.trim() || undefined,
      userId: input.userId?.trim() || undefined,
      roomId: input.roomId?.trim() || undefined,
      agentId: input.agentId?.trim() || undefined,
    }
  }

  return { profileName: resolveProfileName() }
}

function getPreferredUserScopeIds(context: MemoryActorContext): string[] {
  const ids = [context.userId, ACTIVE_USER_SCOPE_ID].map(value => value?.trim() || '').filter(Boolean)
  return Array.from(new Set(ids))
}

function getPreferredAgentScopeIds(context: MemoryActorContext): string[] {
  const ids = [context.agentId, SYSTEM_AGENT_SCOPE_ID].map(value => value?.trim() || '').filter(Boolean)
  return Array.from(new Set(ids))
}

function matchesActorContext(entry: Pick<MemoryEntryRecord, 'scope_type' | 'scope_id' | 'profile'>, context: MemoryActorContext): boolean {
  if (entry.scope_type === 'system') return true
  if (entry.scope_type === 'profile') return entry.scope_id === context.profileName
  if (entry.scope_type === 'user') return getPreferredUserScopeIds(context).includes(entry.scope_id)
  if (entry.scope_type === 'room') return Boolean(context.roomId) && entry.scope_id === context.roomId
  if (entry.scope_type === 'agent') return getPreferredAgentScopeIds(context).includes(entry.scope_id)
  return true
}

async function readProfileConfigYaml(profileName?: string): Promise<Record<string, any>> {
  const profile = resolveProfileName(profileName)
  const raw = await safeReadFile(join(getProfileDir(profile), 'config.yaml'))
  if (!raw) return {}
  return (YAML.load(raw) as Record<string, any>) || {}
}

function buildSearchTerms(query: string): string[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const terms = new Set<string>([normalized])
  const alphaNumericParts = normalized.split(/[^\p{L}\p{N}_-]+/u).filter(part => part.length >= 2)
  for (const part of alphaNumericParts) {
    terms.add(part)
  }

  const cjkRuns = normalized.match(/[\p{Script=Han}]{2,}/gu) || []
  for (const run of cjkRuns) {
    terms.add(run)
    if (run.length > 2) {
      for (let i = 0; i < run.length - 1; i += 1) {
        terms.add(run.slice(i, i + 2))
      }
    }
  }

  return Array.from(terms).filter(Boolean)
}

function mapEntryRecord(row: Record<string, unknown>): MemoryEntryRecord {
  return {
    id: String(row.id || ''),
    profile: String(row.profile || ''),
    section: String(row.section || ''),
    scope_type: String(row.scope_type || ''),
    scope_id: String(row.scope_id || ''),
    user_id: String(row.user_id || ''),
    room_id: String(row.room_id || ''),
    agent_id: String(row.agent_id || ''),
    memory_type: String(row.memory_type || ''),
    title: String(row.title || ''),
    content: String(row.content || ''),
    tags_json: String(row.tags_json || '[]'),
    status: String(row.status || ''),
    confidence: Number(row.confidence || 0),
    priority: Number(row.priority || 0),
    salience: Number(row.salience || 0),
    source_type: String(row.source_type || ''),
    source_ref: String(row.source_ref || ''),
    created_at: Number(row.created_at || 0),
    updated_at: Number(row.updated_at || 0),
    last_accessed_at: row.last_accessed_at == null ? null : Number(row.last_accessed_at),
    expires_at: row.expires_at == null ? null : Number(row.expires_at),
    archived_at: row.archived_at == null ? null : Number(row.archived_at),
  }
}

function summarizeEntry(row: MemoryEntryRecord): MemoryEntrySummary {
  return {
    ...row,
    tags: parseTags(row.tags_json),
  }
}

function buildSectionDescriptor(profile: string, section: MemorySection): SectionDescriptor {
  if (section === 'memory') {
    return {
      section,
      scopeType: 'profile',
      scopeId: profile,
      userId: '',
      roomId: '',
      agentId: '',
      memoryType: 'fact',
      title: 'Shared profile memory',
    }
  }

  if (section === 'user') {
    return {
      section,
      scopeType: 'user',
      scopeId: ACTIVE_USER_SCOPE_ID,
      userId: ACTIVE_USER_SCOPE_ID,
      roomId: '',
      agentId: '',
      memoryType: 'preference',
      title: 'Active user memory',
    }
  }

  return {
    section,
    scopeType: 'agent',
    scopeId: SYSTEM_AGENT_SCOPE_ID,
    userId: '',
    roomId: '',
    agentId: SYSTEM_AGENT_SCOPE_ID,
    memoryType: 'procedure',
    title: 'System agent soul memory',
  }
}

function getSectionFilePath(profileName: string, section: MemorySection): string {
  const hd = getProfileDir(profileName)
  if (section === 'soul') return join(hd, 'SOUL.md')
  return join(hd, 'memories', section === 'memory' ? 'MEMORY.md' : 'USER.md')
}

function getSectionJsonKey(profile: string, section: MemorySection): string {
  return `${profile}:${section}`
}

function getEntryJsonKey(
  profile: string,
  input: Pick<UpsertMemoryEntryInput, 'scopeType' | 'scopeId' | 'section'>,
): string {
  return `${profile}:${input.scopeType}:${input.scopeId}:${input.section}`
}

function getExpiresAt(memoryType: MemoryType, policy: MemoryPolicyConfig, timestamp: number): number | null {
  const ttlDaysByType: Record<MemoryType, number> = {
    fact: policy.fact_ttl_days,
    preference: policy.preference_ttl_days,
    episodic: policy.episodic_ttl_days,
    procedure: policy.procedure_ttl_days,
    relationship: policy.relationship_ttl_days,
    policy: policy.policy_ttl_days,
  }

  const ttlDays = ttlDaysByType[memoryType]
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) return null
  return timestamp + ttlDays * 24 * 60 * 60 * 1000
}

function isExpiredEntry(entry: Pick<MemoryEntryRecord, 'expires_at'>, now = Date.now()): boolean {
  return entry.expires_at != null && entry.expires_at > 0 && entry.expires_at <= now
}

function isActiveStatus(status: string | undefined): boolean {
  return (status?.trim() || 'active') === 'active'
}

function isTriggeredMemoryActivated(entry: { tags_json?: string; tags?: string[] }, userInput?: string): boolean {
  const triggers = getTriggerTags(entry)
  if (triggers.length === 0) return true

  const normalizedInput = userInput?.trim().toLowerCase() || ''
  if (!normalizedInput) return false

  return triggers.some((trigger) => {
    const normalizedTrigger = trigger.trim().toLowerCase()
    return Boolean(normalizedTrigger) && normalizedInput.includes(normalizedTrigger)
  })
}

async function writeSectionFile(section: MemorySection, content: string): Promise<void> {
  const filePath = getSectionFilePath(resolveProfileName(), section)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf-8')
}

function readSectionFromDb(profile: string, section: MemorySection): SectionStoreRow | null {
  const db = getDb()
  if (!db) return null

  const descriptor = buildSectionDescriptor(profile, section)
  const row = db.prepare(`
    SELECT content, updated_at
    FROM ${MEMORY_ENTRIES_TABLE}
    WHERE profile = ?
      AND scope_type = ?
      AND scope_id = ?
      AND section = ?
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(profile, descriptor.scopeType, descriptor.scopeId, section) as SectionStoreRow | undefined

  return row ?? null
}

function readSectionFromJson(profile: string, section: MemorySection): SectionStoreRow | null {
  const record = jsonGet(MEMORY_ENTRIES_TABLE, getSectionJsonKey(profile, section))
  if (!record) return null
  return {
    content: typeof record.content === 'string' ? record.content : '',
    updated_at: typeof record.updated_at === 'number' ? record.updated_at : 0,
  }
}

async function readSectionFromFile(profile: string, section: MemorySection): Promise<SectionStoreRow | null> {
  const filePath = getSectionFilePath(profile, section)
  const [content, stat] = await Promise.all([
    safeReadFile(filePath),
    safeStat(filePath),
  ])

  if (content == null) return null
  return {
    content,
    updated_at: stat?.mtime ?? 0,
  }
}

async function readSection(profile: string, section: MemorySection): Promise<SectionStoreRow | null> {
  const dbRow = readSectionFromDb(profile, section)
  if (dbRow) return dbRow

  const db = getDb()
  if (!db) {
    const jsonRow = readSectionFromJson(profile, section)
    if (jsonRow) return jsonRow
  }

  return readSectionFromFile(profile, section)
}

function upsertSectionInDb(
  profile: string,
  section: MemorySection,
  content: string,
  timestamp: number,
  expiresAt: number | null,
): void {
  const db = getDb()
  if (!db) return

  const descriptor = buildSectionDescriptor(profile, section)
  const existing = db.prepare(`
    SELECT id, created_at
    FROM ${MEMORY_ENTRIES_TABLE}
    WHERE profile = ?
      AND scope_type = ?
      AND scope_id = ?
      AND section = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(profile, descriptor.scopeType, descriptor.scopeId, section) as { id: string; created_at: number } | undefined

  if (existing?.id) {
    db.prepare(`
      UPDATE ${MEMORY_ENTRIES_TABLE}
      SET content = ?,
          user_id = ?,
          room_id = ?,
          agent_id = ?,
          memory_type = ?,
          title = ?,
          status = 'active',
          confidence = 100,
          priority = 50,
          salience = 50,
          source_type = 'manual',
          source_ref = 'api.hermes.memory',
          updated_at = ?,
          expires_at = ?,
          archived_at = NULL
      WHERE id = ?
    `).run(
      content,
      descriptor.userId,
      descriptor.roomId,
      descriptor.agentId,
      descriptor.memoryType,
      descriptor.title,
      timestamp,
      expiresAt,
      existing.id,
    )
    return
  }

  db.prepare(`
    INSERT INTO ${MEMORY_ENTRIES_TABLE} (
      id, profile, section, scope_type, scope_id, user_id, room_id, agent_id,
      memory_type, title, content, tags_json, status, confidence, priority, salience,
      source_type, source_ref, created_at, updated_at, last_accessed_at, expires_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 'active', 100, 50, 50, 'manual', 'api.hermes.memory', ?, ?, NULL, NULL, NULL)
  `).run(
    randomUUID(),
    profile,
    section,
    descriptor.scopeType,
    descriptor.scopeId,
    descriptor.userId,
    descriptor.roomId,
    descriptor.agentId,
    descriptor.memoryType,
    descriptor.title,
    content,
    timestamp,
    timestamp,
  )

}

function upsertSectionInJson(
  profile: string,
  section: MemorySection,
  content: string,
  timestamp: number,
  expiresAt: number | null,
): void {
  const descriptor = buildSectionDescriptor(profile, section)
  jsonSet(MEMORY_ENTRIES_TABLE, getSectionJsonKey(profile, section), {
    id: getSectionJsonKey(profile, section),
    profile,
    section,
    scope_type: descriptor.scopeType,
    scope_id: descriptor.scopeId,
    user_id: descriptor.userId,
    room_id: descriptor.roomId,
    agent_id: descriptor.agentId,
    memory_type: descriptor.memoryType,
    title: descriptor.title,
    content,
    tags_json: '[]',
    status: 'active',
    confidence: 100,
    priority: 50,
    salience: 50,
    source_type: 'manual',
    source_ref: 'api.hermes.memory',
    created_at: timestamp,
    updated_at: timestamp,
    last_accessed_at: null,
    expires_at: expiresAt,
    archived_at: null,
  })
}

function findExistingEntry(
  profile: string,
  input: Pick<UpsertMemoryEntryInput, 'scopeType' | 'scopeId' | 'section'>,
): { id: string; created_at: number } | null {
  const db = getDb()
  if (db) {
    const row = db.prepare(`
      SELECT id, created_at
      FROM ${MEMORY_ENTRIES_TABLE}
      WHERE profile = ?
        AND scope_type = ?
        AND scope_id = ?
        AND section = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(profile, input.scopeType, input.scopeId, input.section) as { id: string; created_at: number } | undefined
    return row ?? null
  }

  const record = jsonGet(MEMORY_ENTRIES_TABLE, getEntryJsonKey(profile, input))
  if (!record?.id) return null
  return {
    id: String(record.id),
    created_at: Number(record.created_at || 0),
  }
}

function upsertEntryInDb(
  profile: string,
  input: UpsertMemoryEntryInput,
  timestamp: number,
  expiresAt: number | null,
): void {
  const db = getDb()
  if (!db) return

  const existing = findExistingEntry(profile, input)
  const tagsJson = stringifyTags(input.tags)
  const status = input.status?.trim() || 'active'
  const confidence = normalizePercent(input.confidence, 90)
  const priority = normalizePercent(input.priority, 70)
  const salience = normalizePercent(input.salience, 70)
  const sourceType = input.sourceType?.trim() || 'manual'
  const sourceRef = input.sourceRef?.trim() || ''
  const userId = input.userId?.trim() || ''
  const roomId = input.roomId?.trim() || ''
  const agentId = input.agentId?.trim() || ''

  if (existing?.id) {
    db.prepare(`
      UPDATE ${MEMORY_ENTRIES_TABLE}
      SET user_id = ?,
          room_id = ?,
          agent_id = ?,
          memory_type = ?,
          title = ?,
          content = ?,
          tags_json = ?,
          status = ?,
          confidence = ?,
          priority = ?,
          salience = ?,
          source_type = ?,
          source_ref = ?,
          updated_at = ?,
          expires_at = ?,
          archived_at = NULL
      WHERE id = ?
    `).run(
      userId,
      roomId,
      agentId,
      input.memoryType,
      input.title,
      input.content,
      tagsJson,
      status,
      confidence,
      priority,
      salience,
      sourceType,
      sourceRef,
      timestamp,
      expiresAt,
      existing.id,
    )
    return
  }

  db.prepare(`
    INSERT INTO ${MEMORY_ENTRIES_TABLE} (
      id, profile, section, scope_type, scope_id, user_id, room_id, agent_id,
      memory_type, title, content, tags_json, status, confidence, priority, salience,
      source_type, source_ref, created_at, updated_at, last_accessed_at, expires_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
  `).run(
    randomUUID(),
    profile,
    input.section,
    input.scopeType,
    input.scopeId,
    userId,
    roomId,
    agentId,
    input.memoryType,
    input.title,
    input.content,
    tagsJson,
    status,
    confidence,
    priority,
    salience,
    sourceType,
    sourceRef,
    timestamp,
    timestamp,
    expiresAt,
  )
}

function upsertEntryInJson(
  profile: string,
  input: UpsertMemoryEntryInput,
  timestamp: number,
  expiresAt: number | null,
): void {
  const existing = findExistingEntry(profile, input)
  const key = getEntryJsonKey(profile, input)
  jsonSet(MEMORY_ENTRIES_TABLE, key, {
    id: existing?.id || key,
    profile,
    section: input.section,
    scope_type: input.scopeType,
    scope_id: input.scopeId,
    user_id: input.userId?.trim() || '',
    room_id: input.roomId?.trim() || '',
    agent_id: input.agentId?.trim() || '',
    memory_type: input.memoryType,
    title: input.title,
    content: input.content,
    tags_json: stringifyTags(input.tags),
    status: input.status?.trim() || 'active',
    confidence: normalizePercent(input.confidence, 90),
    priority: normalizePercent(input.priority, 70),
    salience: normalizePercent(input.salience, 70),
    source_type: input.sourceType?.trim() || 'manual',
    source_ref: input.sourceRef?.trim() || '',
    created_at: existing?.created_at || timestamp,
    updated_at: timestamp,
    last_accessed_at: null,
    expires_at: expiresAt,
    archived_at: null,
  })
}

export async function getMemoryData(profileName?: string): Promise<MemoryData> {
  const profile = resolveProfileName(profileName)
  await sweepExpiredEntries(profile)
  const [memory, user, soul] = await Promise.all([
    readSection(profile, 'memory'),
    readSection(profile, 'user'),
    readSection(profile, 'soul'),
  ])

  return {
    memory: memory?.content || '',
    user: user?.content || '',
    soul: soul?.content || '',
    memory_mtime: memory?.updated_at || null,
    user_mtime: user?.updated_at || null,
    soul_mtime: soul?.updated_at || null,
  }
}

export async function getMemoryPolicy(profileName?: string): Promise<MemoryPolicyConfig> {
  const config = await readProfileConfigYaml(profileName).catch(() => ({} as Record<string, any>))
  const raw = (config.memory_policy && typeof config.memory_policy === 'object')
    ? config.memory_policy as Record<string, unknown>
    : {}

  return {
    fact_ttl_days: normalizePositiveInteger(raw.fact_ttl_days, DEFAULT_MEMORY_POLICY.fact_ttl_days),
    preference_ttl_days: normalizePositiveInteger(raw.preference_ttl_days, DEFAULT_MEMORY_POLICY.preference_ttl_days),
    episodic_ttl_days: normalizePositiveInteger(raw.episodic_ttl_days, DEFAULT_MEMORY_POLICY.episodic_ttl_days),
    procedure_ttl_days: normalizePositiveInteger(raw.procedure_ttl_days, DEFAULT_MEMORY_POLICY.procedure_ttl_days),
    relationship_ttl_days: normalizePositiveInteger(raw.relationship_ttl_days, DEFAULT_MEMORY_POLICY.relationship_ttl_days),
    policy_ttl_days: normalizePositiveInteger(raw.policy_ttl_days, DEFAULT_MEMORY_POLICY.policy_ttl_days),
    search_limit: normalizePositiveInteger(raw.search_limit, DEFAULT_MEMORY_POLICY.search_limit),
    allow_fuzzy_recall: normalizeBoolean(raw.allow_fuzzy_recall, DEFAULT_MEMORY_POLICY.allow_fuzzy_recall),
    allow_multi_hop: normalizeBoolean(raw.allow_multi_hop, DEFAULT_MEMORY_POLICY.allow_multi_hop),
  }
}

export async function getRuntimeMemoryConfig(profileName?: string): Promise<RuntimeMemoryConfig> {
  const config = await readProfileConfigYaml(profileName).catch(() => ({} as Record<string, any>))
  const raw = (config.memory && typeof config.memory === 'object')
    ? config.memory as Record<string, unknown>
    : {}

  return {
    memory_enabled: normalizeBoolean(raw.memory_enabled, DEFAULT_RUNTIME_MEMORY_CONFIG.memory_enabled),
    user_profile_enabled: normalizeBoolean(raw.user_profile_enabled, DEFAULT_RUNTIME_MEMORY_CONFIG.user_profile_enabled),
    memory_char_limit: normalizePositiveInteger(raw.memory_char_limit, DEFAULT_RUNTIME_MEMORY_CONFIG.memory_char_limit),
    user_char_limit: normalizePositiveInteger(raw.user_char_limit, DEFAULT_RUNTIME_MEMORY_CONFIG.user_char_limit),
  }
}

function matchesQuery(entry: MemoryEntryRecord, query: MemoryEntryQuery): boolean {
  if (query.section && entry.section !== query.section) return false
  if (query.scopeType && entry.scope_type !== query.scopeType) return false
  if (query.scopeId && entry.scope_id !== query.scopeId) return false
  if (query.memoryType && entry.memory_type !== query.memoryType) return false
  if (query.status) {
    if (query.status !== 'all' && entry.status !== query.status) return false
  } else if (!isActiveStatus(entry.status)) {
    return false
  }

  const now = Date.now()
  if (isExpiredEntry(entry, now) && query.status !== 'archived' && query.status !== 'all') {
    return false
  }

  const q = query.q?.trim().toLowerCase()
  if (!q) return true
  const searchTerms = buildSearchTerms(q)

  const haystacks = [
    entry.title,
    entry.content,
    entry.scope_id,
    entry.memory_type,
    ...parseTags(entry.tags_json),
  ]

  return haystacks.some((value) => {
    const normalizedValue = value.toLowerCase()
    return searchTerms.some(term => normalizedValue.includes(term))
  })
}

function rankEntries(a: MemoryEntryRecord, b: MemoryEntryRecord): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  if (b.salience !== a.salience) return b.salience - a.salience
  if (b.updated_at !== a.updated_at) return b.updated_at - a.updated_at
  return a.id.localeCompare(b.id)
}

function listEntriesFromDb(profile: string): MemoryEntryRecord[] {
  const db = getDb()
  if (!db) return []

  const rows = db.prepare(`
    SELECT *
    FROM ${MEMORY_ENTRIES_TABLE}
    WHERE profile = ?
    ORDER BY updated_at DESC
  `).all(profile) as Array<Record<string, unknown>>

  return rows.map(mapEntryRecord)
}

function listEntriesFromJson(profile: string): MemoryEntryRecord[] {
  return Object.values(jsonGetAll(MEMORY_ENTRIES_TABLE))
    .map(value => mapEntryRecord(value))
    .filter(entry => entry.profile === profile)
}

function findEntryById(profile: string, id: string): MemoryEntryRecord | null {
  const normalizedId = id.trim()
  if (!normalizedId) return null
  const rows = getDb() ? listEntriesFromDb(profile) : listEntriesFromJson(profile)
  return rows.find(entry => entry.profile === profile && entry.id === normalizedId) ?? null
}

function findJsonStorageKeyById(profile: string, id: string): string | null {
  const normalizedId = id.trim()
  if (!normalizedId) return null

  const records = Object.entries(jsonGetAll(MEMORY_ENTRIES_TABLE))
  for (const [key, value] of records) {
    const entry = mapEntryRecord(value)
    if (entry.profile === profile && entry.id === normalizedId) {
      return key
    }
  }

  return null
}

function archiveEntryInDb(profile: string, id: string, archivedAt: number): boolean {
  const db = getDb()
  if (!db) return false

  const result = db.prepare(`
    UPDATE ${MEMORY_ENTRIES_TABLE}
    SET status = 'archived',
        archived_at = ?,
        updated_at = ?
    WHERE profile = ?
      AND id = ?
      AND status != 'archived'
  `).run(archivedAt, archivedAt, profile, id)

  return Number(result.changes || 0) > 0
}

async function restoreEntryInDb(profile: string, entry: MemoryEntryRecord, restoredAt: number): Promise<boolean> {
  const db = getDb()
  if (!db) return false

  const policy = await getMemoryPolicy(profile)
  const nextExpiresAt = isExpiredEntry(entry, restoredAt)
    ? getExpiresAt(entry.memory_type as MemoryType, policy, restoredAt)
    : entry.expires_at

  const result = db.prepare(`
    UPDATE ${MEMORY_ENTRIES_TABLE}
    SET status = 'active',
        archived_at = NULL,
        updated_at = ?,
        expires_at = ?
    WHERE profile = ?
      AND id = ?
  `).run(restoredAt, nextExpiresAt, profile, entry.id)

  return Number(result.changes || 0) > 0
}

function archiveEntryInJson(profile: string, id: string, archivedAt: number): boolean {
  const key = findJsonStorageKeyById(profile, id)
  if (!key) return false

  const existing = jsonGet(MEMORY_ENTRIES_TABLE, key)
  if (!existing || String(existing.status || 'active') === 'archived') return false

  jsonSet(MEMORY_ENTRIES_TABLE, key, {
    ...existing,
    status: 'archived',
    archived_at: archivedAt,
    updated_at: archivedAt,
  })

  return true
}

async function restoreEntryInJson(profile: string, entry: MemoryEntryRecord, restoredAt: number): Promise<boolean> {
  const key = findJsonStorageKeyById(profile, entry.id)
  if (!key) return false

  const existing = jsonGet(MEMORY_ENTRIES_TABLE, key)
  if (!existing) return false

  const policy = await getMemoryPolicy(profile)
  const nextExpiresAt = isExpiredEntry(entry, restoredAt)
    ? getExpiresAt(entry.memory_type as MemoryType, policy, restoredAt)
    : entry.expires_at

  jsonSet(MEMORY_ENTRIES_TABLE, key, {
    ...existing,
    status: 'active',
    archived_at: null,
    updated_at: restoredAt,
    expires_at: nextExpiresAt,
  })

  return true
}

async function sweepExpiredEntries(profile: string): Promise<number> {
  const now = Date.now()
  const rows = getDb() ? listEntriesFromDb(profile) : listEntriesFromJson(profile)
  const expiredEntries = rows.filter(entry => isActiveStatus(entry.status) && isExpiredEntry(entry, now))

  let archivedCount = 0
  for (const entry of expiredEntries) {
    const archived = getDb()
      ? archiveEntryInDb(profile, entry.id, now)
      : archiveEntryInJson(profile, entry.id, now)

    if (archived) archivedCount += 1
  }

  return archivedCount
}

export async function listMemoryEntries(query: MemoryEntryQuery = {}, profileName?: string): Promise<MemoryEntrySummary[]> {
  const profile = resolveProfileName(profileName)
  await sweepExpiredEntries(profile)
  const policy = await getMemoryPolicy(profile)
  const limit = normalizePositiveInteger(query.limit, policy.search_limit)
  const rows = getDb() ? listEntriesFromDb(profile) : listEntriesFromJson(profile)

  return rows
    .filter(entry => matchesQuery(entry, query))
    .sort(rankEntries)
    .slice(0, limit)
    .map(summarizeEntry)
}

async function listScopedMemoryEntries(
  query: MemoryEntryQuery,
  contextInput?: string | MemoryActorContext,
): Promise<MemoryEntrySummary[]> {
  const context = resolveMemoryActorContext(contextInput)
  const entries = await listMemoryEntries(query, context.profileName)
  return entries.filter(entry => matchesActorContext(entry, context))
}

export async function upsertMemoryEntry(input: UpsertMemoryEntryInput, profileName?: string): Promise<void> {
  const profile = resolveProfileName(profileName)
  const timestamp = Date.now()
  const policy = await getMemoryPolicy(profile)
  const expiresAt = input.expiresAt === undefined
    ? getExpiresAt(input.memoryType, policy, timestamp)
    : input.expiresAt

  if (getDb()) {
    upsertEntryInDb(profile, input, timestamp, expiresAt)
  } else {
    upsertEntryInJson(profile, input, timestamp, expiresAt)
  }
}

export async function archiveMemoryEntry(id: string, profileName?: string): Promise<boolean> {
  const profile = resolveProfileName(profileName)
  const archivedAt = Date.now()
  return getDb()
    ? archiveEntryInDb(profile, id, archivedAt)
    : archiveEntryInJson(profile, id, archivedAt)
}

export async function restoreMemoryEntry(id: string, profileName?: string): Promise<boolean> {
  const profile = resolveProfileName(profileName)
  const entry = findEntryById(profile, id)
  if (!entry) return false

  const restoredAt = Date.now()
  return getDb()
    ? restoreEntryInDb(profile, entry, restoredAt)
    : restoreEntryInJson(profile, entry, restoredAt)
}

export async function archiveExpiredMemoryEntries(profileName?: string): Promise<number> {
  const profile = resolveProfileName(profileName)
  return sweepExpiredEntries(profile)
}

export async function buildMemoryInstructionBlock(
  userInput?: string,
  contextInput?: string | MemoryActorContext,
): Promise<string> {
  const context = resolveMemoryActorContext(contextInput)
  const profile = context.profileName
  await archiveExpiredMemoryEntries(profile)
  const runtimeConfig = await getRuntimeMemoryConfig(profile)
  if (!runtimeConfig.memory_enabled) return ''

  const memoryData = await getMemoryData(profile)
  const sections: string[] = []

  const sharedMemory = trimToLimit(memoryData.memory, runtimeConfig.memory_char_limit)
  if (sharedMemory) {
    sections.push(`### Shared Profile Memory\n${sharedMemory}`)
  }

  const alwaysOnEntryIds = new Set<string>()
  const allowLegacyUserSection = !context.userId || context.userId === ACTIVE_USER_SCOPE_ID
  const userMemory = runtimeConfig.user_profile_enabled && allowLegacyUserSection
    ? trimToLimit(memoryData.user, runtimeConfig.user_char_limit)
    : ''

  if (userMemory) {
    sections.push(`### Active User Memory\n${userMemory}`)
  }

  if (runtimeConfig.user_profile_enabled) {
    const userPreferences = await listScopedMemoryEntries({
      scopeType: 'user',
      memoryType: 'preference',
      status: 'active',
      limit: 5,
    }, context)

    const preferenceLines = userPreferences
      .filter(entry => entry.section !== 'user')
      .filter(entry => isTriggeredMemoryActivated(entry, userInput))
      .filter((entry) => {
        const content = trimToLimit(entry.content, 180)
        return Boolean(content) && (!userMemory || !userMemory.includes(content))
      })
      .map((entry) => {
        alwaysOnEntryIds.add(entry.id)
        return `- ${trimToLimit(entry.content, 180)}`
      })
      .filter(Boolean)

    if (preferenceLines.length > 0) {
      sections.push(`### Structured User Preferences\n${preferenceLines.join('\n')}`)
    }

    const userIdentityEntries = await listScopedMemoryEntries({
      scopeType: 'user',
      status: 'active',
      limit: 3,
    }, context)

    const identityLines = userIdentityEntries
      .filter(entry => entry.section.startsWith('user.identity.'))
      .filter(entry => isTriggeredMemoryActivated(entry, userInput))
      .map((entry) => {
        alwaysOnEntryIds.add(entry.id)
        return `- ${trimToLimit(entry.content, 180)}`
      })
      .filter(Boolean)

    if (identityLines.length > 0) {
      sections.push(`### Structured User Identity\n${identityLines.join('\n')}`)
    }
  }

  const soulMemory = trimToLimit(memoryData.soul, runtimeConfig.user_char_limit)
  if (soulMemory) {
    sections.push(`### Agent Operating Memory\n${soulMemory}`)
  }

  if (context.roomId) {
    const roomEntries = await listScopedMemoryEntries({
      scopeType: 'room',
      status: 'active',
      limit: 4,
    }, context)

    const roomLines = roomEntries
      .filter(entry => isTriggeredMemoryActivated(entry, userInput))
      .map((entry) => {
        alwaysOnEntryIds.add(entry.id)
        return `- ${trimToLimit(entry.content, 180)}`
      })
      .filter(Boolean)

    if (roomLines.length > 0) {
      sections.push(`### Shared Room Memory\n${roomLines.join('\n')}`)
    }
  }

  if (context.agentId) {
    const agentEntries = await listScopedMemoryEntries({
      scopeType: 'agent',
      status: 'active',
      limit: 3,
    }, context)

    const agentLines = agentEntries
      .filter(entry => !['soul'].includes(entry.section))
      .filter(entry => isTriggeredMemoryActivated(entry, userInput))
      .map((entry) => {
        alwaysOnEntryIds.add(entry.id)
        return `- ${trimToLimit(entry.content, 180)}`
      })
      .filter(Boolean)

    if (agentLines.length > 0) {
      sections.push(`### Agent Scoped Memory\n${agentLines.join('\n')}`)
    }
  }

  const q = userInput?.trim()
  if (q) {
    const relatedEntries = await listScopedMemoryEntries({ q, limit: 5 }, context)
    const extraLines = relatedEntries
      .filter(entry => !alwaysOnEntryIds.has(entry.id))
      .filter(entry => !['memory', 'user', 'soul'].includes(entry.section))
      .filter(entry => isTriggeredMemoryActivated(entry, userInput))
      .map((entry) => {
        const label = [entry.memory_type, entry.scope_type, entry.scope_id].filter(Boolean).join('/')
        const content = trimToLimit(entry.content, 240)
        return content ? `- [${label}] ${content}` : ''
      })
      .filter(Boolean)

    if (extraLines.length > 0) {
      sections.push(`### Relevant Structured Memory\n${extraLines.join('\n')}`)
    }
  }

  if (sections.length === 0) return ''

  return [
    '## Memory Context',
    'Use the following memory as supportive context only.',
    'If it conflicts with the latest user request or current conversation, follow the latest user request.',
    '',
    ...sections,
  ].join('\n')
}

export async function saveMemorySection(section: MemorySection, content: string, profileName?: string): Promise<void> {
  const profile = resolveProfileName(profileName)
  const timestamp = Date.now()
  const policy = await getMemoryPolicy(profile)
  const descriptor = buildSectionDescriptor(profile, section)
  const expiresAt = getExpiresAt(descriptor.memoryType, policy, timestamp)

  if (getDb()) {
    upsertSectionInDb(profile, section, content, timestamp, expiresAt)
  } else {
    upsertSectionInJson(profile, section, content, timestamp, expiresAt)
  }

  const filePath = getSectionFilePath(profile, section)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf-8')
}

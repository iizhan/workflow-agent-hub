import { request } from '../client'

export type SkillSource = 'builtin' | 'hub' | 'local'

export interface SkillInfo {
  name: string
  description: string
  enabled?: boolean
  source?: SkillSource
  modified?: boolean
  patchCount?: number
  useCount?: number
  viewCount?: number
  pinned?: boolean
}

export interface SkillCategory {
  name: string
  description: string
  skills: SkillInfo[]
}

export interface SkillListResponse {
  categories: SkillCategory[]
  archived: SkillInfo[]
}

export interface SkillFileEntry {
  path: string
  name: string
  isDir: boolean
}

export interface MemoryData {
  memory: string
  user: string
  soul: string
  memory_mtime: number | null
  user_mtime: number | null
  soul_mtime: number | null
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

export interface MemoryEntrySummary {
  id: string
  profile: string
  section: string
  scope_type: string
  scope_id: string
  user_id: string
  room_id: string
  agent_id: string
  memory_type: string
  title: string
  content: string
  tags: string[]
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

export interface SkillsData {
  categories: SkillCategory[]
  archived: SkillInfo[]
}

export async function fetchSkills(): Promise<SkillsData> {
  const res = await request<SkillListResponse>('/api/hermes/skills')
  return { categories: res.categories, archived: res.archived ?? [] }
}

export async function fetchSkillContent(skillPath: string): Promise<string> {
  const res = await request<{ content: string }>(`/api/hermes/skills/${skillPath}`)
  return res.content
}

export async function fetchSkillFiles(category: string, skill: string): Promise<SkillFileEntry[]> {
  const res = await request<{ files: SkillFileEntry[] }>(`/api/hermes/skills/${category}/${skill}/files`)
  return res.files
}

export async function fetchMemory(): Promise<MemoryData> {
  return request<MemoryData>('/api/hermes/memory')
}

export async function fetchMemoryPolicy(): Promise<MemoryPolicyConfig> {
  return request<MemoryPolicyConfig>('/api/hermes/memory/policy')
}

export async function fetchMemoryEntries(params: {
  section?: 'memory' | 'user' | 'soul'
  scopeType?: string
  memoryType?: string
  status?: string
  q?: string
  limit?: number
} = {}): Promise<MemoryEntrySummary[]> {
  const query = new URLSearchParams()
  if (params.section) query.set('section', params.section)
  if (params.scopeType) query.set('scopeType', params.scopeType)
  if (params.memoryType) query.set('memoryType', params.memoryType)
  if (params.status) query.set('status', params.status)
  if (params.q) query.set('q', params.q)
  if (params.limit != null) query.set('limit', String(params.limit))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await request<{ entries: MemoryEntrySummary[] }>(`/api/hermes/memory/entries${suffix}`)
  return res.entries
}

export async function saveMemory(section: 'memory' | 'user' | 'soul', content: string): Promise<void> {
  await request('/api/hermes/memory', {
    method: 'POST',
    body: JSON.stringify({ section, content }),
  })
}

export async function toggleSkill(name: string, enabled: boolean): Promise<void> {
  await request('/api/hermes/skills/toggle', {
    method: 'PUT',
    body: JSON.stringify({ name, enabled }),
  })
}

export async function pinSkillApi(name: string, pinned: boolean): Promise<void> {
  await request('/api/hermes/skills/pin', {
    method: 'PUT',
    body: JSON.stringify({ name, pinned }),
  })
}

import { beforeEach, describe, expect, it, vi } from 'vitest'

const safeReadFileMock = vi.hoisted(() => vi.fn())
const safeStatMock = vi.hoisted(() => vi.fn())
const jsonGetMock = vi.hoisted(() => vi.fn())
const jsonGetAllMock = vi.hoisted(() => vi.fn())
const jsonSetMock = vi.hoisted(() => vi.fn())
const memoryRows = vi.hoisted(() => ({ current: {} as Record<string, any> }))

vi.mock('../../packages/server/src/services/config-helpers', () => ({
  safeReadFile: safeReadFileMock,
  safeStat: safeStatMock,
}))

vi.mock('../../packages/server/src/db/index', () => ({
  getDb: () => null,
  jsonGet: jsonGetMock,
  jsonGetAll: jsonGetAllMock,
  jsonSet: jsonSetMock,
}))

vi.mock('../../packages/server/src/services/hermes/hermes-profile', () => ({
  getActiveProfileName: () => 'default',
  getProfileDir: () => '/tmp/hermes-profile',
}))

describe('memory store prompt assembly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    safeReadFileMock.mockResolvedValue(null)
    safeStatMock.mockResolvedValue(null)
    memoryRows.current = {
      extra_1: {
        id: 'extra_1',
        profile: 'default',
        section: 'relationship',
        scope_type: 'profile',
        scope_id: 'default',
        user_id: '',
        room_id: '',
        agent_id: '',
        memory_type: 'relationship',
        title: '团队关系',
        content: '张三是产品经理，和李四一起负责 Hermes 记忆设计。',
        tags_json: '["team","relationship"]',
        status: 'active',
        confidence: 90,
        priority: 70,
        salience: 65,
        source_type: 'manual',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      pref_user_1: {
        id: 'pref_user_1',
        profile: 'default',
        section: 'user.preference.format.no_emoji',
        scope_type: 'user',
        scope_id: 'user-1',
        user_id: 'user-1',
        room_id: '',
        agent_id: '',
        memory_type: 'preference',
        title: 'No emoji preference',
        content: '用户不希望回复中使用表情符号。',
        tags_json: '["user","preference"]',
        status: 'active',
        confidence: 98,
        priority: 92,
        salience: 90,
        source_type: 'auto_extract',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      pref_active_user: {
        id: 'pref_active_user',
        profile: 'default',
        section: 'user.preference.format.no_emoji',
        scope_type: 'user',
        scope_id: '__active_user__',
        user_id: '__active_user__',
        room_id: '',
        agent_id: '',
        memory_type: 'preference',
        title: 'No emoji preference',
        content: '默认用户不希望回复中使用表情符号。',
        tags_json: '["user","preference"]',
        status: 'active',
        confidence: 98,
        priority: 92,
        salience: 90,
        source_type: 'auto_extract',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      pref_other_user: {
        id: 'pref_other_user',
        profile: 'default',
        section: 'user.preference.response_style.concise',
        scope_type: 'user',
        scope_id: 'user-2',
        user_id: 'user-2',
        room_id: '',
        agent_id: '',
        memory_type: 'preference',
        title: 'Concise response preference',
        content: '用户偏好回复简洁，优先使用精炼表达。',
        tags_json: '["user","preference"]',
        status: 'active',
        confidence: 95,
        priority: 88,
        salience: 86,
        source_type: 'auto_extract',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      room_1: {
        id: 'room_1',
        profile: 'default',
        section: 'room.shared.delivery_style',
        scope_type: 'room',
        scope_id: 'room-1',
        user_id: '',
        room_id: 'room-1',
        agent_id: '',
        memory_type: 'fact',
        title: 'Room delivery style',
        content: '这个房间默认先输出结论，再给执行清单。',
        tags_json: '["room","delivery"]',
        status: 'active',
        confidence: 90,
        priority: 80,
        salience: 78,
        source_type: 'manual',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      pref_triggered_user: {
        id: 'pref_triggered_user',
        profile: 'default',
        section: 'user.preference.workflow.database_index_first',
        scope_type: 'user',
        scope_id: '__active_user__',
        user_id: '__active_user__',
        room_id: '',
        agent_id: '',
        memory_type: 'preference',
        title: 'Database workflow preference',
        content: '当讨论数据库问题时，用户希望优先检查索引和执行计划。',
        tags_json: '["user","preference","trigger:数据库"]',
        status: 'active',
        confidence: 92,
        priority: 84,
        salience: 82,
        source_type: 'auto_extract',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now(),
        last_accessed_at: null,
        expires_at: null,
        archived_at: null,
      },
      expired_fact_1: {
        id: 'expired_fact_1',
        profile: 'default',
        section: 'project.temp.address',
        scope_type: 'profile',
        scope_id: 'default',
        user_id: '',
        room_id: '',
        agent_id: '',
        memory_type: 'fact',
        title: 'Temporary address',
        content: '临时地址是上海市静安区某某路 88 号。',
        tags_json: '["fact","temporary"]',
        status: 'active',
        confidence: 70,
        priority: 20,
        salience: 20,
        source_type: 'manual',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now() - 10_000,
        last_accessed_at: null,
        expires_at: Date.now() - 5_000,
        archived_at: null,
      },
      archived_pref_1: {
        id: 'archived_pref_1',
        profile: 'default',
        section: 'user.preference.response_style.verbose',
        scope_type: 'user',
        scope_id: '__active_user__',
        user_id: '__active_user__',
        room_id: '',
        agent_id: '',
        memory_type: 'preference',
        title: 'Verbose response preference',
        content: '用户曾经偏好详细回复。',
        tags_json: '["user","preference"]',
        status: 'archived',
        confidence: 80,
        priority: 30,
        salience: 25,
        source_type: 'manual',
        source_ref: 'test',
        created_at: 1,
        updated_at: Date.now() - 20_000,
        last_accessed_at: null,
        expires_at: Date.now() - 10_000,
        archived_at: Date.now() - 5_000,
      },
    }
    jsonGetMock.mockImplementation((_table: string, key: string) => {
      const map: Record<string, any> = {
        'default:memory': { content: '团队约定：先给结论再展开。', updated_at: 1 },
        'default:user': { content: '用户偏好：回复简洁，不要表情。', updated_at: 2 },
        'default:soul': { content: '助手要求：必要时先总结后细化。', updated_at: 3 },
      }
      return map[key] ?? memoryRows.current[key]
    })
    jsonGetAllMock.mockImplementation(() => memoryRows.current)
    jsonSetMock.mockImplementation((_table: string, key: string, value: Record<string, any>) => {
      memoryRows.current[key] = value
    })
  })

  it('builds a layered memory instruction block from runtime config and stored memory', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')
    const block = await mod.buildMemoryInstructionBlock('请结合张三的职责来回答')

    expect(block).toContain('## Memory Context')
    expect(block).toContain('### Shared Profile Memory')
    expect(block).toContain('先给结论再展开')
    expect(block).toContain('### Active User Memory')
    expect(block).toContain('回复简洁，不要表情')
    expect(block).toContain('### Agent Operating Memory')
    expect(block).toContain('先总结后细化')
    expect(block).toContain('### Relevant Structured Memory')
    expect(block).toContain('张三是产品经理')
  })

  it('returns an empty block when runtime memory is disabled', async () => {
    safeReadFileMock.mockImplementation(async (path: string) => {
      if (path.endsWith('/config.yaml')) {
        return 'memory:\n  memory_enabled: false\n'
      }
      return null
    })

    const mod = await import('../../packages/server/src/services/hermes/memory-store')
    const block = await mod.buildMemoryInstructionBlock('随便问一句')

    expect(block).toBe('')
  })

  it('always injects structured user preferences even when the latest query does not match them', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')
    const block = await mod.buildMemoryInstructionBlock('这次帮我看下数据库索引')

    expect(block).toContain('### Structured User Preferences')
    expect(block).toContain('默认用户不希望回复中使用表情符号')
  })

  it('only activates trigger-tagged memories when the latest input matches their trigger', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')

    const unrelatedBlock = await mod.buildMemoryInstructionBlock('帮我润色这段周报')
    expect(unrelatedBlock).not.toContain('优先检查索引和执行计划')

    const matchedBlock = await mod.buildMemoryInstructionBlock('这次帮我看看数据库慢查询')
    expect(matchedBlock).toContain('优先检查索引和执行计划')
  })

  it('isolates scoped user and room memories when a real actor context is provided', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')
    const block = await mod.buildMemoryInstructionBlock('帮我继续当前房间的数据库改造', {
      profileName: 'default',
      userId: 'user-1',
      roomId: 'room-1',
      agentId: 'agent-1',
    })

    expect(block).not.toContain('### Active User Memory')
    expect(block).toContain('### Structured User Preferences')
    expect(block).toContain('用户不希望回复中使用表情符号')
    expect(block).not.toContain('用户偏好回复简洁，优先使用精炼表达')
    expect(block).toContain('### Shared Room Memory')
    expect(block).toContain('这个房间默认先输出结论')
  })

  it('upserts structured memory entries through the JSON fallback store', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')

    await mod.upsertMemoryEntry({
      section: 'user.preference.response_style.concise',
      scopeType: 'user',
      scopeId: '__active_user__',
      userId: '__active_user__',
      memoryType: 'preference',
      title: 'Concise response preference',
      content: '用户偏好回复简洁，优先使用精炼表达。',
      tags: ['user', 'preference', 'concise'],
      sourceType: 'auto_extract',
      sourceRef: 'unit.test',
      priority: 88,
      salience: 86,
    })

    const entries = await mod.listMemoryEntries({
      scopeType: 'user',
      memoryType: 'preference',
      q: '简洁',
    })

    expect(entries.some(entry => entry.section === 'user.preference.response_style.concise')).toBe(true)
    expect(jsonSetMock).toHaveBeenCalled()
  })

  it('archives expired active entries and excludes archived entries from default retrieval', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')

    const activeEntries = await mod.listMemoryEntries({ q: '地址' })
    expect(activeEntries.some(entry => entry.id === 'expired_fact_1')).toBe(false)
    expect(memoryRows.current.expired_fact_1.status).toBe('archived')
    expect(memoryRows.current.expired_fact_1.archived_at).toBeTypeOf('number')

    const archivedEntries = await mod.listMemoryEntries({ status: 'archived' })
    expect(archivedEntries.map(entry => entry.id)).toContain('expired_fact_1')
    expect(archivedEntries.map(entry => entry.id)).toContain('archived_pref_1')
  })

  it('restores archived entries back to active and refreshes expired ttl windows', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-store')

    const restored = await mod.restoreMemoryEntry('archived_pref_1')
    expect(restored).toBe(true)
    expect(memoryRows.current.archived_pref_1.status).toBe('active')
    expect(memoryRows.current.archived_pref_1.archived_at).toBeNull()
    expect(memoryRows.current.archived_pref_1.expires_at).toBeGreaterThan(Date.now())

    const activeEntries = await mod.listMemoryEntries({ scopeType: 'user', q: '详细回复' })
    expect(activeEntries.map(entry => entry.id)).toContain('archived_pref_1')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getRuntimeMemoryConfigMock = vi.hoisted(() => vi.fn())
const upsertMemoryEntryMock = vi.hoisted(() => vi.fn())

vi.mock('../../packages/server/src/services/hermes/memory-store', () => ({
  ACTIVE_USER_SCOPE_ID: '__active_user__',
  getRuntimeMemoryConfig: getRuntimeMemoryConfigMock,
  resolveMemoryActorContext: (input?: string | { profileName?: string; userId?: string; roomId?: string; agentId?: string }) => {
    if (typeof input === 'string') return { profileName: input }
    return { profileName: 'default', ...input }
  },
  upsertMemoryEntry: upsertMemoryEntryMock,
}))

describe('memory extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getRuntimeMemoryConfigMock.mockResolvedValue({
      memory_enabled: true,
      user_profile_enabled: true,
      memory_char_limit: 4000,
      user_char_limit: 2000,
    })
  })

  it('extracts conservative user preferences and preferred name from explicit statements', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const entries = mod.extractMemoryEntriesFromUserInput('以后请简洁一点，不要表情，先给结论，叫我老王。')

    expect(entries.map(entry => entry.section)).toEqual([
      'user.preference.response_style.concise',
      'user.preference.answer_structure.conclusion_first',
      'user.preference.format.no_emoji',
      'user.identity.preferred_name',
    ])
    expect(entries.at(-1)?.content).toContain('老王')
  })

  it('extracts shared room conventions only when the message explicitly targets the room', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')

    expect(mod.extractRoomMemoryEntriesFromMessage('以后请简洁一点。', 'room-1')).toEqual([])

    const entries = mod.extractRoomMemoryEntriesFromMessage('这个房间以后统一先给结论，回复简洁一点，不要表情。', 'room-1')
    expect(entries.map(entry => entry.section)).toEqual([
      'room.shared.response_style.concise',
      'room.shared.answer_structure.conclusion_first',
      'room.shared.format.no_emoji',
    ])
  })

  it('extracts hidden agent self notes and removes them from visible content', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const payload = mod.extractAgentSelfMemoryPayload([
      '先给结论。',
      '[[SELF_NOTE: 以后遇到需求澄清时，先确认关键缺口再继续。]]',
      '【自我备忘】输出方案时优先贴近现有模块结构。',
    ].join('\n'), 'agent-7')

    expect(payload.visibleContent).toBe('先给结论。')
    expect(payload.entries.map(entry => entry.content)).toEqual([
      '以后遇到需求澄清时，先确认关键缺口再继续。',
      '输出方案时优先贴近现有模块结构。',
    ])
    expect(payload.entries.every(entry => entry.scopeType === 'agent' && entry.scopeId === 'agent-7')).toBe(true)
  })

  it('does not write anything when runtime memory is disabled', async () => {
    getRuntimeMemoryConfigMock.mockResolvedValue({
      memory_enabled: false,
      user_profile_enabled: true,
      memory_char_limit: 4000,
      user_char_limit: 2000,
    })

    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const saved = await mod.rememberUserMessageMemories('以后请简洁一点', 'default')

    expect(saved).toBe(0)
    expect(upsertMemoryEntryMock).not.toHaveBeenCalled()
  })

  it('persists extracted memories with the active profile', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const saved = await mod.rememberUserMessageMemories('Call me Alex and no emoji please.', {
      profileName: 'product',
      userId: 'user-42',
      roomId: 'room-7',
    })

    expect(saved).toBe(2)
    expect(upsertMemoryEntryMock).toHaveBeenCalledTimes(2)
    expect(upsertMemoryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'user.preference.format.no_emoji',
        scopeId: 'user-42',
        userId: 'user-42',
      }),
      'product',
    )
    expect(upsertMemoryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'user.identity.preferred_name',
        scopeId: 'user-42',
        userId: 'user-42',
        content: '用户希望被称呼为“Alex”。',
      }),
      'product',
    )
  })

  it('persists shared room memories for collective conventions', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const saved = await mod.rememberRoomMessageMemories('群里以后统一先给结论，不要表情。', {
      profileName: 'product',
      userId: 'user-42',
      roomId: 'room-7',
    })

    expect(saved).toBe(2)
    expect(upsertMemoryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'room.shared.answer_structure.conclusion_first',
        scopeType: 'room',
        scopeId: 'room-7',
        roomId: 'room-7',
        userId: 'user-42',
      }),
      'product',
    )
    expect(upsertMemoryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: 'room.shared.format.no_emoji',
        scopeType: 'room',
        scopeId: 'room-7',
        roomId: 'room-7',
        userId: 'user-42',
      }),
      'product',
    )
  })

  it('persists agent self notes and returns cleaned visible content', async () => {
    const mod = await import('../../packages/server/src/services/hermes/memory-extractor')
    const result = await mod.rememberAgentResponseMemories([
      '我先给出可执行方案。',
      '[[SELF_NOTE]]以后遇到跨模块改动，先检查真实目录结构再输出方案。[[/SELF_NOTE]]',
    ].join('\n'), {
      profileName: 'product',
      roomId: 'room-7',
      agentId: 'agent-9',
    })

    expect(result).toEqual({
      visibleContent: '我先给出可执行方案。',
      saved: 1,
    })
    expect(upsertMemoryEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeType: 'agent',
        scopeId: 'agent-9',
        agentId: 'agent-9',
        roomId: 'room-7',
        memoryType: 'procedure',
        content: '以后遇到跨模块改动，先检查真实目录结构再输出方案。',
      }),
      'product',
    )
  })
})

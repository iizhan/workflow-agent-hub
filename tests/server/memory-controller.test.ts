import { beforeEach, describe, expect, it, vi } from 'vitest'

const getMemoryDataMock = vi.fn()
const getMemoryPolicyMock = vi.fn()
const listMemoryEntriesMock = vi.fn()
const saveMemorySectionMock = vi.fn()
const archiveMemoryEntryMock = vi.fn()
const restoreMemoryEntryMock = vi.fn()
const archiveExpiredMemoryEntriesMock = vi.fn()

vi.mock('../../packages/server/src/services/hermes/memory-store', () => ({
  archiveExpiredMemoryEntries: archiveExpiredMemoryEntriesMock,
  archiveMemoryEntry: archiveMemoryEntryMock,
  getMemoryData: getMemoryDataMock,
  getMemoryPolicy: getMemoryPolicyMock,
  listMemoryEntries: listMemoryEntriesMock,
  restoreMemoryEntry: restoreMemoryEntryMock,
  saveMemorySection: saveMemorySectionMock,
}))

function ctx(overrides: Record<string, any> = {}) {
  return {
    request: { body: {} },
    status: 200,
    body: null,
    ...overrides,
  } as any
}

describe('memory controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns structured memory payload from the memory store', async () => {
    getMemoryDataMock.mockResolvedValue({
      memory: 'shared memory',
      user: 'user profile',
      soul: 'agent soul',
      memory_mtime: 1,
      user_mtime: 2,
      soul_mtime: 3,
    })

    const mod = await import('../../packages/server/src/controllers/hermes/memory')
    const c = ctx()
    await mod.get(c)

    expect(getMemoryDataMock).toHaveBeenCalled()
    expect(c.body).toEqual({
      memory: 'shared memory',
      user: 'user profile',
      soul: 'agent soul',
      memory_mtime: 1,
      user_mtime: 2,
      soul_mtime: 3,
    })
  })

  it('returns memory policy defaults from the memory store', async () => {
    getMemoryPolicyMock.mockResolvedValue({
      fact_ttl_days: 180,
      preference_ttl_days: 90,
      episodic_ttl_days: 14,
      procedure_ttl_days: 30,
      relationship_ttl_days: 180,
      policy_ttl_days: 0,
      search_limit: 12,
      allow_fuzzy_recall: true,
      allow_multi_hop: false,
    })

    const mod = await import('../../packages/server/src/controllers/hermes/memory')
    const c = ctx()
    await mod.policy(c)

    expect(getMemoryPolicyMock).toHaveBeenCalled()
    expect(c.body.search_limit).toBe(12)
  })

  it('passes structured search filters through to the memory store', async () => {
    listMemoryEntriesMock.mockResolvedValue([{ id: 'mem-1', section: 'user' }])

    const mod = await import('../../packages/server/src/controllers/hermes/memory')
    const c = ctx({
      query: {
        section: 'user',
        scopeType: 'user',
        scopeId: 'user-1',
        memoryType: 'preference',
        status: 'active',
        q: '简洁',
        limit: '5',
      },
    })
    await mod.listEntries(c)

    expect(listMemoryEntriesMock).toHaveBeenCalledWith({
      section: 'user',
      scopeType: 'user',
      scopeId: 'user-1',
      memoryType: 'preference',
      status: 'active',
      q: '简洁',
      limit: 5,
    })
    expect(c.body).toEqual({ entries: [{ id: 'mem-1', section: 'user' }] })
  })

  it('validates save requests and allows empty content for clearing a section', async () => {
    const mod = await import('../../packages/server/src/controllers/hermes/memory')

    const missingContent = ctx({ request: { body: { section: 'memory' } } })
    await mod.save(missingContent)
    expect(missingContent.status).toBe(400)

    const invalidSection = ctx({ request: { body: { section: 'unknown', content: '' } } })
    await mod.save(invalidSection)
    expect(invalidSection.status).toBe(400)

    const clearSection = ctx({ request: { body: { section: 'user', content: '' } } })
    await mod.save(clearSection)
    expect(saveMemorySectionMock).toHaveBeenCalledWith('user', '')
    expect(clearSection.body).toEqual({ success: true })
  })

  it('returns a server error when the memory store write fails', async () => {
    saveMemorySectionMock.mockRejectedValue(new Error('disk full'))

    const mod = await import('../../packages/server/src/controllers/hermes/memory')
    const c = ctx({ request: { body: { section: 'soul', content: 'persist me' } } })
    await mod.save(c)

    expect(c.status).toBe(500)
    expect(c.body).toEqual({ error: 'disk full' })
  })

  it('archives and restores entries through the memory store', async () => {
    archiveMemoryEntryMock.mockResolvedValue(true)
    restoreMemoryEntryMock.mockResolvedValue(true)

    const mod = await import('../../packages/server/src/controllers/hermes/memory')

    const archiveCtx = ctx({ params: { id: 'mem-1' } })
    await mod.archiveEntry(archiveCtx)
    expect(archiveMemoryEntryMock).toHaveBeenCalledWith('mem-1')
    expect(archiveCtx.body).toEqual({ success: true, id: 'mem-1' })

    const restoreCtx = ctx({ params: { id: 'mem-1' } })
    await mod.restoreEntry(restoreCtx)
    expect(restoreMemoryEntryMock).toHaveBeenCalledWith('mem-1')
    expect(restoreCtx.body).toEqual({ success: true, id: 'mem-1' })
  })

  it('returns 404 when archive or restore targets do not exist', async () => {
    archiveMemoryEntryMock.mockResolvedValue(false)
    restoreMemoryEntryMock.mockResolvedValue(false)

    const mod = await import('../../packages/server/src/controllers/hermes/memory')

    const archiveCtx = ctx({ params: { id: 'missing' } })
    await mod.archiveEntry(archiveCtx)
    expect(archiveCtx.status).toBe(404)

    const restoreCtx = ctx({ params: { id: 'missing' } })
    await mod.restoreEntry(restoreCtx)
    expect(restoreCtx.status).toBe(404)
  })

  it('archives expired entries in batch', async () => {
    archiveExpiredMemoryEntriesMock.mockResolvedValue(3)

    const mod = await import('../../packages/server/src/controllers/hermes/memory')
    const c = ctx()
    await mod.archiveExpired(c)

    expect(archiveExpiredMemoryEntriesMock).toHaveBeenCalled()
    expect(c.body).toEqual({ success: true, archived: 3 })
  })
})

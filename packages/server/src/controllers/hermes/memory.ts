import {
  archiveExpiredMemoryEntries,
  archiveMemoryEntry,
  getMemoryData,
  getMemoryPolicy,
  listMemoryEntries,
  restoreMemoryEntry,
  saveMemorySection,
  type MemorySection,
} from '../../services/hermes/memory-store'

export async function get(ctx: any) {
  ctx.body = await getMemoryData()
}

export async function listEntries(ctx: any) {
  const { section, scopeType, scopeId, memoryType, status, q, limit } = ctx.query
  const entries = await listMemoryEntries({
    section: typeof section === 'string' ? section as MemorySection : undefined,
    scopeType: typeof scopeType === 'string' ? scopeType : undefined,
    scopeId: typeof scopeId === 'string' ? scopeId : undefined,
    memoryType: typeof memoryType === 'string' ? memoryType : undefined,
    status: typeof status === 'string' ? status : undefined,
    q: typeof q === 'string' ? q : undefined,
    limit: typeof limit === 'string' ? Number(limit) : undefined,
  })
  ctx.body = { entries }
}

export async function policy(ctx: any) {
  ctx.body = await getMemoryPolicy()
}

export async function save(ctx: any) {
  const { section, content } = ctx.request.body as { section?: string; content?: unknown }
  if (!section || typeof content !== 'string') {
    ctx.status = 400
    ctx.body = { error: 'Missing section or content' }
    return
  }
  if (section !== 'memory' && section !== 'user' && section !== 'soul') {
    ctx.status = 400
    ctx.body = { error: 'Section must be "memory", "user", or "soul"' }
    return
  }
  try {
    await saveMemorySection(section as MemorySection, content)
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
}

export async function archiveEntry(ctx: any) {
  const id = String(ctx.params?.id || '').trim()
  if (!id) {
    ctx.status = 400
    ctx.body = { error: 'Missing memory entry id' }
    return
  }

  try {
    const success = await archiveMemoryEntry(id)
    if (!success) {
      ctx.status = 404
      ctx.body = { error: 'Memory entry not found' }
      return
    }

    ctx.body = { success: true, id }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
}

export async function restoreEntry(ctx: any) {
  const id = String(ctx.params?.id || '').trim()
  if (!id) {
    ctx.status = 400
    ctx.body = { error: 'Missing memory entry id' }
    return
  }

  try {
    const success = await restoreMemoryEntry(id)
    if (!success) {
      ctx.status = 404
      ctx.body = { error: 'Memory entry not found' }
      return
    }

    ctx.body = { success: true, id }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
}

export async function archiveExpired(ctx: any) {
  try {
    const archived = await archiveExpiredMemoryEntries()
    ctx.body = { success: true, archived }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
}

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import type { Dirent } from 'fs'
import { dirname, extname, isAbsolute, join, normalize, relative, resolve, sep } from 'path'
import { execFileSync, spawnSync } from 'child_process'
import { getDb } from '../../../db'

export interface ProjectPermissionConfig {
    allowRead?: boolean
    allowWrite?: boolean
    allowCommit?: boolean
    allowPush?: boolean
    pushRequireApproval?: boolean
}

export interface ProjectRecord {
    id: string
    name: string
    description: string
    sourceType: string
    localPath: string
    repoUrl: string
    defaultBranch: string
    currentBranch: string
    gitEnabled: number
    gitAuthType: string
    artifactRootMode: string
    artifactRootPath: string
    createdAt: number
    updatedAt: number
}

export interface RoomProjectBindingRecord {
    id: string
    roomId: string
    projectId: string
    isPrimary: number
    allowRead: number
    allowWrite: number
    allowCommit: number
    allowPush: number
    pushRequireApproval: number
    createdAt: number
    updatedAt: number
}

export interface ProjectTreeEntry {
    name: string
    path: string
    relativePath: string
    type: 'file' | 'directory'
    size: number
    updatedAt: number
}

export interface ProjectFileContentResult {
    relativePath: string
    fileName: string
    content: string
    language: string
}

export interface ProjectGitStatusResult {
    gitEnabled: boolean
    currentBranch: string
    defaultBranch: string
    repoUrl: string
    aheadCount: number
    behindCount: number
    staged: string[]
    modified: string[]
    untracked: string[]
}

export interface ProjectGitBranchResult {
    currentBranch: string
    localBranches: string[]
    remoteBranches: string[]
    defaultBranch: string
}

export interface ProjectGitChangeEntry {
    relativePath: string
    displayPath: string
    kind: 'staged' | 'modified' | 'untracked' | 'mixed' | 'conflicted'
    indexStatus: string
    workTreeStatus: string
    staged: boolean
    modified: boolean
    untracked: boolean
    conflicted: boolean
}

export interface ProjectGitDiffResult extends ProjectGitStatusResult {
    changes: ProjectGitChangeEntry[]
    selectedPath: string
    selectedDisplayPath: string
    selectedKind: ProjectGitChangeEntry['kind'] | ''
    selectedContent: string
    selectedContentMode: 'diff' | 'text' | 'binary' | 'empty'
    selectedTruncated: boolean
}

export interface ProjectOperationLogRecord {
    id: string
    projectId: string
    roomId: string
    operatorType: string
    operatorName: string
    action: string
    status: string
    summary: string
    payloadJson: string
    createdAt: number
}

export interface ProjectRunGitSnapshot {
    projectId: string
    projectName: string
    gitEnabled: boolean
    currentBranch: string
    repoUrl: string
    trackedAt: number
    aheadCount: number
    behindCount: number
    stagedCount: number
    modifiedCount: number
    untrackedCount: number
    changeCount: number
    touchedFiles: string[]
    changes: Array<ProjectGitChangeEntry & {
        previewContent: string
        previewMode: 'diff' | 'text' | 'binary' | 'empty'
        previewTruncated: boolean
    }>
}

export interface ProjectStructureSummary {
    projectRoot: string
    entries: string[]
    manifests: string[]
}

export interface ProjectWriteFileInput {
    relativePath: string
    content: string
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function getProjectDb() {
    return getDb()
}

function ensureAbsolutePath(localPath: string): string {
    const trimmed = String(localPath || '').trim()
    if (!trimmed) throw new Error('localPath is required')
    if (!isAbsolute(trimmed)) throw new Error('localPath must be an absolute path')
    const resolved = resolve(trimmed)
    if (!existsSync(resolved)) throw new Error('Project path does not exist')
    if (!statSync(resolved).isDirectory()) throw new Error('Project path must be a directory')
    return resolved
}

function isGitRepo(projectPath: string): boolean {
    return existsSync(join(projectPath, '.git'))
}

function runGit(projectPath: string, args: string[]): string {
    return execFileSync('git', args, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

function runGitCapture(projectPath: string, args: string[], allowedExitCodes: number[] = [0]): { stdout: string; stderr: string; status: number } {
    const result = spawnSync('git', args, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
    })

    if (result.error) throw result.error

    const status = result.status ?? 0
    const stdout = String(result.stdout || '').trimEnd()
    const stderr = String(result.stderr || '').trim()
    if (!allowedExitCodes.includes(status)) {
        throw new Error(stderr || stdout || `git ${args.join(' ')} failed`)
    }

    return { stdout, stderr, status }
}

function detectGitMetadata(projectPath: string): Pick<ProjectRecord, 'repoUrl' | 'defaultBranch' | 'currentBranch' | 'gitEnabled'> {
    if (!isGitRepo(projectPath)) {
        return {
            repoUrl: '',
            defaultBranch: '',
            currentBranch: '',
            gitEnabled: 0,
        }
    }

    try {
        const currentBranch = runGit(projectPath, ['branch', '--show-current'])
        const repoUrl = runGit(projectPath, ['remote', 'get-url', 'origin'])
        let defaultBranch = ''
        try {
            const symbolic = runGit(projectPath, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
            defaultBranch = symbolic.split('/').pop() || ''
        } catch {
            defaultBranch = currentBranch
        }
        return {
            repoUrl,
            defaultBranch,
            currentBranch,
            gitEnabled: 1,
        }
    } catch {
        return {
            repoUrl: '',
            defaultBranch: '',
            currentBranch: '',
            gitEnabled: 0,
        }
    }
}

function safeProjectPath(projectRoot: string, relativePath = ''): string {
    const root = resolve(projectRoot)
    const target = resolve(root, relativePath || '.')
    const rel = relative(root, target)
    if (rel.startsWith('..') || rel === '..' || normalize(rel).startsWith(`..${sep}`)) {
        throw new Error('Path escapes project root')
    }
    return target
}

function sanitizeProjectRelativePath(relativePath = ''): string {
    return String(relativePath || '')
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, '')
}

function safeParseJson<T>(value: string, fallback: T): T {
    try {
        return JSON.parse(String(value || '')) as T
    } catch {
        return fallback
    }
}

function parseGitRelativePath(rawPath: string): { relativePath: string; displayPath: string } {
    const displayPath = String(rawPath || '').trim()
    const relativePath = displayPath.includes(' -> ')
        ? displayPath.split(' -> ').pop() || displayPath
        : displayPath
    return {
        relativePath: sanitizeProjectRelativePath(relativePath),
        displayPath,
    }
}

function parseGitBranchHeader(header: string, fallbackBranch = ''): { currentBranch: string; aheadCount: number; behindCount: number } {
    const trimmed = String(header || '').trim()
    const currentBranch = trimmed.replace(/^##\s+/, '').split('...')[0]?.trim() || fallbackBranch
    const aheadMatch = trimmed.match(/ahead (\d+)/)
    const behindMatch = trimmed.match(/behind (\d+)/)
    return {
        currentBranch,
        aheadCount: aheadMatch ? Number(aheadMatch[1] || 0) : 0,
        behindCount: behindMatch ? Number(behindMatch[1] || 0) : 0,
    }
}

const GIT_CONFLICT_STATUSES = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])
const PROJECT_GIT_PREVIEW_MAX_BYTES = 64 * 1024
const PROJECT_GIT_PREVIEW_MAX_LINES = 1200

function truncateGitPreview(content: string): { content: string; truncated: boolean } {
    let next = String(content || '')
    let truncated = false

    if (Buffer.byteLength(next, 'utf-8') > PROJECT_GIT_PREVIEW_MAX_BYTES) {
        truncated = true
        next = Buffer.from(next, 'utf-8').subarray(0, PROJECT_GIT_PREVIEW_MAX_BYTES).toString('utf-8')
    }

    const lines = next.split('\n')
    if (lines.length > PROJECT_GIT_PREVIEW_MAX_LINES) {
        truncated = true
        next = lines.slice(0, PROJECT_GIT_PREVIEW_MAX_LINES).join('\n')
    }

    return { content: next.trimEnd(), truncated }
}

function buildProjectGitFilePreview(
    project: ProjectRecord,
    gitState: ReturnType<typeof buildProjectGitStatus>,
    relativePath: string,
): {
    selectedDisplayPath: string
    selectedKind: ProjectGitChangeEntry['kind'] | ''
    selectedContent: string
    selectedContentMode: 'diff' | 'text' | 'binary' | 'empty'
    selectedTruncated: boolean
} {
    const selectedPath = sanitizeProjectRelativePath(relativePath)
    const selectedChange = selectedPath
        ? gitState.changes.find(change => change.relativePath === selectedPath) || null
        : null

    const result: {
        selectedDisplayPath: string
        selectedKind: ProjectGitChangeEntry['kind'] | ''
        selectedContent: string
        selectedContentMode: 'diff' | 'text' | 'binary' | 'empty'
        selectedTruncated: boolean
    } = {
        selectedDisplayPath: selectedChange?.displayPath || selectedPath,
        selectedKind: selectedChange?.kind || '',
        selectedContent: '',
        selectedContentMode: 'empty' as const,
        selectedTruncated: false,
    }

    if (!gitState.gitEnabled || !selectedPath) {
        return result
    }

    const targetPath = safeProjectPath(project.localPath, selectedPath)
    if (selectedChange?.untracked) {
        const buffer = readFileSync(targetPath)
        if (buffer.includes(0)) {
            return {
                ...result,
                selectedContentMode: 'binary',
            }
        }

        const preview = truncateGitPreview(buffer.toString('utf-8'))
        return {
            ...result,
            selectedContent: preview.content,
            selectedContentMode: preview.content ? 'text' : 'empty',
            selectedTruncated: preview.truncated,
        }
    }

    const diffParts: string[] = []
    if (!selectedChange || selectedChange.staged) {
        const stagedDiff = runGitCapture(
            project.localPath,
            ['diff', '--cached', '--no-ext-diff', '--', selectedPath],
            [0, 1],
        ).stdout.trim()
        if (stagedDiff) diffParts.push(stagedDiff)
    }

    if (!selectedChange || selectedChange.modified) {
        const unstagedDiff = runGitCapture(
            project.localPath,
            ['diff', '--no-ext-diff', '--', selectedPath],
            [0, 1],
        ).stdout.trim()
        if (unstagedDiff) diffParts.push(unstagedDiff)
    }

    const preview = truncateGitPreview(diffParts.filter(Boolean).join('\n\n'))
    return {
        ...result,
        selectedContent: preview.content,
        selectedContentMode: preview.content ? 'diff' : 'empty',
        selectedTruncated: preview.truncated,
    }
}

function buildProjectGitStatus(project: ProjectRecord): ProjectGitStatusResult & { changes: ProjectGitChangeEntry[] } {
    if (!project.gitEnabled) {
        return {
            gitEnabled: false,
            currentBranch: '',
            defaultBranch: '',
            repoUrl: '',
            aheadCount: 0,
            behindCount: 0,
            staged: [],
            modified: [],
            untracked: [],
            changes: [],
        }
    }

    const porcelain = runGit(project.localPath, ['status', '--short', '--branch'])
    const lines = porcelain.split('\n').filter(Boolean)
    const branchSummary = parseGitBranchHeader(lines.shift() || '', project.currentBranch)
    const staged: string[] = []
    const modified: string[] = []
    const untracked: string[] = []
    const changes: ProjectGitChangeEntry[] = []

    for (const line of lines) {
        const status = line.slice(0, 2)
        const pathInfo = parseGitRelativePath(line.slice(3))
        if (!pathInfo.relativePath) continue

        if (status === '??') {
            untracked.push(pathInfo.relativePath)
            changes.push({
                relativePath: pathInfo.relativePath,
                displayPath: pathInfo.displayPath,
                kind: 'untracked',
                indexStatus: '?',
                workTreeStatus: '?',
                staged: false,
                modified: false,
                untracked: true,
                conflicted: false,
            })
            continue
        }

        const indexStatus = status[0] || ' '
        const workTreeStatus = status[1] || ' '
        const isConflicted = GIT_CONFLICT_STATUSES.has(`${indexStatus}${workTreeStatus}`)
        const isStaged = indexStatus !== ' '
        const isModified = workTreeStatus !== ' '

        if (isStaged) staged.push(pathInfo.relativePath)
        if (isModified) modified.push(pathInfo.relativePath)

        changes.push({
            relativePath: pathInfo.relativePath,
            displayPath: pathInfo.displayPath,
            kind: isConflicted
                ? 'conflicted'
                : isStaged && isModified
                    ? 'mixed'
                    : isStaged
                        ? 'staged'
                        : 'modified',
            indexStatus,
            workTreeStatus,
            staged: isStaged,
            modified: isModified,
            untracked: false,
            conflicted: isConflicted,
        })
    }

    return {
        gitEnabled: true,
        currentBranch: branchSummary.currentBranch,
        defaultBranch: project.defaultBranch,
        repoUrl: project.repoUrl,
        aheadCount: branchSummary.aheadCount,
        behindCount: branchSummary.behindCount,
        staged,
        modified,
        untracked,
        changes,
    }
}

function detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    if (ext === '.ts' || ext === '.tsx') return 'typescript'
    if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'javascript'
    if (ext === '.json') return 'json'
    if (ext === '.md') return 'markdown'
    if (ext === '.yml' || ext === '.yaml') return 'yaml'
    if (ext === '.py') return 'python'
    if (ext === '.java') return 'java'
    if (ext === '.xml') return 'xml'
    if (ext === '.css' || ext === '.scss' || ext === '.less') return 'css'
    if (ext === '.html') return 'html'
    if (ext === '.sh') return 'bash'
    return 'plaintext'
}

function isHighRiskConfigFile(relativePath: string): boolean {
    const ext = extname(relativePath).toLowerCase()
    return ['.yml', '.yaml', '.properties', '.xml', '.json'].includes(ext)
}

function assertSafeExistingFileWrite(projectRoot: string, relativePath: string, nextContent: string): void {
    const targetPath = safeProjectPath(projectRoot, relativePath)
    if (!existsSync(targetPath) || !statSync(targetPath).isFile()) return
    if (!isHighRiskConfigFile(relativePath)) return

    const previousContent = readFileSync(targetPath, 'utf-8')
    const previousLines = previousContent.split(/\r?\n/).filter(line => line.trim()).length
    const nextLines = String(nextContent || '').split(/\r?\n/).filter(line => line.trim()).length
    const removedLines = previousLines - nextLines
    const shrinkRatio = previousContent.length > 0 ? nextContent.length / previousContent.length : 1

    if (previousLines >= 20 && removedLines >= 8 && shrinkRatio < 0.85) {
        throw new Error(
            `Refusing risky overwrite of existing config file ${relativePath}; preserve the original content and make a minimal additive change instead.`,
        )
    }
}

const PROJECT_TREE_IGNORED_DIRS = new Set([
    '.git',
    '.hermes',
    '.idea',
    '.vscode',
    'node_modules',
    'uni_modules',
    'dist',
    'build',
    'target',
    'coverage',
])

const PROJECT_MANIFEST_NAMES = new Set([
    'package.json',
    'pom.xml',
    'build.gradle',
    'settings.gradle',
    'vite.config.js',
    'vite.config.ts',
    'vue.config.js',
    'README.md',
])

function summarizeProjectTree(projectRoot: string, maxEntries = 120): ProjectStructureSummary {
    const entries: string[] = []
    const manifests: string[] = []

    const walk = (dir: string, depth: number) => {
        if (entries.length >= maxEntries || depth > 4) return
        let dirents: Dirent[]
        try {
            dirents = readdirSync(dir, { withFileTypes: true }) as Dirent[]
        } catch {
            return
        }

        const sorted = dirents
            .filter(entry => !PROJECT_TREE_IGNORED_DIRS.has(entry.name))
            .sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
                return a.name.localeCompare(b.name)
            })

        for (const entry of sorted) {
            if (entries.length >= maxEntries) return
            const fullPath = join(dir, entry.name)
            const rel = sanitizeProjectRelativePath(relative(projectRoot, fullPath))
            if (!rel) continue

            if (entry.isDirectory()) {
                entries.push(`${rel}/`)
                walk(fullPath, depth + 1)
                continue
            }

            if (PROJECT_MANIFEST_NAMES.has(entry.name)) {
                entries.push(rel)
                manifests.push(rel)
            }
        }
    }

    walk(projectRoot, 0)
    return {
        projectRoot,
        entries,
        manifests,
    }
}

export class ProjectService {
    private db() {
        return getProjectDb()
    }

    getProject(projectId: string): ProjectRecord | null {
        return (this.db()?.prepare(
            'SELECT id, name, description, sourceType, localPath, repoUrl, defaultBranch, currentBranch, gitEnabled, gitAuthType, artifactRootMode, artifactRootPath, createdAt, updatedAt FROM gc_projects WHERE id = ?'
        ).get(projectId) as ProjectRecord | undefined) ?? null
    }

    getProjectByLocalPath(localPath: string): ProjectRecord | null {
        return (this.db()?.prepare(
            'SELECT id, name, description, sourceType, localPath, repoUrl, defaultBranch, currentBranch, gitEnabled, gitAuthType, artifactRootMode, artifactRootPath, createdAt, updatedAt FROM gc_projects WHERE localPath = ?'
        ).get(localPath) as ProjectRecord | undefined) ?? null
    }

    listProjects(): ProjectRecord[] {
        return ((this.db()?.prepare(
            'SELECT id, name, description, sourceType, localPath, repoUrl, defaultBranch, currentBranch, gitEnabled, gitAuthType, artifactRootMode, artifactRootPath, createdAt, updatedAt FROM gc_projects ORDER BY updatedAt DESC'
        ).all() || []) as unknown) as ProjectRecord[]
    }

    bindLocalProject(input: {
        name?: string
        description?: string
        localPath: string
        roomId?: string
        permissions?: ProjectPermissionConfig
    }): { project: ProjectRecord; binding: RoomProjectBindingRecord | null } {
        const projectPath = ensureAbsolutePath(input.localPath)
        const now = Date.now()
        const git = detectGitMetadata(projectPath)
        const existing = this.getProjectByLocalPath(projectPath)
        const nextId = existing?.id || generateId()
        const name = String(input.name || '').trim() || projectPath.split('/').filter(Boolean).pop() || 'project'
        const description = String(input.description || '').trim()

        this.db()?.prepare(
            `INSERT INTO gc_projects (id, name, description, sourceType, localPath, repoUrl, defaultBranch, currentBranch, gitEnabled, gitAuthType, artifactRootMode, artifactRootPath, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               description = excluded.description,
               sourceType = excluded.sourceType,
               localPath = excluded.localPath,
               repoUrl = excluded.repoUrl,
               defaultBranch = excluded.defaultBranch,
               currentBranch = excluded.currentBranch,
               gitEnabled = excluded.gitEnabled,
               gitAuthType = excluded.gitAuthType,
               artifactRootMode = excluded.artifactRootMode,
               artifactRootPath = excluded.artifactRootPath,
               updatedAt = excluded.updatedAt`
        ).run(
            nextId,
            name,
            description,
            'local',
            projectPath,
            git.repoUrl,
            git.defaultBranch,
            git.currentBranch,
            git.gitEnabled,
            'none',
            'project-relative',
            '.hermes/group-chat-artifacts/${roomId}',
            existing?.createdAt || now,
            now,
        )

        const project = this.getProject(nextId)!
        let binding: RoomProjectBindingRecord | null = null
        if (input.roomId) {
            binding = this.bindRoomProject(input.roomId, nextId, input.permissions)
        }
        this.appendOperationLog({
            projectId: project.id,
            roomId: input.roomId || '',
            operatorType: 'user',
            operatorName: '管理员',
            action: 'bind',
            status: 'success',
            summary: `Bound local project ${project.name}`,
            payloadJson: JSON.stringify({ localPath: projectPath }),
        })
        return { project, binding }
    }

    bindRoomProject(roomId: string, projectId: string, permissions?: ProjectPermissionConfig): RoomProjectBindingRecord {
        const now = Date.now()
        const existing = this.getRoomPrimaryProjectBinding(roomId)
        this.db()?.prepare('UPDATE gc_room_projects SET isPrimary = 0, updatedAt = ? WHERE roomId = ?').run(now, roomId)
        const bindingId = existing?.projectId === projectId ? existing.id : generateId()
        this.db()?.prepare(
            `INSERT INTO gc_room_projects (id, roomId, projectId, isPrimary, allowRead, allowWrite, allowCommit, allowPush, pushRequireApproval, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               roomId = excluded.roomId,
               projectId = excluded.projectId,
               isPrimary = excluded.isPrimary,
               allowRead = excluded.allowRead,
               allowWrite = excluded.allowWrite,
               allowCommit = excluded.allowCommit,
               allowPush = excluded.allowPush,
               pushRequireApproval = excluded.pushRequireApproval,
               updatedAt = excluded.updatedAt`
        ).run(
            bindingId,
            roomId,
            projectId,
            1,
            permissions?.allowRead === false ? 0 : 1,
            permissions?.allowWrite ? 1 : 0,
            permissions?.allowCommit ? 1 : 0,
            permissions?.allowPush ? 1 : 0,
            permissions?.pushRequireApproval === false ? 0 : 1,
            existing?.createdAt || now,
            now,
        )
        return this.getRoomPrimaryProjectBinding(roomId)!
    }

    getRoomPrimaryProjectBinding(roomId: string): RoomProjectBindingRecord | null {
        return (this.db()?.prepare(
            'SELECT id, roomId, projectId, isPrimary, allowRead, allowWrite, allowCommit, allowPush, pushRequireApproval, createdAt, updatedAt FROM gc_room_projects WHERE roomId = ? AND isPrimary = 1 ORDER BY updatedAt DESC LIMIT 1'
        ).get(roomId) as RoomProjectBindingRecord | undefined) ?? null
    }

    getRoomPrimaryProject(roomId: string): { project: ProjectRecord; binding: RoomProjectBindingRecord } | null {
        const binding = this.getRoomPrimaryProjectBinding(roomId)
        if (!binding) return null
        const project = this.getProject(binding.projectId)
        if (!project) return null
        return { project, binding }
    }

    syncRoomArtifactToProject(roomId: string, artifactRelativePath: string, content: string): { projectId: string; relativePath: string } | null {
        const roomProject = this.getRoomPrimaryProject(roomId)
        if (!roomProject) return null
        if (!roomProject.binding.allowWrite) return null

        const baseTemplate = sanitizeProjectRelativePath(roomProject.project.artifactRootPath || '.hermes/group-chat-artifacts/${roomId}')
        const baseRelativePath = sanitizeProjectRelativePath(baseTemplate.replace(/\$\{roomId\}/g, roomId))
        const artifactRelative = sanitizeProjectRelativePath(artifactRelativePath)
        const targetRelativePath = sanitizeProjectRelativePath(baseRelativePath ? `${baseRelativePath}/${artifactRelative}` : artifactRelative)
        if (!targetRelativePath) return null

        const targetPath = safeProjectPath(roomProject.project.localPath, targetRelativePath)
        mkdirSync(dirname(targetPath), { recursive: true })
        writeFileSync(targetPath, content, 'utf-8')

        this.appendOperationLog({
            projectId: roomProject.project.id,
            roomId,
            operatorType: 'system',
            operatorName: 'workflow-artifact-sync',
            action: 'write',
            status: 'success',
            summary: `Synced workflow artifact to ${targetRelativePath}`,
            payloadJson: JSON.stringify({ artifactRelativePath, targetRelativePath }),
        })

        return {
            projectId: roomProject.project.id,
            relativePath: targetRelativePath,
        }
    }

    listProjectFiles(projectId: string, relativePath = ''): ProjectTreeEntry[] {
        const project = this.getProject(projectId)
        if (!project) throw new Error('Project not found')
        const targetDir = safeProjectPath(project.localPath, relativePath)
        const entries = readdirSync(targetDir, { withFileTypes: true })
        return entries
            .filter(entry => !entry.name.startsWith('.git'))
            .map(entry => {
                const fullPath = join(targetDir, entry.name)
                const stat = statSync(fullPath)
                const rel = relative(project.localPath, fullPath)
                return {
                    name: entry.name,
                    path: rel,
                    relativePath: rel,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: entry.isDirectory() ? 0 : stat.size,
                    updatedAt: stat.mtimeMs,
                } as ProjectTreeEntry
            })
            .sort((a, b) => {
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                return a.name.localeCompare(b.name)
            })
    }

    readProjectFile(projectId: string, relativePath: string): ProjectFileContentResult {
        const project = this.getProject(projectId)
        if (!project) throw new Error('Project not found')
        if (!relativePath) throw new Error('path is required')
        const targetPath = safeProjectPath(project.localPath, relativePath)
        const stat = statSync(targetPath)
        if (!stat.isFile()) throw new Error('Target is not a file')
        const content = readFileSync(targetPath, 'utf-8')
        return {
            relativePath,
            fileName: relativePath.split('/').pop() || relativePath,
            content,
            language: detectLanguage(targetPath),
        }
    }

    getRoomPrimaryProjectStructure(roomId: string, maxEntries = 120): ProjectStructureSummary | null {
        const roomProject = this.getRoomPrimaryProject(roomId)
        if (!roomProject) return null
        return summarizeProjectTree(roomProject.project.localPath, maxEntries)
    }

    writeProjectFiles(
        roomId: string,
        operatorName: string,
        files: ProjectWriteFileInput[],
    ): Array<{ relativePath: string; fileName: string }> {
        const roomProject = this.getRoomPrimaryProject(roomId)
        if (!roomProject) throw new Error('Room project not bound')
        if (!roomProject.binding.allowWrite) throw new Error('Room project is read-only')
        if (!Array.isArray(files) || files.length === 0) throw new Error('No project files to write')

        const pendingWrites = files
            .map(file => ({
                relativePath: sanitizeProjectRelativePath(file.relativePath),
                content: String(file.content || ''),
            }))
            .filter(file => Boolean(file.relativePath))

        for (const file of pendingWrites) {
            safeProjectPath(roomProject.project.localPath, file.relativePath)
            assertSafeExistingFileWrite(roomProject.project.localPath, file.relativePath, file.content)
        }

        const written: Array<{ relativePath: string; fileName: string }> = []
        for (const file of pendingWrites) {
            const relativePath = sanitizeProjectRelativePath(file.relativePath)
            if (!relativePath) continue
            const targetPath = safeProjectPath(roomProject.project.localPath, relativePath)
            mkdirSync(dirname(targetPath), { recursive: true })
            writeFileSync(targetPath, file.content, 'utf-8')
            written.push({
                relativePath,
                fileName: relativePath.split('/').pop() || relativePath,
            })
        }

        if (written.length === 0) {
            throw new Error('No valid project files to write')
        }

        this.appendOperationLog({
            projectId: roomProject.project.id,
            roomId,
            operatorType: 'agent',
            operatorName,
            action: 'write',
            status: 'success',
            summary: `Updated ${written.length} project file(s)`,
            payloadJson: JSON.stringify({ files: written }),
        })

        return written
    }

    getProjectGitStatus(projectId: string): ProjectGitStatusResult {
        const project = this.getProject(projectId)
        if (!project) throw new Error('Project not found')
        const { changes: _changes, ...status } = buildProjectGitStatus(project)
        return status
    }

    getProjectGitBranches(projectId: string): ProjectGitBranchResult {
        const project = this.getProject(projectId)
        if (!project) throw new Error('Project not found')
        if (!project.gitEnabled) {
            return {
                currentBranch: '',
                localBranches: [],
                remoteBranches: [],
                defaultBranch: '',
            }
        }
        const locals = runGit(project.localPath, ['branch', '--format=%(refname:short)'])
            .split('\n')
            .map(v => v.trim())
            .filter(Boolean)
        const remotes = runGit(project.localPath, ['branch', '-r', '--format=%(refname:short)'])
            .split('\n')
            .map(v => v.trim())
            .filter(Boolean)
        return {
            currentBranch: project.currentBranch,
            localBranches: locals,
            remoteBranches: remotes,
            defaultBranch: project.defaultBranch,
        }
    }

    getProjectGitDiff(projectId: string, relativePath = ''): ProjectGitDiffResult {
        const project = this.getProject(projectId)
        if (!project) throw new Error('Project not found')

        const gitState = buildProjectGitStatus(project)
        const selectedPath = sanitizeProjectRelativePath(relativePath)
        const selectedChange = selectedPath
            ? gitState.changes.find(change => change.relativePath === selectedPath) || null
            : null

        const result: ProjectGitDiffResult = {
            gitEnabled: gitState.gitEnabled,
            currentBranch: gitState.currentBranch,
            defaultBranch: gitState.defaultBranch,
            repoUrl: gitState.repoUrl,
            aheadCount: gitState.aheadCount,
            behindCount: gitState.behindCount,
            staged: gitState.staged,
            modified: gitState.modified,
            untracked: gitState.untracked,
            changes: gitState.changes,
            selectedPath,
            selectedDisplayPath: selectedChange?.displayPath || selectedPath,
            selectedKind: selectedChange?.kind || '',
            selectedContent: '',
            selectedContentMode: 'empty',
            selectedTruncated: false,
        }

        if (!gitState.gitEnabled || !selectedPath) {
            return result
        }
        const preview = buildProjectGitFilePreview(project, gitState, selectedPath)
        result.selectedDisplayPath = preview.selectedDisplayPath
        result.selectedKind = preview.selectedKind
        result.selectedContent = preview.selectedContent
        result.selectedContentMode = preview.selectedContentMode
        result.selectedTruncated = preview.selectedTruncated
        return result
    }

    listProjectOperationLogs(projectId: string, roomId: string, startedAt = 0): ProjectOperationLogRecord[] {
        return (this.db()?.prepare(
            `SELECT id, projectId, roomId, operatorType, operatorName, action, status, summary, payloadJson, createdAt
             FROM gc_project_operation_logs
             WHERE projectId = ? AND roomId = ? AND createdAt >= ?
             ORDER BY createdAt DESC`
        ).all(projectId, roomId, startedAt) || []) as unknown as ProjectOperationLogRecord[]
    }

    getRoomProjectRunGitSnapshot(roomId: string, startedAt = 0): ProjectRunGitSnapshot | null {
        const roomProject = this.getRoomPrimaryProject(roomId)
        if (!roomProject) return null

        const gitState = buildProjectGitStatus(roomProject.project)
        const logs = this.listProjectOperationLogs(roomProject.project.id, roomId, startedAt)
        const touchedFiles = new Set<string>()

        for (const log of logs) {
            if (log.status !== 'success') continue
            if (log.action !== 'write') continue

            const payload = safeParseJson<Record<string, any>>(log.payloadJson, {})
            const files = Array.isArray(payload.files) ? payload.files : []
            for (const file of files) {
                const relativePath = sanitizeProjectRelativePath(String(file?.relativePath || ''))
                if (relativePath) touchedFiles.add(relativePath)
            }

            const targetRelativePath = sanitizeProjectRelativePath(String(payload.targetRelativePath || ''))
            if (targetRelativePath) touchedFiles.add(targetRelativePath)
        }

        return {
            projectId: roomProject.project.id,
            projectName: roomProject.project.name || '',
            gitEnabled: gitState.gitEnabled,
            currentBranch: gitState.currentBranch,
            repoUrl: gitState.repoUrl,
            trackedAt: Date.now(),
            aheadCount: gitState.aheadCount,
            behindCount: gitState.behindCount,
            stagedCount: gitState.staged.length,
            modifiedCount: gitState.modified.length,
            untrackedCount: gitState.untracked.length,
            changeCount: gitState.changes.length,
            touchedFiles: Array.from(touchedFiles).sort((left, right) => left.localeCompare(right)),
            changes: gitState.changes.map(change => {
                const preview = buildProjectGitFilePreview(roomProject.project, gitState, change.relativePath)
                return {
                    ...change,
                    previewContent: preview.selectedContent,
                    previewMode: preview.selectedContentMode,
                    previewTruncated: preview.selectedTruncated,
                }
            }),
        }
    }

    appendOperationLog(input: {
        projectId: string
        roomId?: string
        operatorType?: string
        operatorName?: string
        action: string
        status?: string
        summary?: string
        payloadJson?: string
    }): void {
        this.db()?.prepare(
            `INSERT INTO gc_project_operation_logs (id, projectId, roomId, operatorType, operatorName, action, status, summary, payloadJson, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            generateId(),
            input.projectId,
            input.roomId || '',
            input.operatorType || 'user',
            input.operatorName || '',
            input.action,
            input.status || 'success',
            input.summary || '',
            input.payloadJson || '{}',
            Date.now(),
        )
    }
}

export const projectService = new ProjectService()

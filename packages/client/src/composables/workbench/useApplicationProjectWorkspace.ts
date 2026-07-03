import { computed, ref, watch, type Ref } from 'vue'
import { useGroupChatStore } from '@/stores/hermes/group-chat'
import type {
  ApplicationProjectExplorerState,
  ApplicationProjectSummary,
} from '@/types/workbench/application'

function toBool(value: number | boolean | undefined): boolean {
  return !!value
}

export function useApplicationProjectWorkspace(applicationId: Ref<string>) {
  const groupChatStore = useGroupChatStore()

  const isLoading = ref(false)
  const isBinding = ref(false)
  const selectedExistingProjectId = ref<string | null>(null)
  const localProjectName = ref('')
  const localProjectDescription = ref('')
  const localProjectPath = ref('')

  async function ensureRoomReady() {
    const roomId = applicationId.value
    if (!roomId) return

    if (!groupChatStore.connected) {
      groupChatStore.connect()
    }

    await groupChatStore.loadRooms()
    if (groupChatStore.currentRoomId !== roomId) {
      await groupChatStore.joinRoom(roomId)
      await groupChatStore.loadAvailableProjects()
      return
    }

    await Promise.all([
      groupChatStore.loadRoomProject(roomId),
      groupChatStore.loadAvailableProjects(),
    ])
  }

  async function initialize() {
    if (!applicationId.value) return
    isLoading.value = true
    try {
      await ensureRoomReady()
      hydrateProjectForm()
    } finally {
      isLoading.value = false
    }
  }

  function hydrateProjectForm() {
    const project = groupChatStore.currentProject?.project
    selectedExistingProjectId.value = project?.id || null
    localProjectName.value = project?.name || ''
    localProjectDescription.value = project?.description || ''
    localProjectPath.value = project?.localPath || ''
  }

  const currentProject = computed<ApplicationProjectSummary>(() => {
    const current = groupChatStore.currentProject
    if (!current) {
      return {
        projectId: null,
        bindingId: null,
        name: null,
        description: null,
        sourceType: null,
        localPath: null,
        repoUrl: null,
        gitEnabled: false,
        currentBranch: null,
        defaultBranch: null,
        permissions: null,
      }
    }

    return {
      projectId: current.project.id,
      bindingId: current.binding.id,
      name: current.project.name || null,
      description: current.project.description || null,
      sourceType: current.project.sourceType || null,
      localPath: current.project.localPath || null,
      repoUrl: current.project.repoUrl || null,
      gitEnabled: toBool(current.project.gitEnabled),
      currentBranch: current.project.currentBranch || null,
      defaultBranch: current.project.defaultBranch || null,
      permissions: {
        allowRead: toBool(current.binding.allowRead),
        allowWrite: toBool(current.binding.allowWrite),
        allowCommit: toBool(current.binding.allowCommit),
        allowPush: toBool(current.binding.allowPush),
        pushRequireApproval: toBool(current.binding.pushRequireApproval),
      },
    }
  })

  const explorer = computed<ApplicationProjectExplorerState>(() => ({
    currentPath: groupChatStore.projectCurrentPath || '',
    entries: groupChatStore.projectEntries.map(entry => ({
      name: entry.name,
      path: entry.path,
      relativePath: entry.relativePath,
      type: entry.type,
      size: entry.size,
      updatedAt: entry.updatedAt,
    })),
    currentFile: groupChatStore.projectCurrentFile
      ? {
          relativePath: groupChatStore.projectCurrentFile.relativePath,
          fileName: groupChatStore.projectCurrentFile.fileName,
          content: groupChatStore.projectCurrentFile.content,
          language: groupChatStore.projectCurrentFile.language,
        }
      : null,
    gitStatus: groupChatStore.projectGitStatus
      ? {
          gitEnabled: groupChatStore.projectGitStatus.gitEnabled,
          currentBranch: groupChatStore.projectGitStatus.currentBranch,
          defaultBranch: groupChatStore.projectGitStatus.defaultBranch,
          repoUrl: groupChatStore.projectGitStatus.repoUrl,
          aheadCount: groupChatStore.projectGitStatus.aheadCount,
          behindCount: groupChatStore.projectGitStatus.behindCount,
          staged: groupChatStore.projectGitStatus.staged,
          modified: groupChatStore.projectGitStatus.modified,
          untracked: groupChatStore.projectGitStatus.untracked,
        }
      : null,
    gitBranches: groupChatStore.projectGitBranches
      ? {
          currentBranch: groupChatStore.projectGitBranches.currentBranch,
          localBranches: groupChatStore.projectGitBranches.localBranches,
          remoteBranches: groupChatStore.projectGitBranches.remoteBranches,
          defaultBranch: groupChatStore.projectGitBranches.defaultBranch,
        }
      : null,
  }))

  const availableProjectOptions = computed(() =>
    groupChatStore.availableProjects.map(project => ({
      label: project.repoUrl
        ? `${project.name} · ${project.repoUrl}`
        : `${project.name} · ${project.localPath}`,
      value: project.id,
    })),
  )

  const readiness = computed(() => ({
    hasProject: !!currentProject.value.projectId,
    hasGit: currentProject.value.gitEnabled,
    canRead: !!currentProject.value.permissions?.allowRead,
    canWrite: !!currentProject.value.permissions?.allowWrite,
  }))

  async function bindExistingProject() {
    if (!applicationId.value || !selectedExistingProjectId.value) return
    isBinding.value = true
    try {
      await groupChatStore.attachExistingProjectToRoom(
        applicationId.value,
        selectedExistingProjectId.value,
        {
          allowRead: true,
          allowWrite: true,
          allowCommit: false,
          allowPush: false,
          pushRequireApproval: true,
        },
      )
      hydrateProjectForm()
    } finally {
      isBinding.value = false
    }
  }

  async function bindLocalProject() {
    if (!applicationId.value || !localProjectPath.value.trim()) return
    isBinding.value = true
    try {
      await groupChatStore.attachLocalProjectToRoom(applicationId.value, {
        name: localProjectName.value.trim() || undefined,
        description: localProjectDescription.value.trim() || undefined,
        localPath: localProjectPath.value.trim(),
        permissions: {
          allowRead: true,
          allowWrite: true,
          allowCommit: false,
          allowPush: false,
          pushRequireApproval: true,
        },
      })
      hydrateProjectForm()
    } finally {
      isBinding.value = false
    }
  }

  async function openProjectPath(path: string, type: 'file' | 'directory') {
    const projectId = currentProject.value.projectId
    if (!projectId) return
    if (type === 'directory') {
      await groupChatStore.loadProjectFiles(projectId, path)
      return
    }
    await groupChatStore.openProjectFile(projectId, path)
  }

  async function openProjectParent() {
    const projectId = currentProject.value.projectId
    if (!projectId) return
    const current = groupChatStore.projectCurrentPath || ''
    const next = current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : ''
    await groupChatStore.loadProjectFiles(projectId, next)
  }

  async function refreshGitSummary() {
    const projectId = currentProject.value.projectId
    if (!projectId) return
    await Promise.all([
      groupChatStore.loadProjectGitStatus(projectId),
      groupChatStore.loadProjectGitBranches(projectId),
    ])
  }

  watch(applicationId, () => {
    initialize().catch(() => {
      // Surface via UI state rather than throwing during watchers.
    })
  }, { immediate: true })

  return {
    isLoading,
    isBinding,
    selectedExistingProjectId,
    localProjectName,
    localProjectDescription,
    localProjectPath,
    currentProject,
    explorer,
    readiness,
    availableProjectOptions,
    initialize,
    bindExistingProject,
    bindLocalProject,
    openProjectPath,
    openProjectParent,
    refreshGitSummary,
  }
}

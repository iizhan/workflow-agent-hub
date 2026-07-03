import { computed, ref } from 'vue'
import { fetchMemory, fetchSkills, type MemoryData, type SkillInfo, type SkillsData } from '@/api/hermes/skills'
import { useAppStore } from '@/stores/hermes/app'
import { useProfilesStore } from '@/stores/hermes/profiles'

function flattenSkills(data: SkillsData | null): SkillInfo[] {
  if (!data) return []
  return [
    ...data.categories.flatMap(category => category.skills),
    ...data.archived,
  ]
}

function formatSectionLength(value?: string | null): number {
  return String(value || '').trim().length
}

export function useResourceBaselineSummary() {
  const appStore = useAppStore()
  const profilesStore = useProfilesStore()

  const loading = ref(false)
  const skillsData = ref<SkillsData | null>(null)
  const memoryData = ref<MemoryData | null>(null)

  const activeProfileName = computed(() =>
    profilesStore.activeProfile?.name || profilesStore.activeProfileName || 'default',
  )

  const activeProfileDetail = computed(() => {
    const name = activeProfileName.value
    return name ? profilesStore.detailMap[name] || null : null
  })

  const defaultModelLabel = computed(() => {
    const provider = String(appStore.selectedProvider || '').trim()
    const model = String(appStore.selectedModel || '').trim()
    if (!model) return 'Not configured'
    return provider ? `${model} (${provider})` : model
  })

  const hasDefaultModel = computed(() =>
    !!String(appStore.selectedModel || '').trim(),
  )

  const skillsSummary = computed(() => {
    const allSkills = flattenSkills(skillsData.value)
    return {
      total: allSkills.length,
      enabled: allSkills.filter(skill => skill.enabled !== false).length,
      pinned: allSkills.filter(skill => !!skill.pinned).length,
      modified: allSkills.filter(skill => !!skill.modified).length,
      local: allSkills.filter(skill => skill.source === 'local').length,
      builtin: allSkills.filter(skill => skill.source === 'builtin').length,
      hub: allSkills.filter(skill => skill.source === 'hub').length,
    }
  })

  const memorySummary = computed(() => {
    const data = memoryData.value
    const sectionLengths = {
      memory: formatSectionLength(data?.memory),
      user: formatSectionLength(data?.user),
      soul: formatSectionLength(data?.soul),
    }
    const latestUpdatedAt = Math.max(
      data?.memory_mtime || 0,
      data?.user_mtime || 0,
      data?.soul_mtime || 0,
    ) || null

    return {
      configuredSections: Object.values(sectionLengths).filter(value => value > 0).length,
      sectionLengths,
      latestUpdatedAt,
    }
  })

  async function load() {
    loading.value = true
    try {
      const [skillsResult, memoryResult] = await Promise.all([
        fetchSkills(),
        fetchMemory(),
        profilesStore.fetchProfiles(),
        appStore.loadModels(),
      ])

      skillsData.value = skillsResult
      memoryData.value = memoryResult

      if (activeProfileName.value) {
        await profilesStore.fetchProfileDetail(activeProfileName.value)
      }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    appStore,
    profilesStore,
    activeProfileName,
    activeProfileDetail,
    defaultModelLabel,
    hasDefaultModel,
    skillsData,
    memoryData,
    skillsSummary,
    memorySummary,
    load,
  }
}

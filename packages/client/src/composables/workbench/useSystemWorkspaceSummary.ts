import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/hermes/app'
import { useGatewayStore } from '@/stores/hermes/gateways'
import { useModelsStore } from '@/stores/hermes/models'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useUsageStore } from '@/stores/hermes/usage'

export function useSystemWorkspaceSummary() {
  const appStore = useAppStore()
  const gatewayStore = useGatewayStore()
  const modelsStore = useModelsStore()
  const profilesStore = useProfilesStore()
  const usageStore = useUsageStore()

  const loading = ref(false)

  const activeProfileName = computed(() =>
    profilesStore.activeProfile?.name || profilesStore.activeProfileName || 'default',
  )

  const activeProfileDetail = computed(() => {
    const name = activeProfileName.value
    return name ? profilesStore.detailMap[name] || null : null
  })

  const runningGateways = computed(() =>
    gatewayStore.gateways.filter(gateway => gateway.running),
  )

  const failingGateways = computed(() =>
    gatewayStore.gateways.filter(gateway => !!gateway.lastError),
  )

  const enabledProviders = computed(() =>
    modelsStore.providers.filter(provider => !provider.user_disabled),
  )

  const enabledModelCount = computed(() =>
    enabledProviders.value.reduce((total, provider) => {
      return total + provider.models.filter(model => !provider.model_meta?.[model]?.disabled).length
    }, 0),
  )

  const activeDefaultModelLabel = computed(() => {
    const model = String(appStore.selectedModel || '').trim()
    const provider = String(appStore.selectedProvider || '').trim()
    if (!model) return 'Not configured'
    return provider ? `${model} (${provider})` : model
  })

  const hasDefaultModel = computed(() =>
    !!String(appStore.selectedModel || '').trim(),
  )

  const usageSummary = computed(() => ({
    sessions: usageStore.totalSessions,
    totalTokens: usageStore.totalTokens,
    cacheHitRate: usageStore.cacheHitRate,
    estimatedCost: usageStore.estimatedCost,
  }))

  async function load() {
    loading.value = true
    try {
      await Promise.all([
        appStore.checkConnection(),
        appStore.loadModels(),
        gatewayStore.fetchStatus(),
        modelsStore.fetchProviders(),
        profilesStore.fetchProfiles(),
        usageStore.loadSessions(30),
      ])

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
    gatewayStore,
    modelsStore,
    profilesStore,
    usageStore,
    activeProfileName,
    activeProfileDetail,
    runningGateways,
    failingGateways,
    enabledProviders,
    enabledModelCount,
    activeDefaultModelLabel,
    hasDefaultModel,
    usageSummary,
    load,
  }
}

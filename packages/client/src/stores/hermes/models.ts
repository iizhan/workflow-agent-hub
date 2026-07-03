import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as systemApi from '@/api/hermes/system'
import type { AvailableModelGroup, CustomProvider } from '@/api/hermes/system'
import { useAppStore } from './app'

export const useModelsStore = defineStore('models', () => {
  const providers = ref<AvailableModelGroup[]>([])
  const allProviders = ref<AvailableModelGroup[]>([])
  const defaultModel = ref('')
  const loading = ref(false)

  const customProviders = computed(() =>
    providers.value.filter(g => g.provider.startsWith('custom:')),
  )

  const builtinProviders = computed(() =>
    providers.value.filter(g => !g.provider.startsWith('custom:')),
  )

  const allModels = computed(() =>
    providers.value.flatMap(g =>
      g.models.map(m => ({
        id: m,
        provider: g.provider,
        label: g.label,
        base_url: g.base_url,
        isDefault: m === defaultModel.value,
      })),
    ),
  )

  async function fetchProviders() {
    loading.value = true
    try {
      const res = await systemApi.fetchAvailableModels()
      providers.value = res.groups
      allProviders.value = res.allProviders
      defaultModel.value = res.default
    } catch (err) {
      console.error('Failed to fetch providers:', err)
    } finally {
      loading.value = false
    }
  }

  async function setDefaultModel(modelId: string, provider: string) {
    await systemApi.updateDefaultModel({ default: modelId, provider })
    defaultModel.value = modelId
    const appStore = useAppStore()
    appStore.loadModels()
  }

  async function setModelEnabled(provider: string, model: string, enabled: boolean) {
    await systemApi.updateModelEnabled(provider, model, enabled)
    await fetchProviders()
    const appStore = useAppStore()
    await appStore.loadModels()
  }

  async function setProviderEnabled(provider: string, enabled: boolean) {
    await systemApi.updateProviderEnabled(provider, enabled)
    await fetchProviders()
    const appStore = useAppStore()
    await appStore.loadModels()
  }

  async function addProvider(data: CustomProvider) {
    await systemApi.addCustomProvider(data)
    await fetchProviders()
    const appStore = useAppStore()
    appStore.loadModels()
  }

  async function updateProvider(poolKey: string, data: {
    name?: string
    base_url?: string
    api_key?: string
    model?: string
    context_length?: number | null
  }) {
    await systemApi.updateProvider(poolKey, data)
    await fetchProviders()
    const appStore = useAppStore()
    appStore.loadModels()
  }

  async function removeProvider(name: string) {
    await systemApi.removeCustomProvider(name)
    await fetchProviders()
    const appStore = useAppStore()
    appStore.loadModels()
  }

  return {
    providers,
    allProviders,
    defaultModel,
    loading,
    customProviders,
    builtinProviders,
    allModels,
    fetchProviders,
    setDefaultModel,
    setModelEnabled,
    setProviderEnabled,
    addProvider,
    updateProvider,
    removeProvider,
  }
})

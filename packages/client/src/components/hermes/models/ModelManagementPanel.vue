<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import ProvidersPanel from './ProvidersPanel.vue'
import ProviderFormModal from './ProviderFormModal.vue'
import { useModelsStore } from '@/stores/hermes/models'
import { useAppStore } from '@/stores/hermes/app'
import { checkCopilotToken } from '@/api/hermes/copilot-auth'
import type { AvailableModelGroup } from '@/api/hermes/system'

withDefaults(defineProps<{
  showHeader?: boolean
}>(), {
  showHeader: true,
})

const { t } = useI18n()
const modelsStore = useModelsStore()
const appStore = useAppStore()
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingProvider = ref<AvailableModelGroup | null>(null)

onMounted(async () => {
  try { await checkCopilotToken() } catch { /* ignore */ }
  void modelsStore.fetchProviders()
})

function openCreateModal() {
  modalMode.value = 'create'
  editingProvider.value = null
  showModal.value = true
}

function openEditModal(provider: AvailableModelGroup) {
  modalMode.value = 'edit'
  editingProvider.value = provider
  showModal.value = true
}

function handleModalClose() {
  showModal.value = false
  editingProvider.value = null
  modalMode.value = 'create'
}

async function handleSaved() {
  await modelsStore.fetchProviders()
  await appStore.loadModels()
  handleModalClose()
}
</script>

<template>
  <div class="model-management-panel">
    <header v-if="showHeader" class="page-header">
      <div>
        <h2 class="header-title">{{ t('models.collectionTitle') }}</h2>
        <p class="header-subtitle">{{ t('models.collectionSubtitle') }}</p>
      </div>
      <NButton type="primary" size="small" @click="openCreateModal">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </template>
        {{ t('models.addCollection') }}
      </NButton>
    </header>

    <div class="panel-content">
      <NSpin :show="modelsStore.loading && modelsStore.providers.length === 0">
        <ProvidersPanel @edit="openEditModal" />
      </NSpin>
    </div>

    <ProviderFormModal
      v-if="showModal"
      :mode="modalMode"
      :provider="editingProvider"
      @close="handleModalClose"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.model-management-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid $border-color;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: $text-primary;
}

.header-subtitle {
  margin-top: 4px;
  font-size: 12px;
  color: $text-muted;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>

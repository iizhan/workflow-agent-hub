<script setup lang="ts">
import { toRef } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import GroupChatPanel from '@/components/hermes/group-chat/GroupChatPanel.vue'
import ApplicationCollaborationGuideCard from './ApplicationCollaborationGuideCard.vue'
import ApplicationCollaborationSummaryCard from './ApplicationCollaborationSummaryCard.vue'
import { useWorkbenchI18n } from '@/composables/workbench/useWorkbenchI18n'
import { useApplicationCollaborationWorkspace } from '@/composables/workbench/useApplicationCollaborationWorkspace'
import type { ApplicationDetail } from '@/types/workbench/application'

const props = defineProps<{
  application: ApplicationDetail
}>()

const message = useMessage()
const applicationId = toRef(() => props.application.id)
const workspace = useApplicationCollaborationWorkspace(applicationId)
const { t } = useWorkbenchI18n()

async function handleRefresh() {
  try {
    await workspace.refresh()
    message.success(t('workbench.collaboration.collaborationContextRefreshed'))
  } catch (err: any) {
    message.error(String(err?.message || t('workbench.collaboration.refreshCollaborationContextFailed')))
  }
}
</script>

<template>
  <div class="collaboration-workspace">
    <NSpin :show="workspace.isLoading.value">
      <section class="collaboration-workspace__top">
        <ApplicationCollaborationSummaryCard :summary="workspace.summary.value" />
        <ApplicationCollaborationGuideCard
          :scenario="application.scenario"
          :summary="workspace.summary.value"
          @refresh="handleRefresh"
        />
      </section>

      <section class="collaboration-workspace__panel">
        <GroupChatPanel />
      </section>
    </NSpin>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.collaboration-workspace {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.collaboration-workspace__top {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
}

.collaboration-workspace__panel {
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  overflow: hidden;
  min-height: 70vh;
  background: $bg-card;
  box-shadow: var(--workbench-shadow-soft);
}

@media (max-width: 1100px) {
  .collaboration-workspace__top {
    grid-template-columns: 1fr;
  }
}
</style>
